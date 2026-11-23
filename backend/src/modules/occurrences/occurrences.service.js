import mongoose from 'mongoose';
import { withTransaction } from '../../config/db.js';
import { ROLE } from '../../constants/roles.js';
import { DERIVED, OPEN_STATUSES, PROXIMA_WINDOW_DAYS, RESCHEDULE_STATUS, STATUS, TERMINAL_STATUSES } from '../../constants/statuses.js';
import { hasRole } from '../../middleware/authorize.js';
import { AppError } from '../../utils/AppError.js';
import { addDays, diffDays, parseDateKey, toDateKey, todayKey, yearOf } from '../../utils/dates.js';
import { pageMeta, parsePagination } from '../../utils/pagination.js';
import { AuditDefinition } from '../audits/auditDefinition.model.js';
import * as changelog from '../changelog/changelog.service.js';
import { Evidence } from '../evidence/evidence.model.js';
import { Group } from '../groups/group.model.js';
import { getSettings } from '../settings/settings.service.js';
import { User } from '../users/user.model.js';
import { completionStatus, decorate } from './occurrence.logic.js';
import { Occurrence } from './occurrence.model.js';
import { assertTransition } from './occurrences.status.js';

const DEF_FIELDS = 'code year category name standard requiredBy executor evidenceRequired requiresValidation ownerGroupId folderPath active';
const USER_FIELDS = 'name email department';
const isAdmin = (user) => hasRole(user, ROLE.ADMIN);

// ---------------------------------------------------------------------------- permissions

export async function userGroupIds(userId) {
  const groups = await Group.find({ memberIds: userId, active: true }, { _id: 1 }).lean();
  return groups.map((g) => g._id);
}

/** "own" = the user is the owner or a member of the owner group (spec 4.2). */
export async function isOwner(occ, user) {
  if (String(occ.ownerUserId?._id ?? occ.ownerUserId) === String(user._id)) return true;
  const groupId = occ.ownerGroupId?._id ?? occ.ownerGroupId;
  return Boolean(await Group.exists({ _id: groupId, memberIds: user._id }));
}

async function assertOwnerOrAdmin(occ, user) {
  if (isAdmin(user)) return;
  if (!(await isOwner(occ, user))) throw AppError.forbidden('Solo el responsable, su grupo o un administrador pueden realizar esta acción');
}

// ---------------------------------------------------------------------------- queries

async function buildFilter(query) {
  const filter = {};
  const today = todayKey();
  if (query.year) filter.year = query.year;
  if (query.month && query.year) {
    const start = parseDateKey(`${query.year}-${String(query.month).padStart(2, '0')}-01`);
    const end = new Date(Date.UTC(query.year, query.month, 1));
    filter.dueDate = { $gte: start, $lt: end };
  }
  if (query.status) filter.status = Array.isArray(query.status) ? { $in: query.status } : query.status;
  if (query.ownerUserId) filter.ownerUserId = query.ownerUserId;
  if (query.ownerGroupId) filter.ownerGroupId = query.ownerGroupId;
  if (query.definitionId) filter.definitionId = query.definitionId;

  if (query.derived === DERIVED.VENCIDA) {
    filter.status = STATUS.PROGRAMADA;
    filter.dueDate = { ...(filter.dueDate || {}), $lt: parseDateKey(today) };
  } else if (query.derived === DERIVED.PROXIMA) {
    filter.status = STATUS.PROGRAMADA;
    filter.dueDate = { ...(filter.dueDate || {}), $gte: parseDateKey(today), $lte: parseDateKey(addDays(today, PROXIMA_WINDOW_DAYS)) };
  }

  if (query.category || query.requiredBy) {
    const defFilter = {};
    if (query.year) defFilter.year = query.year;
    if (query.category) defFilter.category = query.category;
    if (query.requiredBy) defFilter.requiredBy = query.requiredBy;
    const defs = await AuditDefinition.find(defFilter, { _id: 1 }).lean();
    filter.definitionId = { $in: defs.map((d) => d._id) };
  }
  return filter;
}

function populateList(q) {
  return q.populate('definitionId', DEF_FIELDS).populate('ownerUserId', USER_FIELDS).populate('ownerGroupId', 'name');
}

export async function list(query) {
  const pg = parsePagination(query, { defaultSort: 'dueDate', defaultLimit: 50 });
  const filter = await buildFilter(query);
  const [items, total] = await Promise.all([
    populateList(Occurrence.find(filter).sort(pg.sort).skip(pg.skip).limit(pg.limit)).lean(),
    Occurrence.countDocuments(filter),
  ]);
  const today = todayKey();
  return { items: items.map((o) => decorate(o, today)), meta: pageMeta(pg, total) };
}

