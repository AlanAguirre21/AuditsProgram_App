import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { CHANNEL, DEFAULT_RULE, NOTIFICATION_TYPE as T } from '../../constants/notifications.js';
import { AppError } from '../../utils/AppError.js';
import { daysToDue, todayKey } from '../../utils/dates.js';
import { pageMeta, parsePagination } from '../../utils/pagination.js';
import * as changelog from '../changelog/changelog.service.js';
import { Occurrence } from '../occurrences/occurrence.model.js';
import { getSettings } from '../settings/settings.service.js';
import { User } from '../users/user.model.js';
import { deliver, sendLogEntry } from './dispatcher.js';
import { MAX_ATTEMPTS, NotificationLog } from './notificationLog.model.js';
import { NotificationRule } from './notificationRule.model.js';
import { buildMessage } from './templates/messages.js';

const USER_FIELDS = 'name email active notificationPrefs managerId';

// ---------------------------------------------------------------------------- rules

export async function getDefaultRule() {
  const rule = await NotificationRule.findOne({ isDefault: true }).lean();
  if (rule) return rule;
  try {
    return (await NotificationRule.create(DEFAULT_RULE)).toObject();
  } catch (err) {
    if (err?.code === 11000) return NotificationRule.findOne({ isDefault: true }).lean();
    throw err;
  }
}

export async function listRules() {
  await getDefaultRule();
  return NotificationRule.find().sort({ isDefault: -1, name: 1 }).lean();
}

function assertLevels(levels = []) {
  const seen = new Set();
  for (const l of levels) {
    if (seen.has(l.level)) throw AppError.badRequest(`El nivel ${l.level} está repetido`);
    seen.add(l.level);
  }
  const sorted = [...levels].sort((a, b) => a.level - b.level);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].afterDaysOverdue < sorted[i - 1].afterDaysOverdue) throw AppError.badRequest('Cada nivel debe escalar en el mismo día o después que el anterior');
  }
}

export async function createRule(body, actor) {
  assertLevels(body.escalationLevels);
  const rule = await NotificationRule.create({ ...body, isDefault: false });
  await changelog.record({ entity: 'NotificationRule', entityId: rule._id, action: 'CREATE', after: body, user: actor });
  return rule.toObject();
}

export async function updateRule(id, patch, actor) {
  const rule = await NotificationRule.findById(id);
  if (!rule) throw AppError.notFound('Regla no encontrada');
  if (patch.escalationLevels) assertLevels(patch.escalationLevels);
  if (rule.isDefault && patch.active === false) throw AppError.conflict('La regla general no se puede desactivar');
  const d = changelog.diff(rule.toObject(), patch, Object.keys(patch));
  if (!d.changed) return rule.toObject();
  rule.set(patch);
  await rule.save();
  await changelog.record({ entity: 'NotificationRule', entityId: rule._id, action: 'UPDATE', before: d.before, after: d.after, user: actor });
  return rule.toObject();
}

/** Rule for a definition: its own active rule, otherwise the default. */
export function ruleFor(definition, rulesById, defaultRule) {
  const own = definition?.notificationRuleId ? rulesById.get(String(definition.notificationRuleId)) : null;
  return own?.active ? own : defaultRule;
}

// ---------------------------------------------------------------------------- recipients & sending

export const supervisorsQuery = () => User.find({ isQualitySupervisor: true, active: true }, USER_FIELDS).lean();

export const occurrenceLink = (occId) => `${env.appBaseUrl.replace(/\/$/, '')}/occurrences/${occId}`;
export const appLink = (path = '/') => `${env.appBaseUrl.replace(/\/$/, '')}${path}`;

/** Optional email copy: global switch + rule channel + the user's own preference. */
export const wantsEmail = (settings, rule, user) =>
  Boolean(settings.emailEnabled && (rule?.channels ?? []).includes(CHANNEL.EMAIL) && user?.notificationPrefs?.email);

/** Sends `message` to each user by Teams chat (+ optional email), and optionally to the channel. */
export async function sendToUsers({ users, message, type, level = 0, occurrenceId = null, dateKey, settings, rule, cc = [], channel = false }) {
  const results = [];
  for (const user of users) {
    results.push(
      await deliver({ occurrenceId, type, level, channel: CHANNEL.TEAMS_CHAT, recipient: user, dateKey, message, emailCopy: wantsEmail(settings, rule, user), emailCc: cc }),
    );
  }
  if (channel && settings.qualityChannelEnabled) {
    results.push(await deliver({ occurrenceId, type, level, channel: CHANNEL.TEAMS_CHANNEL, recipient: null, recipientAddress: 'teams:quality-channel', dateKey, message }));
  }
  return results;
}

async function loadOccurrence(id) {
  return Occurrence.findById(id)
    .populate('definitionId', 'code name standard requiredBy notificationRuleId')
    .populate('ownerUserId', USER_FIELDS)
    .populate('ownerGroupId', 'name')
    .populate('completion.submittedBy', 'name')
    .populate('rescheduleRequest.requestedBy', 'name')
    .lean();
}

