import { CATEGORIES } from '../../constants/auditCategories.js';
import { monthOf, toDateKey, todayKey } from '../../utils/dates.js';
import { AuditDefinition } from '../audits/auditDefinition.model.js';
import { derivedState } from '../occurrences/occurrence.logic.js';
import { Occurrence } from '../occurrences/occurrence.model.js';
import { computeKpis, kpisBy } from '../reports/kpi.js';
import { getSettings } from '../settings/settings.service.js';

const cell = (occ, today) => ({
  occurrenceId: occ._id,
  status: occ.status,
  derived: derivedState(occ, today),
  dueDate: toDateKey(occ.dueDate),
  rescheduled: (occ.rescheduleHistory?.length ?? 0) > 0,
  pendingReschedule: occ.rescheduleRequest?.status === 'PENDING',
  ownerName: occ.ownerUserId?.name,
});

/** Annual matrix payload (spec 9.2 `GET /program/:year`). */
export async function getProgram(year, { category, requiredBy, ownerGroupId } = {}) {
  const today = todayKey();
  const defFilter = { year, active: true };
  if (category) defFilter.category = category;
  if (requiredBy) defFilter.requiredBy = requiredBy;
  if (ownerGroupId) defFilter.ownerGroupId = ownerGroupId;

  const [defs, settings] = await Promise.all([
    AuditDefinition.find(defFilter).populate('ownerGroupId', 'name').populate('defaultOwnerUserId', 'name').lean(),
    getSettings(),
  ]);
  defs.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.code - b.code);

  const occs = await Occurrence.find({ definitionId: { $in: defs.map((d) => d._id) } })
    .sort({ dueDate: 1 })
    .populate('ownerUserId', 'name')
    .lean();

  const byDef = new Map();
  for (const occ of occs) {
    const k = String(occ.definitionId);
    if (!byDef.has(k)) byDef.set(k, []);
    byDef.get(k).push(occ);
  }

  const rows = defs.map((d) => {
    const months = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), null]));
    for (const occ of byDef.get(String(d._id)) ?? []) {
      const m = String(monthOf(toDateKey(occ.dueDate)));
      if (!months[m]) months[m] = { ...cell(occ, today), others: [] };
      else months[m].others.push(cell(occ, today));
    }
    return {
      definitionId: d._id,
      code: d.code,
      category: d.category,
      name: d.name,
      standard: d.standard,
      requiredBy: d.requiredBy,
      ownerGroup: d.ownerGroupId?.name ?? null,
      defaultOwner: d.defaultOwnerUserId?.name ?? null,
      executor: d.executor,
      months,
    };
  });

  const visible = occs; // only occurrences of the filtered definitions
  const summary = kpisBy(visible, (o) => String(monthOf(toDateKey(o.dueDate))), today);
  for (let m = 1; m <= 12; m++) summary[String(m)] ??= computeKpis([], today);

  return {
    year,
    today,
    headline: settings.lateCompletionCountsAsCompliant ? 'total' : 'onTime',
    rows,
    summary,
    totals: computeKpis(visible, today),
  };
}
