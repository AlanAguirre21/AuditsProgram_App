import crypto from 'node:crypto';
import { ROLE } from '../../constants/roles.js';
import { STATUS } from '../../constants/statuses.js';
import { storage } from '../../integrations/storage/index.js';
import { hasRole } from '../../middleware/authorize.js';
import { MAX_FILES_PER_OCCURRENCE, extOf } from '../../middleware/upload.js';
import { AppError } from '../../utils/AppError.js';
import * as changelog from '../changelog/changelog.service.js';
import { Occurrence } from '../occurrences/occurrence.model.js';
import { isOwner } from '../occurrences/occurrences.service.js';
import { Evidence } from './evidence.model.js';

/** Latin-1 filenames from multer (busboy) → UTF-8. */
const fixName = (name) => {
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return decoded.includes('�') ? name : decoded;
  } catch {
    return name;
  }
};

export async function upload(occurrenceId, files, user) {
  if (!files.length) throw AppError.badRequest('No se recibió ningún archivo (campo "files")');
  const occ = await Occurrence.findById(occurrenceId);
  if (!occ) throw AppError.notFound('Auditoría programada no encontrada');

  const admin = hasRole(user, ROLE.ADMIN);
  if (!admin && !(await isOwner(occ, user))) throw AppError.forbidden('Solo el responsable o un administrador pueden subir evidencia');
  if (!admin && occ.status !== STATUS.PROGRAMADA) throw AppError.invalidTransition('Solo se puede subir evidencia a una auditoría PROGRAMADA');
  if (occ.status === STATUS.CANCELADA) throw AppError.invalidTransition('La auditoría está cancelada');

  const existing = await Evidence.countDocuments({ occurrenceId: occ._id, deleted: false });
  if (existing + files.length > MAX_FILES_PER_OCCURRENCE) {
    throw AppError.badRequest(`Máximo ${MAX_FILES_PER_OCCURRENCE} archivos por auditoría (ya hay ${existing})`);
  }

  const created = [];
  for (const file of files) {
    const key = await storage.save(file.buffer, { year: occ.year, occurrenceId: occ._id, ext: extOf(file.originalname) });
    try {
      const doc = await Evidence.create({
        occurrenceId: occ._id,
        originalName: fixName(file.originalname),
        storageKey: key,
        mimeType: file.mimetype,
        size: file.size,
        sha256: crypto.createHash('sha256').update(file.buffer).digest('hex'),
        uploadedBy: user._id,
      });
      created.push(doc);
    } catch (err) {
      await storage.remove(key);
      throw err;
    }
  }

  await Occurrence.updateOne({ _id: occ._id }, { $push: { evidenceIds: { $each: created.map((d) => d._id) } } });
  await changelog.record({
    entity: 'AuditOccurrence',
    entityId: occ._id,
    action: 'UPDATE',
    after: { evidenceAdded: created.map((d) => d.originalName) },
    meta: { evidenceIds: created.map((d) => d._id) },
    user,
  });
  return created.map((d) => {
    const { storageKey, ...rest } = d.toObject();
    return rest;
  });
}

/** Any authenticated user may download (spec 9.2); the file path is never exposed. */
export async function getForDownload(id) {
  const doc = await Evidence.findById(id).select('+storageKey').lean();
  if (!doc || doc.deleted) throw AppError.notFound('Archivo no encontrado');
  if (!(await storage.exists(doc.storageKey))) throw AppError.notFound('El archivo no está disponible en el almacenamiento');
  return { doc, stream: storage.getStream(doc.storageKey) };
}

/** Soft delete by the uploader or an ADMIN, only while the occurrence is PROGRAMADA. The file is kept. */
export async function remove(id, user) {
  const doc = await Evidence.findById(id);
  if (!doc || doc.deleted) throw AppError.notFound('Archivo no encontrado');
  const admin = hasRole(user, ROLE.ADMIN);
  if (!admin && String(doc.uploadedBy) !== String(user._id)) throw AppError.forbidden('Solo quien subió el archivo o un administrador pueden eliminarlo');

  const occ = await Occurrence.findById(doc.occurrenceId);
  if (occ.status !== STATUS.PROGRAMADA) throw AppError.invalidTransition('Solo se puede eliminar evidencia mientras la auditoría está PROGRAMADA');

  doc.deleted = true;
  doc.deletedBy = user._id;
  doc.deletedAt = new Date();
  await doc.save();
  await Occurrence.updateOne({ _id: occ._id }, { $pull: { evidenceIds: doc._id } });
  await changelog.record({
    entity: 'AuditOccurrence',
    entityId: occ._id,
    action: 'UPDATE',
    before: { evidence: doc.originalName },
    after: { evidenceRemoved: doc.originalName },
    meta: { evidenceId: doc._id },
    user,
  });
}
