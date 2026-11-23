import { withTransaction } from '../../config/db.js';
import { EXTERNAL_BODIES } from '../../constants/auditCategories.js';
import { STATUS } from '../../constants/statuses.js';
import { AppError } from '../../utils/AppError.js';
import { lastWorkingDayOfMonth, parseDateKey } from '../../utils/dates.js';
import { normalizeText } from '../../utils/pagination.js';
import { AuditDefinition } from '../audits/auditDefinition.model.js';
import { nonWorkingSet } from '../calendar/calendar.service.js';
import * as changelog from '../changelog/changelog.service.js';
import { Group } from '../groups/group.model.js';
import { Occurrence } from '../occurrences/occurrence.model.js';
import { User } from '../users/user.model.js';
import { parseProgramWorkbook } from './excelParser.js';
import { Import } from './import.model.js';

const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

export const BLOCKING_ISSUES = ['OWNER_MISSING', 'GROUP_NOT_FOUND', 'DUPLICATE_CODE', 'REQUIRED_BY_EMPTY', 'CATEGORY_UNKNOWN', 'CODE_EXISTS'];

/** Group key that ignores accents, punctuation and "y": "Calidad N1, N2" ≡ "Calidad N1 y N2". */
export const groupKey = (s) =>
  normalizeText(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(y|and|e)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isExternalBody = (s) => EXTERNAL_BODIES.some((b) => groupKey(b) === groupKey(s));

/** Splits "Guillermo Soto, Luis Ochoa / Horacio Rivera" into individual names. */
const splitPeople = (s) =>
  String(s || '')
    .replace(/\(.*?\)/g, ' ')
    .split(/,|\/|&|;|--|\s+-\s+|\by\b/)
    .map((x) => x.trim())
    .filter((x) => x.length > 3);

// ---------------------------------------------------------------------------- matching

async function loadLookups() {
  const [groups, users] = await Promise.all([
    Group.find({ active: true }, { name: 1, leaderId: 1 }).lean(),
    User.find({ active: true }, { name: 1, email: 1 }).lean(),
  ]);
  return { groups, users };
}

function matchGroup(name, groups) {
  const key = groupKey(name);
  return key ? groups.find((g) => groupKey(g.name) === key) ?? null : null;
}

function matchUser(rawNames, users) {
  for (const person of splitPeople(rawNames)) {
    const key = normalizeText(person);
    const hit = users.find((u) => normalizeText(u.name) === key) ?? users.find((u) => normalizeText(u.name).startsWith(key));
    if (hit) return hit;
  }
  return null;
}

/** Initial draft for one Excel row, with automatic matches where possible. */
function buildDraft(row, { groups, users }, dueDateFor) {
  const draft = {
    row: row.row,
    code: row.code,
    category: row.category,
    categoryRaw: row.categoryRaw,
    name: row.name,
    standard: row.standard,
    requiredBy: row.requiredBy,
    requiredByRaw: row.requiredByRaw,
    responsibleRaw: row.responsibleRaw,
    ownerNamesRaw: row.ownerNamesRaw,
    folderPath: row.folderPath || undefined,
    executor: { type: 'INTERNAL', name: row.responsibleRaw },
    ownerGroupName: row.responsibleRaw,
    ownerGroupId: null,
    defaultOwnerUserId: null,
    evidenceRequired: true,
    requiresValidation: true,
    occurrences: row.occurrences.map((o) => ({ ...o, dueDate: dueDateFor(o.month) })),
  };

  if (isExternalBody(row.responsibleRaw)) {
    draft.executor = { type: 'EXTERNAL', name: row.responsibleRaw };
    draft.ownerGroupName = null;
  }

  // Spec 16.3 row 22: customers mixed into RESPONSABLE and REQUERIDO POR empty.
  if (!draft.requiredBy.length && draft.ownerGroupName) {
    const respKey = groupKey(draft.ownerGroupName);
    const g = groups.find((x) => respKey.endsWith(groupKey(x.name)) && respKey !== groupKey(x.name));
    if (g) {
      const prefix = draft.ownerGroupName.slice(0, draft.ownerGroupName.length - g.name.length).trim();
      draft.requiredBySuggestion = prefix.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
      draft.ownerGroupName = g.name;
      draft.executor.name = g.name;
    }
  }

  const group = draft.ownerGroupName ? matchGroup(draft.ownerGroupName, groups) : null;
  if (group) {
    draft.ownerGroupId = String(group._id);
    draft.ownerGroupName = group.name;
  }
  const user = matchUser(row.ownerNamesRaw, users);
  if (user) draft.defaultOwnerUserId = String(user._id);
  else if (group?.leaderId) draft.defaultOwnerUserId = String(group.leaderId);
  return draft;
}

// ---------------------------------------------------------------------------- issues

export function computeIssues(drafts, { fileCounts = {}, existingCodes = new Set() } = {}) {
  const issues = [];
  const add = (d, field, code, message, suggestion) =>
    issues.push({ row: d?.row ?? null, defCode: d?.code ?? null, field, code, message, suggestion, blocking: BLOCKING_ISSUES.includes(code) });

  const seen = new Map();
  for (const d of drafts) {
    if (seen.has(d.code)) add(d, 'code', 'DUPLICATE_CODE', `El número #${d.code} se repite (fila ${seen.get(d.code)})`);
    seen.set(d.code, d.row);
    if (existingCodes.has(d.code)) add(d, 'code', 'CODE_EXISTS', `Ya existe la auditoría #${d.code} en el programa de ese año`);

    if (!d.category) add(d, 'category', 'CATEGORY_UNKNOWN', `No se reconoce el tipo de auditoría "${d.categoryRaw}"`);

    if (!d.requiredBy?.length) {
      add(d, 'requiredBy', 'REQUIRED_BY_EMPTY', '"Requerido por" está vacío', d.requiredBySuggestion?.length ? d.requiredBySuggestion : undefined);
    } else if (d.requiredBy.length === 1 && d.requiredBy[0].toUpperCase() === 'CSR') {
      add(d, 'requiredBy', 'REQUIRED_BY_GENERIC', '"Requerido por" es genérico (CSR). Elige los clientes o conserva "CSR".');
    }

    if (!d.ownerGroupId) {
      add(
        d,
        'ownerGroupId',
        'GROUP_NOT_FOUND',
        d.executor?.type === 'EXTERNAL'
          ? `Auditor externo (${d.executor.name}): selecciona el grupo interno responsable`
          : `No existe el grupo "${d.ownerGroupName}"`,
        d.ownerGroupName || undefined,
      );
    }
    if (!d.defaultOwnerUserId) {
      add(
        d,
        'defaultOwnerUserId',
        'OWNER_MISSING',
        d.executor?.type === 'EXTERNAL'
          ? `Auditor externo (${d.executor.name}): selecciona el responsable interno`
          : 'Selecciona el responsable interno',
        d.ownerNamesRaw || undefined,
      );
    }

    if (!d.occurrences.length) add(d, 'occurrences', 'NO_OCCURRENCES', 'La auditoría no tiene meses programados');
    for (const o of d.occurrences) {
      for (const w of o.warnings ?? []) add(d, `month.${o.month}`, 'STATUS_CONFLICT', `Mes ${o.month}: ${w}. Se importa como ${o.status.replace(/_/g, ' ')}.`);
    }
  }

  // Spec 16.4 step 6: parsed counts must equal the file's "Programadas" row (warning only).
  const parsed = {};
  for (const d of drafts) for (const o of d.occurrences) parsed[o.month] = (parsed[o.month] ?? 0) + 1;
  for (const [m, expected] of Object.entries(fileCounts)) {
    if ((parsed[m] ?? 0) !== expected) {
      add(null, `month.${m}`, 'MONTH_COUNT_MISMATCH', `Mes ${m}: el archivo indica ${expected} programadas y se leyeron ${parsed[m] ?? 0}`);
    }
  }
  return issues;
}

function monthlyCheck(drafts, fileCounts) {
  const parsed = {};
  for (const d of drafts) for (const o of d.occurrences) parsed[o.month] = (parsed[o.month] ?? 0) + 1;
  return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, parsed: parsed[i + 1] ?? 0, file: fileCounts[i + 1] ?? null }));
}

