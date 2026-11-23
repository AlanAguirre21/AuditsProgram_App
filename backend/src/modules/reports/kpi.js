/**
 * Compliance KPIs (spec 7.6). Pure: `today` is a 'YYYY-MM-DD' parameter.
 */
import { DONE_STATUSES, STATUS } from '../../constants/statuses.js';
import { effectiveDueKey } from '../occurrences/occurrence.logic.js';
import { toDateKey } from '../../utils/dates.js';

/** Integer percentage rounded half up, or null (= "N/A") when nothing is due. */
export const pct = (num, den) => (den > 0 ? Math.floor((num * 100) / den + 0.5 + 1e-9) : null);

export function computeKpis(occurrences, today) {
  const k = {
    programadas: 0,
    exigibles: 0,
    aTiempo: 0,
    fueraDeTiempo: 0,
    noRealizadas: 0,
    pendientesValidacion: 0,
    vencidas: 0,
    abiertas: 0,
  };

  for (const occ of occurrences) {
    if (occ.status === STATUS.CANCELADA) continue;
    k.programadas += 1;
    if (occ.status === STATUS.EN_VALIDACION) k.pendientesValidacion += 1;
    if (occ.status === STATUS.PROGRAMADA) {
      k.abiertas += 1;
      if (toDateKey(occ.dueDate) < today) k.vencidas += 1;
    }

    const closed = DONE_STATUSES.includes(occ.status) || occ.status === STATUS.NO_REALIZADA;
    const exigible = closed || effectiveDueKey(occ) < today;
    if (!exigible) continue;

    k.exigibles += 1;
    if (occ.status === STATUS.REALIZADA) k.aTiempo += 1;
    else if (occ.status === STATUS.REALIZADA_FUERA_DE_TIEMPO) k.fueraDeTiempo += 1;
    else if (occ.status === STATUS.NO_REALIZADA) k.noRealizadas += 1;
  }

  return {
    ...k,
    realizadas: k.aTiempo + k.fueraDeTiempo,
    onTime: pct(k.aTiempo, k.exigibles),
    total: pct(k.aTiempo + k.fueraDeTiempo, k.exigibles),
  };
}

/** Groups occurrences with `keyFn` (which may return an array of keys) and computes KPIs per group. */
export function kpisBy(occurrences, keyFn, today) {
  const buckets = new Map();
  for (const occ of occurrences) {
    const keys = [].concat(keyFn(occ) ?? []);
    for (const key of keys) {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(occ);
    }
  }
  return Object.fromEntries([...buckets.entries()].map(([key, list]) => [key, computeKpis(list, today)]));
}
