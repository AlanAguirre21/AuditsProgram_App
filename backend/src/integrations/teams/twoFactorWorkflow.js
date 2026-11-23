import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export const APP_NAME = 'Programa General de Auditorías';

/**
 * Delivers a one-time code through a Teams Workflows (Power Automate) HTTP trigger.
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
    // eslint-disable-next-line no-console
    console.log(`\n[DEV 2FA] ${purpose} code for ${email}: ${code}  (valid ${expiresInMinutes} min)\n`);
    return { delivered: true, channel: 'DEV_LOG' };
  }

  const res = await fetch(env.TEAMS_2FA_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.TEAMS_2FA_API_TOKEN },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error({ status: res.status, body: text.slice(0, 300), email, purpose }, 'Teams 2FA workflow failed');
    throw new Error(`Teams workflow responded ${res.status}`);
  }
  return { delivered: true, channel: 'TEAMS' };
}
