/**
 * Pure occurrence rules (no database, no clock): `today` is always a 'YYYY-MM-DD' parameter.
 */
import { DERIVED, PROXIMA_WINDOW_DAYS, STATUS } from '../../constants/statuses.js';
import { daysToDue, toDateKey } from '../../utils/dates.js';

/** BR-33: once a reschedule was approved after the due date, the original date is the reference. */
export const effectiveDueKey = (occ) => toDateKey(occ.evaluateAgainstOriginal ? occ.originalDueDate : occ.dueDate);

export function derivedState(occ, today) {
  if (occ.status !== STATUS.PROGRAMADA) return null;
  const days = daysToDue(occ.dueDate, today);
  if (days < 0) return DERIVED.VENCIDA;
  if (days <= PROXIMA_WINDOW_DAYS) return DERIVED.PROXIMA;
  return null;
}

/** BR-14: final status from performedAt vs the (effective) due date. */
export function completionStatus(occ, performedKey) {
  return toDateKey(performedKey) <= effectiveDueKey(occ) ? STATUS.REALIZADA : STATUS.REALIZADA_FUERA_DE_TIEMPO;
}

/** Fields added to every occurrence sent to the client. */
export function decorate(occ, today) {
  return {
    ...occ,
    derived: derivedState(occ, today),
    daysToDue: daysToDue(occ.dueDate, today),
    rescheduled: (occ.rescheduleHistory?.length ?? 0) > 0,
  };
}
