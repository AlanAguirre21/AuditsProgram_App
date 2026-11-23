import { CATEGORIES } from '../../constants/auditCategories.js';
import { MONTH_ABBR_ES, monthOf, toDateKey, todayKey } from '../../utils/dates.js';
import { Occurrence } from '../occurrences/occurrence.model.js';
import { getSettings } from '../settings/settings.service.js';
import { computeKpis, kpisBy } from './kpi.js';

const CATEGORY_ES = { SISTEMA_CALIDAD: 'Sistema de Calidad', CSR: 'CSR', PROCESOS: 'Procesos' };

const GROUPERS = {
  month: { key: (o) => String(monthOf(toDateKey(o.dueDate))), label: (k) => MONTH_ABBR_ES[Number(k) - 1], order: (a, b) => Number(a.key) - Number(b.key) },
  category: { key: (o) => o.definitionId?.category, label: (k) => CATEGORY_ES[k] ?? k, order: (a, b) => CATEGORIES.indexOf(a.key) - CATEGORIES.indexOf(b.key) },
  customer: { key: (o) => o.definitionId?.requiredBy ?? [], label: (k) => k, order: (a, b) => b.programadas - a.programadas || a.label.localeCompare(b.label, 'es') },
  ownerGroup: { key: (o) => o.ownerGroupId?.name ?? '—', label: (k) => k, order: (a, b) => a.label.localeCompare(b.label, 'es') },
  owner: { key: (o) => o.ownerUserId?.name ?? '—', label: (k) => k, order: (a, b) => a.label.localeCompare(b.label, 'es') },
};
export const GROUP_BY = Object.keys(GROUPERS);

/** GET /reports/compliance — KPIs (spec 7.6) grouped by month, category, customer, group or owner. */
export async function compliance(year, groupBy = 'month') {
  const today = todayKey();
  const [occs, settings] = await Promise.all([
    Occurrence.find({ year }, { status: 1, dueDate: 1, originalDueDate: 1, evaluateAgainstOriginal: 1, definitionId: 1, ownerUserId: 1, ownerGroupId: 1 })
      .populate('definitionId', 'category requiredBy')
      .populate('ownerUserId', 'name')
      .populate('ownerGroupId', 'name')
      .lean(),
    getSettings(),
  ]);
  const g = GROUPERS[groupBy];
  const byKey = kpisBy(occs, g.key, today);
  if (groupBy === 'month') for (let m = 1; m <= 12; m++) byKey[String(m)] ??= computeKpis([], today);
  const rows = Object.entries(byKey)
    .map(([key, k]) => ({ key, label: g.label(key), ...k }))
    .sort(g.order);
  return { year, groupBy, today, headline: settings.lateCompletionCountsAsCompliant ? 'total' : 'onTime', rows, totals: computeKpis(occs, today) };
}
