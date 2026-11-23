/** Weekly digest for the quality supervisors (spec 8.6). */
import { NOTIFICATION_TYPE as T } from '../constants/notifications.js';
import { OPEN_STATUSES, RESCHEDULE_STATUS, STATUS } from '../constants/statuses.js';
import { addDays, monthOf, parseDateKey, toDateKey, todayKey, yearOf } from '../utils/dates.js';
import { NotificationLog } from '../modules/notifications/notificationLog.model.js';
import { appLink, getDefaultRule, sendToUsers, supervisorsQuery } from '../modules/notifications/notifications.service.js';
import { buildMessage } from '../modules/notifications/templates/messages.js';
import { Occurrence } from '../modules/occurrences/occurrence.model.js';
import { computeKpis } from '../modules/reports/kpi.js';
import { getSettings } from '../modules/settings/settings.service.js';
import { User } from '../modules/users/user.model.js';

const populate = (q) => q.populate('definitionId', 'code name').populate('ownerUserId', 'name').sort({ dueDate: 1 }).lean();

export async function buildDigestData(today = todayKey()) {
  const year = yearOf(today);
  const todayDate = parseDateKey(today);
  const [overdue, upcoming, pendingValidations, pendingReschedules, yearOccs, failedNotifications, inactive] = await Promise.all([
    populate(Occurrence.find({ status: STATUS.PROGRAMADA, dueDate: { $lt: todayDate } })),
    populate(Occurrence.find({ status: STATUS.PROGRAMADA, dueDate: { $gte: todayDate, $lte: parseDateKey(addDays(today, 14)) } })),
    populate(Occurrence.find({ status: STATUS.EN_VALIDACION })),
    populate(Occurrence.find({ 'rescheduleRequest.status': RESCHEDULE_STATUS.PENDING })),
    Occurrence.find({ year }, { status: 1, dueDate: 1, originalDueDate: 1, evaluateAgainstOriginal: 1 }).lean(),
    NotificationLog.countDocuments({ status: 'FAILED', createdAt: { $gte: new Date(Date.now() - 7 * 86_400_000) } }),
    User.find({ active: false }, { name: 1 }).lean(),
  ]);

  const overdueByLevel = { 0: [], 1: [], 2: [], 3: [] };
  for (const o of overdue) overdueByLevel[o.lastEscalationLevel ?? 0].push(o);

  const inactiveOwners = [];
  if (inactive.length) {
    const counts = await Occurrence.aggregate([
      { $match: { ownerUserId: { $in: inactive.map((u) => u._id) }, status: { $in: OPEN_STATUSES } } },
      { $group: { _id: '$ownerUserId', count: { $sum: 1 } } },
    ]);
    for (const c of counts) inactiveOwners.push({ name: inactive.find((u) => String(u._id) === String(c._id))?.name, count: c.count });
  }

  const month = monthOf(today);
  return {
    today,
    year,
    overdueByLevel,
    upcoming,
    pendingValidations,
    pendingReschedules,
    ytd: computeKpis(yearOccs, today),
    month: computeKpis(yearOccs.filter((o) => monthOf(toDateKey(o.dueDate)) === month), today),
    failedNotifications,
    inactiveOwners,
  };
}

export async function runWeeklyDigest(today = todayKey()) {
  const [settings, rule, supervisors, digest] = await Promise.all([getSettings(), getDefaultRule(), supervisorsQuery(), buildDigestData(today)]);
  const message = buildMessage(T.DIGEST, { digest, link: appLink(`/program?year=${digest.year}`) });
  const results = await sendToUsers({ users: supervisors, message, type: T.DIGEST, dateKey: today, settings, rule, channel: true });
  return {
    processed: supervisors.length,
    sent: results.filter((r) => r === 'SENT').length,
    failed: results.filter((r) => r === 'FAILED').length,
    details: { today, recipients: supervisors.length },
  };
}
