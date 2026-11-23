import { withTransaction } from '../../config/db.js';
import { OPEN_STATUSES, STATUS, TERMINAL_STATUSES } from '../../constants/statuses.js';
import { AppError } from '../../utils/AppError.js';
import { lastWorkingDayOfMonth, monthOf, parseDateKey, toDateKey, todayKey, yearOf } from '../../utils/dates.js';
import { escapeRegex } from '../../utils/pagination.js';
import { nonWorkingSet } from '../calendar/calendar.service.js';
import * as changelog from '../changelog/changelog.service.js';
import { Group } from '../groups/group.model.js';
import { decorate } from '../occurrences/occurrence.logic.js';
import { Occurrence } from '../occurrences/occurrence.model.js';
import { User } from '../users/user.model.js';
import { AuditDefinition } from './auditDefinition.model.js';

const USER_FIELDS = 'name email department active';

export async function list(query = {}) {
  const filter = {};
  if (query.year) filter.year = query.year;
  if (query.category) filter.category = query.category;
  if (query.requiredBy) filter.requiredBy = query.requiredBy;
  if (query.ownerGroupId) filter.ownerGroupId = query.ownerGroupId;
  filter.active = query.active ?? true;
  if (query.q) {
    const rx = { $regex: escapeRegex(query.q), $options: 'i' };
    filter.$or = [{ name: rx }, { standard: rx }, { requiredBy: rx }];
  }
  const defs = await AuditDefinition.find(filter)
    .sort({ year: -1, code: 1 })
    .populate('ownerGroupId', 'name')
    .populate('defaultOwnerUserId', USER_FIELDS)
    .lean();

  const counts = await Occurrence.aggregate([
    { $match: { definitionId: { $in: defs.map((d) => d._id) } } },
    { $group: { _id: { def: '$definitionId', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const byDef = {};
  for (const c of counts) {
    const k = String(c._id.def);
    byDef[k] ??= {};
    byDef[k][c._id.status] = c.n;
  }
  return defs.map((d) => ({ ...d, occurrenceCounts: byDef[String(d._id)] ?? {} }));
}

export async function distinctCustomers(year) {
  const values = await AuditDefinition.distinct('requiredBy', year ? { year } : {});
  return values.filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
}

export async function distinctYears() {
  const years = await AuditDefinition.distinct('year');
  return years.sort((a, b) => b - a);
}

export async function getById(id) {
  const def = await AuditDefinition.findById(id)
    .populate('ownerGroupId', 'name leaderId')
    .populate('defaultOwnerUserId', USER_FIELDS)
    .lean();
  if (!def) throw AppError.notFound('Auditoría no encontrada');
  const occs = await Occurrence.find({ definitionId: def._id }).sort({ dueDate: 1 }).populate('ownerUserId', USER_FIELDS).lean();
  const today = todayKey();
  return { ...def, occurrences: occs.map((o) => decorate(o, today)) };
}

async function assertRefs({ ownerGroupId, defaultOwnerUserId }, session) {
  if (ownerGroupId) {
    const g = await Group.findById(ownerGroupId).session(session ?? null).lean();
    if (!g || !g.active) throw AppError.badRequest('El grupo responsable no existe o está inactivo');
  }
  if (defaultOwnerUserId) {
    const u = await User.findById(defaultOwnerUserId).session(session ?? null).lean();
    if (!u || !u.active) throw AppError.badRequest('El responsable no existe o está inactivo');
  }
}

/**
 * Converts the request's `dueDates` (YYYY-MM-DD) and/or `months` (1-12, BR-01 → last working day)
 * into due date keys for the given year.
 */
async function resolveDueDates(year, { dueDates = [], months = [] }) {
  const keys = [...dueDates];
  if (months.length) {
    const nw = await nonWorkingSet([year]);
    for (const m of months) keys.push(lastWorkingDayOfMonth(year, m, nw));
  }
  for (const k of keys) {
    if (yearOf(k) !== year) throw AppError.badRequest(`La fecha ${k} no pertenece al programa ${year}`); // BR-05
  }
  return [...new Set(keys)].sort();
}

/** BR-04: at most one (non-cancelled) occurrence per definition and month, unless forced. */
async function assertNoMonthDuplicates(def, keys, force, session) {
  const existing = await Occurrence.find({ definitionId: def._id, status: { $ne: STATUS.CANCELADA } }, { dueDate: 1 })
    .session(session ?? null)
    .lean();
  const taken = new Set(existing.map((o) => monthOf(toDateKey(o.dueDate))));
  const duplicates = [];
  for (const k of keys) {
    const m = monthOf(k);
    if (taken.has(m)) duplicates.push(k);
    taken.add(m);
  }
  if (duplicates.length && !force) {
    throw AppError.duplicate('Ya existe una auditoría programada en ese mes. Confirma para crearla de todos modos.', { duplicates });
  }
}

export async function createOccurrences(def, keys, actor, { force = false, session, system = false, extra = () => ({}) } = {}) {
  await assertNoMonthDuplicates(def, keys, force, session);
  const docs = keys.map((k) => ({
    definitionId: def._id,
    year: def.year,
    dueDate: parseDateKey(k),
    originalDueDate: parseDateKey(k), // BR-02
    ownerUserId: def.defaultOwnerUserId, // BR-03
    ownerGroupId: def.ownerGroupId,
    ...extra(k),
  }));
  const created = await Occurrence.insertMany(docs, { session });
  for (const occ of created) {
    await changelog.record({
      entity: 'AuditOccurrence',
      entityId: occ._id,
      action: 'CREATE',
      after: { definitionId: def._id, dueDate: toDateKey(occ.dueDate), status: occ.status, ownerUserId: occ.ownerUserId },
      user: actor,
      system,
      session,
    });
  }
  return created;
}

export async function create(body, actor) {
  const { occurrences = [], months = [], force, ...data } = body;
  return withTransaction(async (session) => {
    await assertRefs(data, session);
    if (await AuditDefinition.exists({ year: data.year, code: data.code }).session(session ?? null)) {
      throw AppError.duplicate(`Ya existe la auditoría #${data.code} en el programa ${data.year}`);
    }
    const [def] = await AuditDefinition.create([data], { session });
    await changelog.record({ entity: 'AuditDefinition', entityId: def._id, action: 'CREATE', after: data, user: actor, session });

    const keys = await resolveDueDates(def.year, { dueDates: occurrences.map((o) => o.dueDate), months });
    const created = keys.length ? await createOccurrences(def, keys, actor, { force, session }) : [];
    return { ...def.toObject(), occurrences: created.map((o) => o.toObject()) };
  });
}

export async function addOccurrences(id, { dueDates = [], months = [], force }, actor) {
  return withTransaction(async (session) => {
    const def = await AuditDefinition.findById(id).session(session ?? null);
    if (!def || !def.active) throw AppError.notFound('Auditoría no encontrada o inactiva');
    const keys = await resolveDueDates(def.year, { dueDates, months });
    if (!keys.length) throw AppError.badRequest('Indica al menos una fecha o mes');
    const created = await createOccurrences(def, keys, actor, { force, session });
    return created.map((o) => o.toObject());
  });
}

const EDITABLE = [
  'code',
  'category',
  'name',
  'standard',
  'requiredBy',
  'ownerGroupId',
  'defaultOwnerUserId',
  'executor',
  'evidenceRequired',
  'requiresValidation',
  'folderPath',
  'notes',
];

export async function update(id, body, actor) {
  const { propagateOwner = false, reason, ...patch } = body;
  return withTransaction(async (session) => {
    const def = await AuditDefinition.findById(id).session(session ?? null);
    if (!def) throw AppError.notFound('Auditoría no encontrada');
    await assertRefs(patch, session);
    if (patch.code && patch.code !== def.code && (await AuditDefinition.exists({ year: def.year, code: patch.code }).session(session ?? null))) {
      throw AppError.duplicate(`Ya existe la auditoría #${patch.code} en el programa ${def.year}`);
    }

    const update = Object.fromEntries(Object.entries(patch).filter(([k]) => EDITABLE.includes(k)));
    const d = changelog.diff(def.toObject(), update, Object.keys(update));
    if (!d.changed) return def.toObject();

    def.set(update);
    await def.save({ session });
    await changelog.record({ entity: 'AuditDefinition', entityId: def._id, action: 'UPDATE', before: d.before, after: d.after, reason, user: actor, session });

    // Group changes always follow to open occurrences; owner changes only when asked.
    const occSet = {};
    if ('ownerGroupId' in d.after) occSet.ownerGroupId = def.ownerGroupId;
    if ('defaultOwnerUserId' in d.after && propagateOwner) occSet.ownerUserId = def.defaultOwnerUserId;
    if (Object.keys(occSet).length) {
      const open = await Occurrence.find({ definitionId: def._id, status: { $in: OPEN_STATUSES } }).session(session ?? null);
      for (const occ of open) {
        const before = { ownerUserId: occ.ownerUserId, ownerGroupId: occ.ownerGroupId };
        occ.set(occSet);
        await occ.save({ session });
        await changelog.record({
          entity: 'AuditOccurrence',
          entityId: occ._id,
          action: 'REASSIGN',
          before,
          after: { ownerUserId: occ.ownerUserId, ownerGroupId: occ.ownerGroupId },
          reason: reason || 'Cambio de responsable en la definición de la auditoría',
          user: actor,
          session,
        });
      }
    }
    return def.toObject();
  });
}

export async function remove(id, actor) {
  const def = await AuditDefinition.findById(id);
  if (!def) throw AppError.notFound('Auditoría no encontrada');
  const open = await Occurrence.countDocuments({ definitionId: def._id, status: { $nin: TERMINAL_STATUSES } });
  if (open > 0) {
    throw AppError.conflict(`La auditoría tiene ${open} fecha(s) abiertas. Ciérralas o cancélalas antes de desactivarla.`);
  }
  def.active = false;
  await def.save();
  await changelog.record({ entity: 'AuditDefinition', entityId: def._id, action: 'DELETE', before: { active: true }, after: { active: false }, user: actor });
}
