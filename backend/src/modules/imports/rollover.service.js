/**
 * Year rollover (BR-60, BR-61): clones the active definitions of `fromYear` into `toYear`, with
 * one PROGRAMADA occurrence per month the source had (same day, moved to a working day).
 */
import mongoose from 'mongoose';
import { withTransaction } from '../../config/db.js';
import { STATUS } from '../../constants/statuses.js';
import { AppError } from '../../utils/AppError.js';
import { lastDayOfMonth, lastWorkingDayOfMonth, monthOf, nextWorkingDay, parseDateKey, previousWorkingDay, toDateKey } from '../../utils/dates.js';
import { AuditDefinition } from '../audits/auditDefinition.model.js';
import { nonWorkingSet } from '../calendar/calendar.service.js';
import * as changelog from '../changelog/changelog.service.js';
import { Occurrence } from '../occurrences/occurrence.model.js';

/** Maps a due date to the same month/day in `toYear`, keeping "last working day of the month". */
export function mapDueDate(dueKey, fromYear, toYear, nwFrom, nwTo) {
  const month = monthOf(dueKey);
  if (dueKey === lastWorkingDayOfMonth(fromYear, month, nwFrom)) return lastWorkingDayOfMonth(toYear, month, nwTo);
  const day = Math.min(Number(dueKey.slice(8, 10)), Number(lastDayOfMonth(toYear, month).slice(8, 10)));
  const same = `${toYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const prev = previousWorkingDay(same, nwTo);
  return monthOf(prev) === month ? prev : nextWorkingDay(same, nwTo); // never move into another month
}

async function plan(fromYear, toYear) {
  if (toYear <= fromYear) throw AppError.badRequest('El año destino debe ser posterior al año origen');
  const [defs, existing, nwFrom, nwTo] = await Promise.all([
    AuditDefinition.find({ year: fromYear, active: true })
      .sort({ code: 1 })
      .populate('defaultOwnerUserId', 'name active')
      .populate('ownerGroupId', 'name active')
      .lean(),
    AuditDefinition.find({ year: toYear }, { code: 1 }).lean(),
    nonWorkingSet([fromYear]),
    nonWorkingSet([toYear]),
  ]);
  if (!defs.length) throw AppError.badRequest(`No hay auditorías activas en el programa ${fromYear}`);
  const existingCodes = new Set(existing.map((d) => d.code));
  const occs = await Occurrence.find({ definitionId: { $in: defs.map((d) => d._id) }, status: { $ne: STATUS.CANCELADA } }, { definitionId: 1, dueDate: 1 }).lean();

  const definitions = defs.map((d) => {
    const months = new Map();
    for (const o of occs.filter((x) => String(x.definitionId) === String(d._id))) {
      const key = toDateKey(o.dueDate);
      if (!months.has(monthOf(key))) months.set(monthOf(key), mapDueDate(key, fromYear, toYear, nwFrom, nwTo));
    }
    const warnings = [];
    if (!d.defaultOwnerUserId?.active) warnings.push('El responsable está inactivo: asigna otro después del cambio de año');
    if (!d.ownerGroupId?.active) warnings.push('El grupo responsable está inactivo');
    return {
      sourceId: d._id,
      code: d.code,
      name: d.name,
      owner: d.defaultOwnerUserId?.name,
      group: d.ownerGroupId?.name,
      dueDates: [...months.values()].sort(),
      exists: existingCodes.has(d.code),
      warnings,
    };
  });
  return { fromYear, toYear, definitions, existingInTarget: existing.length, defs };
}

export async function preview({ fromYear, toYear }) {
  const { defs: _defs, ...result } = await plan(fromYear, toYear);
  return { ...result, occurrences: result.definitions.reduce((n, d) => n + d.dueDates.length, 0) };
}

/** BR-61: fails if toYear already has definitions unless force (existing codes are then skipped). */
export async function confirm({ fromYear, toYear, force = false }, actor) {
  const p = await plan(fromYear, toYear);
  if (p.existingInTarget > 0 && !force) {
    throw AppError.conflict(`El programa ${toYear} ya tiene ${p.existingInTarget} auditoría(s). Confirma de nuevo para crear solo las que faltan.`, { existing: p.existingInTarget });
  }
  const rolloverId = new mongoose.Types.ObjectId();
  const sourceById = new Map(p.defs.map((d) => [String(d._id), d]));

  const result = await withTransaction(async (session) => {
    let definitions = 0;
    let occurrences = 0;
    for (const item of p.definitions.filter((d) => !d.exists)) {
      const src = sourceById.get(String(item.sourceId));
      const { _id, createdAt, updatedAt, __v, year: _y, ...fields } = src;
      const [def] = await AuditDefinition.create(
        [{ ...fields, year: toYear, ownerGroupId: src.ownerGroupId?._id ?? src.ownerGroupId, defaultOwnerUserId: src.defaultOwnerUserId?._id ?? src.defaultOwnerUserId }],
        { session },
      );
      const docs = item.dueDates.map((k) => ({
        definitionId: def._id,
        year: toYear,
        dueDate: parseDateKey(k),
        originalDueDate: parseDateKey(k),
        ownerUserId: def.defaultOwnerUserId,
        ownerGroupId: def.ownerGroupId,
      }));
      if (docs.length) await Occurrence.insertMany(docs, { session });
      definitions += 1;
      occurrences += docs.length;
    }
    await changelog.record({
      entity: 'Import',
      entityId: rolloverId,
      action: 'ROLLOVER',
      after: { fromYear, toYear, definitions, occurrences, skipped: p.definitions.filter((d) => d.exists).length },
      reason: `Cambio de año ${fromYear} → ${toYear}`,
      user: actor,
      session,
    });
    return { definitions, occurrences };
  });
  return { fromYear, toYear, ...result, skipped: p.definitions.filter((d) => d.exists).map((d) => d.code) };
}