async function existingCodesFor(year) {
  const codes = await AuditDefinition.distinct('code', { year });
  return new Set(codes);
}

async function toResponse(doc) {
  const { definitions, fileCounts, changeHistory, detectedYear, sheetName } = doc.parsed;
  const issues = computeIssues(definitions, { fileCounts, existingCodes: await existingCodesFor(doc.year) });
  return {
    importId: doc._id,
    fileName: doc.fileName,
    year: doc.year,
    status: doc.status,
    expiresAt: doc.expiresAt,
    detectedYear,
    sheetName,
    definitions,
    occurrencesCount: definitions.reduce((n, d) => n + d.occurrences.length, 0),
    monthly: monthlyCheck(definitions, fileCounts),
    changeHistory,
    issues,
    blockingCount: issues.filter((i) => i.blocking).length,
  };
}

// ---------------------------------------------------------------------------- API

export async function preview({ buffer, fileName, year }, actor) {
  let parsed;
  try {
    parsed = await parseProgramWorkbook(buffer);
  } catch (err) {
    throw AppError.badRequest(`No se pudo leer el archivo: ${err.message}`);
  }
  if (parsed.detectedYear && parsed.detectedYear !== year) {
    throw AppError.badRequest(`El archivo corresponde al programa ${parsed.detectedYear}, pero seleccionaste ${year}`);
  }

  const lookups = await loadLookups();
  const nw = await nonWorkingSet([year]);
  const dueDateFor = (month) => lastWorkingDayOfMonth(year, month, nw); // BR-01
  const definitions = parsed.rows.map((row) => buildDraft(row, lookups, dueDateFor));

  const doc = await Import.create({
    fileName,
    uploadedBy: actor._id,
    year,
    parsed: { definitions, fileCounts: parsed.fileCounts, changeHistory: parsed.changeHistory, detectedYear: parsed.detectedYear, sheetName: parsed.sheetName },
    expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
  });
  return toResponse(doc);
}

