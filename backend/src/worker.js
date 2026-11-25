/**
 * Worker process (separate PM2 app, exactly one instance — spec 11.2).
 *
 *   node src/worker.js                          → scheduler (daily job, weekly digest, year close)
 *   node src/worker.js --run daily [--date YYYY-MM-DD]
 *   node src/worker.js --run digest [--date YYYY-MM-DD]
 *   node src/worker.js --run year-close --year 2025
 */
import { parseArgs } from 'node:util';
import './models.js';
import { connectDb, disconnectDb } from './config/db.js';
import { logger } from './config/logger.js';
import { runWeeklyDigest } from './jobs/digest.job.js';
import { runDailyNotifications } from './jobs/notifications.job.js';
import { runJob } from './jobs/runtime.js';
import { startScheduler } from './jobs/scheduler.js';
import { runYearClose } from './jobs/yearClose.job.js';
import { isDateKey, todayKey } from './utils/dates.js';

const { values } = parseArgs({ options: { run: { type: 'string' }, date: { type: 'string' }, year: { type: 'string' }, demo: { type: 'boolean' } } });

await connectDb();

if (values.run) {
  const date = values.date ?? todayKey();
  if (!isDateKey(date)) {
    console.error('--date must be YYYY-MM-DD');
    process.exit(1);
  }
  const jobs = {
    daily: () => runJob('daily-notifications', date, () => runDailyNotifications(date)),
    digest: () => runJob('weekly-digest', date, () => runWeeklyDigest(date)),
    'year-close': () => runJob('year-close', values.year, () => runYearClose(Number(values.year))),
  };
  if (!jobs[values.run] || (values.run === 'year-close' && !values.year)) {
    console.error('Usage: --run daily|digest [--date YYYY-MM-DD] | --run year-close --year YYYY');
    process.exit(1);
  }
  const run = await jobs[values.run]();
  console.log(JSON.stringify(run, null, 2));
  await disconnectDb();
  process.exit(run?.status === 'FAILED' ? 1 : 0);
}

const stop = startScheduler();
const shutdown = async (signal) => {
  logger.info(`${signal} received, stopping worker`);
  stop();
  await disconnectDb();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