/** Occurrences where the user is owner or member of the owner group. */
export async function mine(user, query) {
  const groupIds = await userGroupIds(user._id);
  const base = await buildFilter(query);
  const filter = { ...base, $or: [{ ownerUserId: user._id }, { ownerGroupId: { $in: groupIds } }] };
  const items = await populateList(Occurrence.find(filter).sort({ dueDate: 1 }).limit(500)).lean();
  const today = todayKey();
  return items.map((o) => decorate(o, today));
}

export async function getDetail(id, user) {
  const occ = await Occurrence.findById(id)
    .populate('definitionId', DEF_FIELDS)
    .populate('ownerUserId', USER_FIELDS)
    .populate('ownerGroupId', 'name leaderId')
    .populate('completion.submittedBy', USER_FIELDS)
    .populate('validation.validatedBy', USER_FIELDS)
    .populate('validation.rejections.by', USER_FIELDS)
    .populate('rescheduleRequest.requestedBy', USER_FIELDS)
    .populate('rescheduleRequest.resolvedBy', USER_FIELDS)
    .populate('rescheduleHistory.requestedBy', USER_FIELDS)
    .populate('rescheduleHistory.approvedBy', USER_FIELDS)
    .populate('closure.closedBy', USER_FIELDS)
    .lean();
  if (!occ) throw AppError.notFound('Auditoría programada no encontrada');

  const evidence = await Evidence.find({ occurrenceId: occ._id, deleted: false }).populate('uploadedBy', USER_FIELDS).sort({ createdAt: 1 }).lean();
  const own = await isOwner(occ, user);
  const admin = isAdmin(user);
  const programada = occ.status === STATUS.PROGRAMADA;
  const pendingReschedule = occ.rescheduleRequest?.status === RESCHEDULE_STATUS.PENDING;

  return {
    ...decorate(occ, todayKey()),
    evidence,
    permissions: {
      isOwner: own,
      isAdmin: admin,
      canComplete: programada && (own || admin),
      canUploadEvidence: (programada && (own || admin)) || (admin && occ.status !== STATUS.CANCELADA),
      canRequestReschedule: programada && !pendingReschedule && (own || admin),
      canResolveReschedule: admin && pendingReschedule,
      canValidate: admin && occ.status === STATUS.EN_VALIDACION,
      canCancel: admin && programada,
      canCloseNotDone: admin && programada,
      canReopen: admin && TERMINAL_STATUSES.includes(occ.status),
      canReassign: admin && OPEN_STATUSES.includes(occ.status),
    },
  };
}

export async function history(id) {
  if (!(await Occurrence.exists({ _id: id }))) throw AppError.notFound('Auditoría programada no encontrada');
  return changelog.forEntity('AuditOccurrence', id);
}

// ---------------------------------------------------------------------------- mutations

async function load(id, session) {
  const occ = await Occurrence.findById(id).session(session ?? null);
  if (!occ) throw AppError.notFound('Auditoría programada no encontrada');
  return occ;
}

/**
 * Saves with optimistic concurrency (the schema enables it): if another request changed the
 * occurrence after we loaded it, the save fails and the client gets 409 (NFR-09).
 */
async function saveIfStatus(occ, _expectedStatus, session) {
  try {
    await occ.save({ session });
  } catch (err) {
    if (err instanceof mongoose.Error.VersionError) {
      throw AppError.invalidTransition('La auditoría cambió mientras se procesaba la solicitud. Recarga la página.');
    }
    throw err;
  }
}

const snapshot = (occ, fields) => Object.fromEntries(fields.map((f) => [f, occ.get(f)]));

export async function updateOwner(id, { ownerUserId, reason }, actor) {
  return withTransaction(async (session) => {
    const occ = await load(id, session);
    if (!OPEN_STATUSES.includes(occ.status)) throw AppError.invalidTransition('Solo se puede reasignar una auditoría abierta');
    const newOwner = await User.findById(ownerUserId).session(session ?? null);
    if (!newOwner || !newOwner.active) throw AppError.badRequest('El nuevo responsable no existe o está inactivo');
    if (String(occ.ownerUserId) === String(ownerUserId)) return occ.toObject();

    const before = { ownerUserId: occ.ownerUserId };
    occ.ownerUserId = newOwner._id;
    await occ.save({ session });
    await changelog.record({ entity: 'AuditOccurrence', entityId: occ._id, action: 'REASSIGN', before, after: { ownerUserId: newOwner._id }, reason, user: actor, session });
    // TODO(phase 2): email the new owner (spec 8.4).
    return occ.toObject();
  });
}

