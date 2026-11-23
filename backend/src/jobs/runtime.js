import os from 'node:os';
import { logger } from '../config/logger.js';
import { JobLock, JobRun } from './job.models.js';

const LOCK_TTL_MS = 30 * 60 * 1000;
const OWNER = `${os.hostname()}:${process.pid}`;

/**
 * Runs `fn` under a MongoDB lock and records the run in jobRuns.
 * Returns the JobRun document, or null if another instance holds the lock.
 * `fn` returns { processed, sent, failed, details, skipped }.
 */
export async function runJob(job, runKey, fn) {
  try {
    await JobLock.create({ _id: job, owner: OWNER, expiresAt: new Date(Date.now() + LOCK_TTL_MS) });
  } catch (err) {
    if (err?.code === 11000) {
      logger.warn({ job }, 'job is locked by another worker; skipped');
      return null;
    }
    throw err;
  }

  const run = await JobRun.create({ job, runKey, startedAt: new Date(), status: 'RUNNING' });
  try {
    const result = (await fn()) ?? {};
    run.set({
      status: result.skipped ? 'SKIPPED' : 'SUCCESS',
      processed: result.processed ?? 0,
      sent: result.sent ?? 0,
      failed: result.failed ?? 0,
      details: result.details,
      finishedAt: new Date(),
    });
    logger.info({ job, runKey, ...result.details, processed: run.processed, sent: run.sent, failed: run.failed, status: run.status }, 'job finished');
  } catch (err) {
    run.set({ status: 'FAILED', error: String(err.stack || err.message).slice(0, 2000), finishedAt: new Date() });
    logger.error({ job, runKey, err: err.message }, 'job failed');
  } finally {
    await run.save();
    await JobLock.deleteOne({ _id: job, owner: OWNER });
  }
  return run.toObject();
}

/** True if the job already completed (or was skipped) for this key. */
export const alreadyRan = async (job, runKey) => Boolean(await JobRun.exists({ job, runKey, status: { $in: ['SUCCESS', 'SKIPPED'] } }));

/** Worker status for /health: degraded if the last successful daily run is older than 26 h. */
export async function workerHealth() {
  const last = await JobRun.findOne({ job: 'daily-notifications', status: { $in: ['SUCCESS', 'SKIPPED'] } }).sort({ startedAt: -1 }).lean();
  if (!last) return { status: 'never_ran', lastRunAt: null };
  const ageH = (Date.now() - new Date(last.finishedAt ?? last.startedAt).getTime()) / 3_600_000;
  return { status: ageH > 26 ? 'degraded' : 'ok', lastRunAt: last.finishedAt ?? last.startedAt, lastRunKey: last.runKey, sent: last.sent, failed: last.failed };
}
