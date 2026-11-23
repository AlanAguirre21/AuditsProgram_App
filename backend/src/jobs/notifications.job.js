/**
 * Daily reminders, overdue notices and escalations (spec 8.3).
 */
import { NOTIFICATION_TYPE as T } from '../constants/notifications.js';
import { STATUS } from '../constants/statuses.js';
import { isWorkingDay, todayKey, yearOf } from '../utils/dates.js';
import { nonWorkingSet } from '../modules/calendar/calendar.service.js';
import * as changelog from '../modules/changelog/changelog.service.js';
import { retryFailed } from '../modules/notifications/dispatcher.js';
import { NotificationLog } from '../modules/notifications/notificationLog.model.js';
import { NotificationRule } from '../modules/notifications/notificationRule.model.js';
import { getDefaultRule, occurrenceLink, ruleFor, sendToUsers, supervisorsQuery } from '../modules/notifications/notifications.service.js';
import { computeActions, resolveRecipients } from '../modules/notifications/schedule.js';
import { buildMessage } from '../modules/notifications/templates/messages.js';
import { Occurrence } from '../modules/occurrences/occurrence.model.js';
import { getSettings } from '../modules/settings/settings.service.js';
import { User } from '../modules/users/user.model.js';

const USER_FIELDS = 'name email active notificationPrefs managerId';

async function escalationHistory(occurrenceId) {
  const logs = await NotificationLog.find({ occurrenceId, type: T.ESCALATION, channel: 'TEAMS_CHAT' }, { level: 1, sentAt: 1, createdAt: 1, recipientAddress: 1 })
    .sort({ level: 1, createdAt: 1 })
    .lean();
  return logs.map((l) => ({ level: l.level, at: l.sentAt ?? l.createdAt, to: l.recipientAddress }));
}

/** @param today 'YYYY-MM-DD' (injectable to run the job "as of" a fixed date) */
export async function runDailyNotifications(today = todayKey()) {
  const year = yearOf(today);
  const nonWorking = await nonWorkingSet([year - 1, year, year + 1]);
  if (!isWorkingDay(today, nonWorking)) return { skipped: true, details: { reason: 'non-working day', today } };

  const [settings, defaultRule, rules, supervisors] = await Promise.all([getSettings(), getDefaultRule(), NotificationRule.find().lean(), supervisorsQuery()]);
  const rulesById = new Map(rules.map((r) => [String(r._id), r]));
  const plantManager = settings.plantQualityManagerId ? await User.findById(settings.plantQualityManagerId, USER_FIELDS).lean() : null;

  const occs = await Occurrence.find({ status: STATUS.PROGRAMADA, year: { $in: [year, year - 1] } })
    .populate('definitionId', 'code name standard requiredBy notificationRuleId active')
    .populate('ownerUserId', USER_FIELDS)
    .populate({ path: 'ownerGroupId', select: 'name memberIds escalationContactId', populate: [{ path: 'memberIds', select: USER_FIELDS }, { path: 'escalationContactId', select: USER_FIELDS }] })
    .lean();

  const managerIds = [...new Set(occs.map((o) => o.ownerUserId?.managerId).filter(Boolean).map(String))];
  const managers = new Map((await User.find({ _id: { $in: managerIds } }, USER_FIELDS).lean()).map((u) => [String(u._id), u]));

  const totals = { processed: occs.length, sent: 0, failed: 0, duplicates: 0, escalated: 0 };
  const count = (results) => {
    for (const r of results) {
      if (r === 'SENT') totals.sent += 1;
      else if (r === 'FAILED') totals.failed += 1;
      else if (r === 'DUPLICATE') totals.duplicates += 1;
    }
  };

  for (const occ of occs) {
    const rule = ruleFor(occ.definitionId, rulesById, defaultRule);
    const actions = computeActions(occ, rule, today, nonWorking);
    if (!actions.length) continue;

    const owner = occ.ownerUserId;
    const ctx = {
      owner,
      manager: owner?.managerId ? managers.get(String(owner.managerId)) : null,
      group: { members: occ.ownerGroupId?.memberIds ?? [], escalationContact: occ.ownerGroupId?.escalationContactId },
      supervisors,
      plantManager,
      rule,
    };
    let maxLevel = occ.lastEscalationLevel ?? 0;

    for (const action of actions) {
      const { to, cc, channel } = resolveRecipients(action, ctx);
      const data = { occ: { ...occ, lastEscalationLevel: Math.max(maxLevel, action.level) }, daysToDue: action.daysToDue, level: action.level, link: occurrenceLink(occ._id) };
      if (action.type === T.ESCALATION) data.escalationHistory = await escalationHistory(occ._id);
      const message = buildMessage(action.type, data);
      count(await sendToUsers({ users: to, cc, channel, message, type: action.type, level: action.level, occurrenceId: occ._id, dateKey: today, settings, rule }));
      if (action.type === T.ESCALATION) maxLevel = Math.max(maxLevel, action.level);
    }

    if (maxLevel > (occ.lastEscalationLevel ?? 0)) {
      await Occurrence.updateOne({ _id: occ._id, lastEscalationLevel: { $lt: maxLevel } }, { $set: { lastEscalationLevel: maxLevel } });
      await changelog.record({
        entity: 'AuditOccurrence',
        entityId: occ._id,
        action: 'UPDATE',
        before: { lastEscalationLevel: occ.lastEscalationLevel ?? 0 },
        after: { lastEscalationLevel: maxLevel },
        reason: `Escalación automática a nivel ${maxLevel}`,
        system: true,
      });
      totals.escalated += 1;
    }
  }

  const retried = await retryFailed();
  totals.sent += retried.sent;
  return { processed: totals.processed, sent: totals.sent, failed: totals.failed, details: { today, duplicates: totals.duplicates, escalated: totals.escalated, retried: retried.retried } };
}