export async function complete(id, body, actor) {
  return withTransaction(async (session) => {
    const occ = await load(id, session);
    await assertOwnerOrAdmin(occ, actor);
    const def = await AuditDefinition.findById(occ.definitionId).session(session ?? null).lean();

    const today = todayKey();
    const performedKey = body.performedAt;
    // BR-11
    if (performedKey > today) throw AppError.badRequest('La fecha de realización no puede ser futura');
    if (diffDays(performedKey, toDateKey(occ.dueDate)) > 60) {
      throw AppError.badRequest('La fecha de realización no puede ser más de 60 días antes de la fecha programada');
    }
    // BR-12
    if (def.evidenceRequired) {
      const files = await Evidence.countDocuments({ occurrenceId: occ._id, deleted: false }).session(session ?? null);
      if (files === 0) throw AppError.badRequest('Debes adjuntar al menos un archivo de evidencia');
    }

    const finalStatus = completionStatus(occ, performedKey);
    const target = def.requiresValidation ? STATUS.EN_VALIDACION : finalStatus;
    assertTransition(occ.status, target, 'registrar como realizada');

    const fields = ['status', 'completion'];
    const before = snapshot(occ, fields);
    occ.status = target;
    occ.completion = {
      performedAt: parseDateKey(performedKey),
      submittedAt: new Date(),
      submittedBy: actor._id,
      findings: body.findings,
      findingsSummary: body.findingsSummary,
      externalRef: body.externalRef,
    };
    if (!def.requiresValidation) {
      occ.validation.validatedBy = actor._id;
      occ.validation.validatedAt = new Date();
    }
    await saveIfStatus(occ, STATUS.PROGRAMADA, session);
    await changelog.record({
      entity: 'AuditOccurrence',
      entityId: occ._id,
      action: 'COMPLETE',
      before,
      after: snapshot(occ, fields),
      meta: { expectedFinalStatus: finalStatus, requiresValidation: def.requiresValidation },
      user: actor,
      session,
    });
    // TODO(phase 2): VALIDATION_REQUEST email to quality supervisors (BR-15).
    return occ.toObject();
  });
}

export async function validate(id, actor) {
  return withTransaction(async (session) => {
    const occ = await load(id, session);
    if (occ.status !== STATUS.EN_VALIDACION) assertTransition(occ.status, STATUS.REALIZADA, 'validar');

    // BR-22: four-eyes principle.
    let selfValidated = false;
    if (String(occ.completion?.submittedBy) === String(actor._id)) {
      const otherAdmins = await User.countDocuments({ _id: { $ne: actor._id }, roles: ROLE.ADMIN, active: true }).session(session ?? null);
      if (otherAdmins > 0) throw AppError.forbidden('No puedes validar tu propio registro: otro administrador debe validarlo');
      selfValidated = true;
    }

    const finalStatus = completionStatus(occ, occ.completion.performedAt);
    const before = { status: occ.status };
    occ.status = finalStatus;
    occ.validation.validatedBy = actor._id;
    occ.validation.validatedAt = new Date();
    occ.validation.selfValidated = selfValidated;
    await saveIfStatus(occ, STATUS.EN_VALIDACION, session);
    await changelog.record({
      entity: 'AuditOccurrence',
      entityId: occ._id,
      action: 'VALIDATE',
      before,
      after: { status: finalStatus },
      meta: selfValidated ? { selfValidated: true } : undefined,
      user: actor,
      session,
    });
    // TODO(phase 2): VALIDATION_RESULT email to the owner.
    return occ.toObject();
  });
}

export async function reject(id, { comment }, actor) {
  return withTransaction(async (session) => {
    const occ = await load(id, session);
    if (occ.status !== STATUS.EN_VALIDACION) throw AppError.invalidTransition('Solo se puede rechazar una auditoría en validación');
    assertTransition(occ.status, STATUS.PROGRAMADA, 'rechazar');
    const before = { status: occ.status };
    occ.status = STATUS.PROGRAMADA;
    occ.validation.rejections.push({ by: actor._id, at: new Date(), comment });
    await saveIfStatus(occ, STATUS.EN_VALIDACION, session);
    await changelog.record({ entity: 'AuditOccurrence', entityId: occ._id, action: 'REJECT', before, after: { status: STATUS.PROGRAMADA }, reason: comment, user: actor, session });
    // TODO(phase 2): VALIDATION_RESULT email to the owner.
    return occ.toObject();
  });
}

