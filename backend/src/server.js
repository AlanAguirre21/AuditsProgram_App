import './models.js';
import { createApp } from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { ensureAdmin } from './modules/users/ensureAdmin.js';

async function main() {
  await connectDb();
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) await ensureAdmin();
  else logger.warn('ADMIN_EMAIL / ADMIN_PASSWORD are empty: the fixed admin account is not enforced.');
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}/api/v1`);
    if (!env.TEAMS_2FA_WEBHOOK_URL) logger.warn('TEAMS_2FA_WEBHOOK_URL is empty: 2FA codes are printed to this console (development only).');
    if (!env.allowedEmailDomains.length) logger.warn('ALLOWED_EMAIL_DOMAINS is empty: any email domain can register.');
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'API failed to start');
  process.exit(1);
});