async function loadPreview(id) {
  const doc = await Import.findById(id);
  if (!doc) throw AppError.notFound('La vista previa no existe o expiró (24 h). Sube el archivo de nuevo.');
  if (doc.status !== 'PREVIEW') throw AppError.conflict(`Esta importación ya fue ${doc.status === 'CONFIRMED' ? 'confirmada' : 'descartada'}`);
  return doc;
}

export async function get(id) {
  const doc = await Import.findById(id);
  if (!doc) throw AppError.notFound('Importación no encontrada');
  return toResponse(doc);
}

const PATCHABLE = ['category', 'name', 'standard', 'requiredBy', 'ownerGroupId', 'defaultOwnerUserId', 'executor', 'evidenceRequired', 'requiresValidation', 'code'];

/** Fixes mappings in the preview: per-row `updates` and/or `bulk` values for rows still missing them. */
export async function patch(id, { updates = [], bulk = {} }) {
  const doc = await loadPreview(id);
  const defs = doc.parsed.definitions;

  const groupIds = [...new Set([...updates.map((u) => u.ownerGroupId), bulk.ownerGroupId].filter(Boolean))];
  const userIds = [...new Set([...updates.map((u) => u.defaultOwnerUserId), bulk.defaultOwnerUserId].filter(Boolean))];
  const [groups, userCount] = await Promise.all([
    groupIds.length ? Group.find({ _id: { $in: groupIds }, active: true }, { name: 1 }).lean() : [],
    userIds.length ? User.countDocuments({ _id: { $in: userIds }, active: true }) : 0,
  ]);
  if (groups.length !== groupIds.length) throw AppError.badRequest('Uno o más grupos no existen o están inactivos');
  if (userCount !== userIds.length) throw AppError.badRequest('Uno o más usuarios no existen o están inactivos');
  const groupNames = Object.fromEntries(groups.map((x) => [String(x._id), x.name]));

  for (const u of updates) {
    const d = defs.find((x) => x.row === u.row);
    if (!d) throw AppError.badRequest(`Fila ${u.row} no encontrada en la vista previa`);
    for (const k of PATCHABLE) if (u[k] !== undefined) d[k] = u[k];
    if (u.ownerGroupId) d.ownerGroupName = groupNames[u.ownerGroupId];
  }
  if (bulk.defaultOwnerUserId) for (const d of defs) if (!d.defaultOwnerUserId) d.defaultOwnerUserId = bulk.defaultOwnerUserId;
  if (bulk.ownerGroupId) {
    for (const d of defs) {
      if (!d.ownerGroupId) {
        d.ownerGroupId = bulk.ownerGroupId;
        d.ownerGroupName = groupNames[bulk.ownerGroupId];
      }
    }
  }

  doc.markModified('parsed');
  await doc.save();
  return toResponse(doc);
}

