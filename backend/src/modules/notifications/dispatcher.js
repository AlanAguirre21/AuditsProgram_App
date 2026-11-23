/**
 * Sends one notification through the Teams notifications workflow and records it in the log.
 *
 * Workflow contract (see README):
 *   POST {TEAMS_NOTIFY_WEBHOOK_URL}   header x-api-key: {TEAMS_NOTIFY_API_TOKEN}
 *   { type, level, occurrenceId, recipient: { email, name } | null,
 *     postToChat, postToChannel, sendEmail,
 *     subject, summary, link, card (Adaptive Card 1.4),
 *     email: { to[], cc[], subject, html, text } | null, appName }
 */
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { CHANNEL } from '../../constants/notifications.js';
import { postToWorkflow } from '../../integrations/teams/workflowWebhook.js';
import { MAX_ATTEMPTS, NotificationLog } from './notificationLog.model.js';
import { toAdaptiveCard } from './templates/adaptiveCard.js';
import { toEmailHtml, toEmailText } from './templates/email.js';

export const APP_NAME = 'Programa General de Auditorías';

export function buildPayload({ type, level = 0, occurrenceId = null, channel, recipient, message, emailCopy = false, emailCc = [] }) {
  return {
    type,
    level,
    occurrenceId: occurrenceId ? String(occurrenceId) : null,
    recipient: recipient ? { email: recipient.email, name: recipient.name } : null,
    postToChat: channel === CHANNEL.TEAMS_CHAT,
    postToChannel: channel === CHANNEL.TEAMS_CHANNEL,
    sendEmail: Boolean(emailCopy && recipient),
    subject: message.subject,
    summary: message.summary,
    link: message.link ?? null,
    card: toAdaptiveCard(message),
    email:
      emailCopy && recipient
        ? { to: [recipient.email], cc: emailCc.map((u) => u.email).filter(Boolean), subject: message.subject, html: toEmailHtml(message), text: toEmailText(message) }
        : null,
    appName: APP_NAME,
  };
}

/** Calls the workflow for an existing log entry (with its payload) and stores the result. */
export async function sendLogEntry(log) {
  const update = { attempts: log.attempts + 1 };
  try {
    if (env.NOTIFICATIONS_DRY_RUN) {
      logger.info({ type: log.type, to: log.recipientAddress, subject: log.subject }, '[DRY RUN] notification not sent');
      update.dryRun = true;
    } else {
      await postToWorkflow(env.TEAMS_NOTIFY_WEBHOOK_URL, env.TEAMS_NOTIFY_API_TOKEN, log.payload);
    }
    Object.assign(update, { status: 'SENT', sentAt: new Date(), error: null });
  } catch (err) {
    Object.assign(update, { status: 'FAILED', error: String(err.message).slice(0, 500) });
    logger.warn({ type: log.type, to: log.recipientAddress, error: update.error }, 'notification failed');
  }
  await NotificationLog.updateOne({ _id: log._id }, { $set: update });
  return update.status;
}

/**
 * Logs (PENDING) and sends one notification. Returns 'SENT' | 'FAILED' | 'DUPLICATE'.
 * The unique log index makes this idempotent per occurrence/type/level/channel/recipient/date.
 */
export async function deliver({ occurrenceId = null, type, level = 0, channel, recipient, recipientAddress, dateKey, message, emailCopy = false, emailCc = [] }) {
  const payload = buildPayload({ type, level, occurrenceId, channel, recipient, message, emailCopy, emailCc });
  let log;
  try {
    log = await NotificationLog.create({
      occurrenceId,
      type,
      level,
      channel,
      recipientId: recipient?._id ?? null,
      recipientAddress: recipientAddress ?? recipient.email,
      dateKey,
      status: 'PENDING',
      subject: message.subject,
      emailCopy: payload.sendEmail,
      payload,
    });
  } catch (err) {
    if (err?.code === 11000) return 'DUPLICATE'; // already sent (or attempted) today
    throw err;
  }
  return sendLogEntry(log);
}

/** Retries FAILED entries with attempts < 3, once each (spec 8.3 retryFailed). */
export async function retryFailed({ limit = 500 } = {}) {
  const failed = await NotificationLog.find({ status: 'FAILED', attempts: { $lt: MAX_ATTEMPTS } })
    .select('+payload')
    .sort({ createdAt: 1 })
    .limit(limit);
  let sent = 0;
  for (const log of failed) if ((await sendLogEntry(log)) === 'SENT') sent += 1;
  return { retried: failed.length, sent };
}