function assertRescheduleDate(occ, dateKey) {
  if (yearOf(dateKey) !== occ.year) {
    throw AppError.badRequest(`La nueva fecha debe estar dentro del programa ${occ.year}. Para moverla a otro año, cancélala y prográmala en el nuevo programa.`);
  }
  if (dateKey === toDateKey(occ.dueDate)) throw AppError.badRequest('La nueva fecha es igual a la fecha actual');
}

export async function requestReschedule(id, { requestedDate, reason }, actor) {
  return withTransaction(async (session) => {
    const occ = await load(id, session);
    await assertOwnerOrAdmin(occ, actor);
    if (occ.status !== STATUS.PROGRAMADA) throw AppError.invalidTransition('Solo se puede reprogramar una auditoría PROGRAMADA');
    if (occ.rescheduleRequest?.status === RESCHEDULE_STATUS.PENDING) throw AppError.conflict('Ya existe una solicitud de reprogramación pendiente');
    assertRescheduleDate(occ, requestedDate);

    occ.rescheduleRequest = {
      requestedDate: parseDateKey(requestedDate),
      reason,
      requestedBy: actor._id,
      requestedAt: new Date(),
      status: RESCHEDULE_STATUS.PENDING,
    };
    await saveIfStatus(occ, STATUS.PROGRAMADA, session);
    await changelog.record({
      entity: 'AuditOccurrence',
      entityId: occ._id,
      action: 'RESCHEDULE_REQUEST',
      before: { dueDate: occ.dueDate },
      after: { requestedDate },
      reason,
      user: actor,
      session,
    });
    // TODO(phase 2): RESCHEDULE_REQUEST email to quality supervisors.
    return occ.toObject();
  });
}

async function applyReschedule(occ, { toKey, reason, requestedBy }, actor, session) {
  const settings = await getSettings();
  const today = todayKey();
  const fromKey = toDateKey(occ.dueDate);
  const afterDue = today > fromKey;

  occ.rescheduleHistory.push({ from: occ.dueDate, to: parseDateKey(toKey), reason, requestedBy, approvedBy: actor._id, at: new Date(), afterDue });
  occ.dueDate = parseDateKey(toKey);
  occ.lastEscalationLevel = 0; // BR-32
  if (afterDue && settings.rescheduleAfterDueCountsAsLate) occ.evaluateAgainstOriginal = true; // BR-33
  return { fromKey, afterDue };
}

export async function approveReschedule(id, actor) {
  return withTransaction(async (session) => {
    const occ = await load(id, session);
    if (occ.rescheduleRequest?.status !== RESCHEDULE_STATUS.PENDING) throw AppError.conflict('No hay una solicitud de reprogramación pendiente');
    if (occ.status !== STATUS.PROGRAMADA) throw AppError.invalidTransition('Solo se puede reprogramar una auditoría PROGRAMADA');

    const req = occ.rescheduleRequest;
    const toKey = toDateKey(req.requestedDate);
    const { fromKey, afterDue } = await applyReschedule(occ, { toKey, reason: req.reason, requestedBy: req.requestedBy }, actor, session);
    occ.rescheduleRequest.status = RESCHEDULE_STATUS.APPROVED;
    occ.rescheduleRequest.resolvedBy = actor._id;
    occ.rescheduleRequest.resolvedAt = new Date();
    await saveIfStatus(occ, STATUS.PROGRAMADA, session);
    await changelog.record({
      entity: 'AuditOccurrence',
      entityId: occ._id,
      action: 'RESCHEDULE_APPROVE',
      before: { dueDate: fromKey },
      after: { dueDate: toKey },
      reason: req.reason,
      meta: { afterDue, evaluateAgainstOriginal: occ.evaluateAgainstOriginal },
      user: actor,
      session,
    });
    // TODO(phase 2): RESCHEDULE_RESULT email to the owner.
    return occ.toObject();
  });
}

export async function rejectReschedule(id, { comment }, actor) {
  return withTransaction(async (session) => {
    const occ = await load(id, session);
    if (occ.rescheduleRequest?.status !== RESCHEDULE_STATUS.PENDING) throw AppError.conflict('No hay una solicitud de reprogramación pendiente');
    occ.rescheduleRequest.status = RESCHEDULE_STATUS.REJECTED;
    occ.rescheduleRequest.resolvedBy = actor._id;
    occ.rescheduleRequest.resolvedAt = new Date();
    occ.rescheduleRequest.resolutionComment = comment;
    await saveIfStatus(occ, occ.status, session);
    await changelog.record({
      entity: 'AuditOccurrence',
      entityId: occ._id,
      action: 'RESCHEDULE_REJECT',
      after: { requestedDate: toDateKey(occ.rescheduleRequest.requestedDate) },
      reason: comment,
      user: actor,
      session,
    });
    return occ.toObject();
  });
}