/** Creates every internal group that was not found (spec 16.2: "option to create the group"). */
export async function createMissingGroups(id, actor) {
  const doc = await loadPreview(id);
  const defs = doc.parsed.definitions;
  const { groups } = await loadLookups();
  const created = [];

  for (const d of defs) {
    if (d.ownerGroupId || !d.ownerGroupName || d.executor?.type === 'EXTERNAL') continue;
    let group = matchGroup(d.ownerGroupName, groups);
    if (!group) {
      group = (await Group.create({ name: d.ownerGroupName, memberIds: [] })).toObject();
      groups.push(group);
      created.push(group.name);
      await changelog.record({ entity: 'Group', entityId: group._id, action: 'CREATE', after: { name: group.name }, meta: { importId: doc._id }, user: actor });
    }
    d.ownerGroupId = String(group._id);
    d.ownerGroupName = group.name;
  }
  doc.markModified('parsed');
  await doc.save();
  return { ...(await toResponse(doc)), createdGroups: created };
}

export async function confirm(id, actor) {
  const doc = await loadPreview(id);
  const { definitions, fileCounts, changeHistory } = doc.parsed;
  const issues = computeIssues(definitions, { fileCounts, existingCodes: await existingCodesFor(doc.year) });
  const blocking = issues.filter((i) => i.blocking);
  if (blocking.length) throw AppError.conflict(`Hay ${blocking.length} problema(s) por resolver antes de confirmar`, { issues: blocking });

  const result = await withTransaction(async (session) => {
    let occurrencesCreated = 0;
    for (const d of definitions) {
      const [def] = await AuditDefinition.create(
        [
          {
            code: d.code,
            year: doc.year,
            category: d.category,
            name: d.name,
            standard: d.standard,
            requiredBy: d.requiredBy,
            ownerGroupId: d.ownerGroupId,
            defaultOwnerUserId: d.defaultOwnerUserId,
            executor: d.executor,
            evidenceRequired: d.evidenceRequired,
            requiresValidation: d.requiresValidation,
            folderPath: d.folderPath,
            notes: d.ownerNamesRaw ? `Responsables (Excel): ${d.ownerNamesRaw}` : undefined,
          },
        ],
        { session },
      );

      const occDocs = d.occurrences.map((o) => {
        const due = parseDateKey(o.dueDate);
        const base = {
          definitionId: def._id,
          year: doc.year,
          dueDate: due,
          originalDueDate: due,
          status: o.status,
          ownerUserId: def.defaultOwnerUserId,
          ownerGroupId: def.ownerGroupId,
        };
        if (o.status === STATUS.REALIZADA || o.status === STATUS.REALIZADA_FUERA_DE_TIEMPO) {
          base.completion = { performedAt: due, submittedAt: new Date(), submittedBy: actor._id, importedCompletion: true };
          base.validation = { validatedBy: actor._id, validatedAt: new Date(), rejections: [] };
        }
        if (o.status === STATUS.NO_REALIZADA) {
          base.closure = { reason: 'Importado desde Excel como NO REALIZADA', closedBy: actor._id, closedAt: new Date() };
        }
        return base;
      });
      if (occDocs.length) await Occurrence.insertMany(occDocs, { session });
      occurrencesCreated += occDocs.length;
    }

    await changelog.record({
      entity: 'Import',
      entityId: doc._id,
      action: 'IMPORT',
      after: { year: doc.year, definitions: definitions.length, occurrences: occurrencesCreated, fileName: doc.fileName },
      meta: { warnings: issues.length },
      user: actor,
      session,
    });
    // Historical change table from the Excel (spec 16.1).
    for (const h of changeHistory ?? []) {
      await changelog.record({
        entity: 'Import',
        entityId: doc._id,
        action: 'IMPORT',
        reason: h.content,
        meta: { historical: true, revision: h.revision, preparedBy: h.preparedBy, reviewedBy: h.reviewedBy },
        system: true,
        at: h.date ? new Date(`${h.date}T12:00:00.000Z`) : undefined,
        session,
      });
    }

    doc.status = 'CONFIRMED';
    doc.confirmedAt = new Date();
    doc.expiresAt = undefined; // keep confirmed imports
    await doc.save({ session });
    return { definitions: definitions.length, occurrences: occurrencesCreated };
  });

  return { importId: doc._id, year: doc.year, ...result };
}

export async function discard(id) {
  const doc = await loadPreview(id);
  doc.status = 'DISCARDED';
  await doc.save();
}