// ---------------------------------------------------------------------------- event notifications (spec 8.4)

const pending = new Set();

/** Runs a notification after the API response without blocking it; failures are only logged. */
function queue(fn) {
  const p = fn()
    .catch((err) => logger.error({ err: err.message }, 'event notification failed'))
    .finally(() => pending.delete(p));
  pending.add(p);
}

/** Waits for queued event notifications (tests and graceful shutdown). */
export const flushNotifications = () => Promise.all([...pending]);

/**
 * Event notification for one occurrence.
 * VALIDATION_REQUEST / RESCHEDULE_REQUEST → quality supervisors; *_RESULT → owner.
 */
export function notifyEvent(type, occurrenceId, extra = {}) {
  queue(async () => {
    const [occ, settings, rule] = await Promise.all([loadOccurrence(occurrenceId), getSettings(), getDefaultRule()]);
    if (!occ) return;
    const toSupervisors = type === T.VALIDATION_REQUEST || type === T.RESCHEDULE_REQUEST;
    const users = toSupervisors ? await supervisorsQuery() : [occ.ownerUserId].filter((u) => u?.active);
    const message = buildMessage(type, { occ, daysToDue: daysToDue(occ.dueDate, todayKey()), link: occurrenceLink(occ._id), ...extra });
    await sendToUsers({ users, message, type, occurrenceId: occ._id, dateKey: new Date().toISOString(), settings, rule });
  });
}

/** BR-51 / spec 8.4: the new owner gets one message listing the reassigned occurrences. */
export function notifyReassigned(toUserId, occurrenceIds, reason) {
  if (!occurrenceIds.length) return;
  queue(async () => {
    const [user, settings, rule, occs] = await Promise.all([
      User.findById(toUserId, USER_FIELDS).lean(),
      getSettings(),
      getDefaultRule(),
      Occurrence.find({ _id: { $in: occurrenceIds } }).populate('definitionId', 'code name').sort({ dueDate: 1 }).lean(),
    ]);
    if (!user?.active) return;
    const link = occs.length === 1 ? occurrenceLink(occs[0]._id) : appLink('/my-audits');
    const message = buildMessage(T.REASSIGNED, { occurrences: occs, reason, link });
    await sendToUsers({ users: [user], message, type: T.REASSIGNED, occurrenceId: occs.length === 1 ? occs[0]._id : null, dateKey: new Date().toISOString(), settings, rule });
  });
}

/** POST /notifications/test: a test card (and email copy if enabled) to the caller. */
export async function sendTest(user, { channel = false } = {}) {
  const [settings, rule] = await Promise.all([getSettings(), getDefaultRule()]);
  const fresh = await User.findById(user._id, USER_FIELDS).lean();
  const message = buildMessage(T.TEST, { recipientName: fresh.name, link: appLink('/') });
  // The test honors the email switches (global + personal) so an email copy can be checked too.
  const [chat, channelResult] = await sendToUsers({ users: [fresh], message, type: T.TEST, dateKey: new Date().toISOString(), settings, rule: { channels: [...rule.channels, CHANNEL.EMAIL] }, channel });
  return {
    chat,
    channel: channel ? channelResult ?? 'DISABLED' : null,
    emailCopy: wantsEmail(settings, { channels: [CHANNEL.EMAIL] }, fresh),
    dryRun: env.NOTIFICATIONS_DRY_RUN,
    configured: Boolean(env.TEAMS_NOTIFY_WEBHOOK_URL),
  };
}

// ---------------------------------------------------------------------------- log

export async function listLog(query) {
  const pg = parsePagination(query, { defaultSort: '-createdAt', defaultLimit: 50 });
  const filter = {};
  for (const k of ['status', 'type', 'occurrenceId', 'recipientId', 'channel']) if (query[k]) filter[k] = query[k];
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) filter.createdAt.$lte = new Date(`${query.to}T23:59:59.999Z`);
  }
  const [items, total] = await Promise.all([
    NotificationLog.find(filter)
      .sort(pg.sort)
      .skip(pg.skip)
      .limit(pg.limit)
      .populate('recipientId', 'name email')
      .populate({ path: 'occurrenceId', select: 'definitionId dueDate', populate: { path: 'definitionId', select: 'code name' } })
      .lean(),
    NotificationLog.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(pg, total) };
}

export async function forOccurrence(occurrenceId) {
  return NotificationLog.find({ occurrenceId }).sort({ createdAt: -1 }).populate('recipientId', 'name email').lean();
}

/** Manual retry from the log page (ADMIN); allowed for FAILED entries regardless of attempts. */
export async function retry(id) {
  const log = await NotificationLog.findById(id).select('+payload');
  if (!log) throw AppError.notFound('Notificación no encontrada');
  if (log.status !== 'FAILED') throw AppError.conflict('Solo se pueden reintentar notificaciones fallidas');
  await sendLogEntry(log);
  return NotificationLog.findById(id).lean();
}

export { MAX_ATTEMPTS };
