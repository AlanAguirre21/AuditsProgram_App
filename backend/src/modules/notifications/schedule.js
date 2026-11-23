/**
 * Notification scheduling rules (spec 8.1–8.3). Pure functions: no database, no clock.
 * `today` is a 'YYYY-MM-DD' key in America/Mexico_City; `nonWorking` a Set of such keys.
 */
import { CHANNEL, NOTIFICATION_TYPE as T } from '../../constants/notifications.js';
import { STATUS } from '../../constants/statuses.js';
import { addDays, diffDays, isWorkingDay, previousWorkingDay, toDateKey } from '../../utils/dates.js';

const idOf = (x) => String(x?._id ?? x ?? '');

/** Days on which a reminder scheduled for `target` is actually sent (previous working day). */
const reminderSendDay = (target, nonWorking) => previousWorkingDay(target, nonWorking);

/**
 * True if `scheduled` maps to today under the "next working day" rule: it falls after the last
 * working day before today and not after today.
 */
function shiftedForwardToToday(scheduled, today, nonWorking) {
  const lastWorkingBefore = previousWorkingDay(addDays(today, -1), nonWorking);
  return scheduled > lastWorkingBefore && scheduled <= today;
}

/**
 * Returns the notifications due today for one occurrence:
 * [{ type, level, daysToDue }]. Only PROGRAMADA occurrences get anything (BR-13).
 */
export function computeActions(occ, rule, today, nonWorking = new Set()) {
  if (!occ || occ.status !== STATUS.PROGRAMADA || !rule) return [];
  if (!isWorkingDay(today, nonWorking)) return [];

  const due = toDateKey(occ.dueDate);
  const daysToDue = diffDays(today, due); // > 0 before, 0 today, < 0 overdue
  const actions = [];

  if (daysToDue > 0) {
    const offsets = [...new Set(rule.reminderOffsetsDays ?? [])].filter((o) => o > 0);
    // Several offsets can collapse onto the same working day; one reminder is enough.
    if (offsets.some((o) => reminderSendDay(addDays(due, -o), nonWorking) === today)) {
      actions.push({ type: T.REMINDER, level: 0, daysToDue });
    }
  }

  if (rule.sendOnDueDate && daysToDue >= 0 && reminderSendDay(due, nonWorking) === today) {
    // Due date on a non-working day → the "vence hoy" notice goes out the previous working day,
    // replacing any reminder that would land on the same day.
    const i = actions.findIndex((a) => a.type === T.REMINDER);
    if (i >= 0) actions.splice(i, 1);
    actions.push({ type: T.DUE_TODAY, level: 0, daysToDue });
  }

  if (daysToDue < 0) {
    const every = Math.max(1, rule.overdueRepeatEveryDays ?? 1);
    const daysOverdue = -daysToDue;
    // Scheduled overdue days: due+1, due+1+every, …  Any of them since the last working day → send today.
    for (let d = 1; d <= daysOverdue; d += every) {
      if (shiftedForwardToToday(addDays(due, d), today, nonWorking)) {
        actions.push({ type: T.OVERDUE, level: 0, daysToDue });
        break;
      }
    }

    // Escalation is cumulative and each level is sent once (lastEscalationLevel); a level that
    // was missed (non-working day, worker down) goes out on the next run.
    const last = occ.lastEscalationLevel ?? 0;
    for (const lvl of [...(rule.escalationLevels ?? [])].sort((a, b) => a.level - b.level)) {
      if (lvl.level > last && addDays(due, lvl.afterDaysOverdue) <= today) {
        actions.push({ type: T.ESCALATION, level: lvl.level, target: lvl.target, daysToDue });
      }
    }
  }
  return actions;
}

/**
 * Resolves who receives an action (spec 8.1 table). Inactive users are skipped.
 *
 * ctx: { owner, manager, group: { members[], escalationContact }, supervisors[], plantManager, rule }
 * Returns { to: User[], cc: User[], channel: boolean }.
 */
export function resolveRecipients(action, ctx) {
  const active = (u) => u && u.active !== false;
  const uniq = (list) => {
    const seen = new Set();
    return list.filter((u) => active(u) && !seen.has(idOf(u)) && seen.add(idOf(u)));
  };
  const { owner, manager, group = {}, supervisors = [], plantManager, rule = {} } = ctx;
  const channelAllowed = (rule.channels ?? []).includes(CHANNEL.TEAMS_CHANNEL);

  switch (action.type) {
    case T.REMINDER:
    case T.DUE_TODAY: {
      const to = [owner, ...(rule.includeGroupMembers ? group.members ?? [] : [])];
      return { to: uniq(to), cc: [], channel: false };
    }
    case T.OVERDUE:
      return { to: uniq([owner]), cc: [], channel: false };
    case T.ESCALATION: {
      const target = action.target ?? ['MANAGER', 'QUALITY_SUPERVISOR', 'PLANT_QUALITY_MANAGER'][action.level - 1];
      if (target === 'MANAGER') {
        // Manager → group escalation contact → quality supervisors (N2).
        const first = [manager, group.escalationContact].find(active);
        const to = first ? [first] : supervisors;
        return { to: uniq(to), cc: uniq([owner]), channel: false };
      }
      if (target === 'QUALITY_SUPERVISOR') {
        return { to: uniq(supervisors), cc: uniq([owner, manager]), channel: channelAllowed };
      }
      // PLANT_QUALITY_MANAGER, with the supervisors as fallback when it isn't configured.
      const to = active(plantManager) ? [plantManager] : supervisors;
      return { to: uniq(to), cc: uniq([owner, manager, ...supervisors]).filter((u) => !to.some((t) => idOf(t) === idOf(u))), channel: channelAllowed };
    }
    default:
      return { to: [], cc: [], channel: false };
  }
}
