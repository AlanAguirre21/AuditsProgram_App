import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { postToWorkflow } from './workflowWebhook.js';

export const APP_NAME = 'Programa General de Auditorías';

/**
 * Delivers a one-time code through the 2FA Teams workflow.
 *
 * Contract (the workflow must accept exactly this):
 *   POST {TEAMS_2FA_WEBHOOK_URL}
 *   Headers: Content-Type: application/json
 *            x-api-key: {TEAMS_2FA_API_TOKEN}
 *   Body:    { email, name, code, purpose: 'LOGIN' | 'PASSWORD_RESET', expiresInMinutes, appName }
 *   Success: any 2xx status.
 *
 * Without a webhook URL (development/test only) the code is written to the server log instead.
 */
export async function sendCode({ email, name, code, purpose, expiresInMinutes }) {
  const payload = { email, name, code, purpose, expiresInMinutes, appName: APP_NAME };

  if (!env.TEAMS_2FA_WEBHOOK_URL) {
    if (env.isProd) throw new Error('TEAMS_2FA_WEBHOOK_URL not configured');
    // Development fallback: the code is intentionally visible in the server console.
    console.log(`\n[DEV 2FA] ${purpose} code for ${email}: ${code}  (valid ${expiresInMinutes} min)\n`);
    return { delivered: true, channel: 'DEV_LOG' };
  }

  try {
    // No retries: the user is waiting on the login screen and can press "Reenviar".
    await postToWorkflow(env.TEAMS_2FA_WEBHOOK_URL, env.TEAMS_2FA_API_TOKEN, payload, { retry: false });
  } catch (err) {
    logger.error({ status: err.status, error: err.message, email, purpose }, 'Teams 2FA workflow failed');
    throw err;
  }
  return { delivered: true, channel: 'TEAMS' };
}