/** BR-31: an ADMIN reschedules directly (request + approval in one step). */
export async function rescheduleDirect(id, { newDate, reason }, actor) {
  return withTransaction(async (session) => {
    const occ = await load(id, session);
    if (occ.status !== STATUS.PROGRAMADA) throw AppError.invalidTransition('Solo se puede reprogramar una auditoría PROGRAMADA');
    assertRescheduleDate(occ, newDate);
    const { fromKey, afterDue } = await applyReschedule(occ, { toKey: newDate, reason, requestedBy: actor._id }, actor, session);
    if (occ.rescheduleRequest?.status === RESCHEDULE_STATUS.PENDING) {
      occ.rescheduleRequest.status = RESCHEDULE_STATUS.REJECTED;
      occ.rescheduleRequest.resolvedBy = actor._id;
      occ.rescheduleRequest.resolvedAt = new Date();
      occ.rescheduleRequest.resolutionComment = 'Reemplazada por una reprogramación directa del administrador';
    }
    await saveIfStatus(occ, STATUS.PROGRAMADA, session);
    await changelog.record({
      entity: 'AuditOccurrence',
      entityId: occ._id,
      action: 'RESCHEDULE',
      before: { dueDate: fromKey },
      after: { dueDate: newDate },
      reason,
      meta: { afterDue, evaluateAgainstOriginal: occ.evaluateAgainstOriginal },
      user: actor,
      session,
    });
    return occ.toObject();
  });
}

async function close(id, { reason }, actor, target, action, label) {
  return withTransaction(async (session) => {
    const occ = await load(id, session);
    assertTransition(occ.status, target, label);
    const before = { status: occ.status };
    const from = occ.status;
    occ.status = target;
    occ.closure = { reason, closedBy: actor?._id, closedAt: new Date() };
    if (occ.rescheduleRequest?.status === RESCHEDULE_STATUS.PENDING) {
      occ.rescheduleRequest.status = RESCHEDULE_STATUS.REJECTED;
      occ.rescheduleRequest.resolutionComment = 'Auditoría cerrada';
    }
    await saveIfStatus(occ, from, session);
    await changelog.record({ entity: 'AuditOccurrence', entityId: occ._id, action, before, after: { status: target }, reason, user: actor, session });
    return occ.toObject();
  });
}

export const cancel = (id, body, actor) => close(id, body, actor, STATUS.CANCELADA, 'CANCEL', 'cancelar');
export const closeNotDone = (id, body, actor) => close(id, body, actor, STATUS.NO_REALIZADA, 'CLOSE_NOT_DONE', 'cerrar como no realizada');

/** ADMIN-only: a terminal occurrence goes back to PROGRAMADA (spec 6.3). */
export async function reopen(id, { reason }, actor) {
  return withTransaction(async (session) => {
    const occ = await load(id, session);
    if (!TERMINAL_STATUSES.includes(occ.status)) throw AppError.invalidTransition('Solo se pueden reabrir auditorías cerradas');
    const from = occ.status;
    const before = { status: from, completion: occ.completion, closure: occ.closure };
    occ.status = STATUS.PROGRAMADA;
    occ.closure = undefined;
    occ.lastEscalationLevel = 0;
    await saveIfStatus(occ, from, session);
    await changelog.record({ entity: 'AuditOccurrence', entityId: occ._id, action: 'REOPEN', before, after: { status: STATUS.PROGRAMADA }, reason, user: actor, session });
    return occ.toObject();
  });
}

// ---------------------------------------------------------------------------- validation queue

export async function validationQueue() {
  const today = todayKey();
  const [completions, reschedules] = await Promise.all([
    populateList(Occurrence.find({ status: STATUS.EN_VALIDACION }).sort({ 'completion.submittedAt': 1 }))
      .populate('completion.submittedBy', USER_FIELDS)
      .lean(),
    populateList(Occurrence.find({ 'rescheduleRequest.status': RESCHEDULE_STATUS.PENDING }).sort({ 'rescheduleRequest.requestedAt': 1 }))
      .populate('rescheduleRequest.requestedBy', USER_FIELDS)
      .lean(),
  ]);
  return { completions: completions.map((o) => decorate(o, today)), reschedules: reschedules.map((o) => decorate(o, today)) };
}
