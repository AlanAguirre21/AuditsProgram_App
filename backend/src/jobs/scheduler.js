/**
 * Minute-tick scheduler in America/Mexico_City. Each job runs once per business key; a job whose
 * time passed while the worker was down runs on the next tick after startup (spec 8.3).
 */
import { logger } from '../config/logger.js';
import { APP_TZ, todayKey, yearOf } from '../utils/dates.js';
import { getSettings } from '../modules/settings/settings.service.js';
import { runWeeklyDigest } from './digest.job.js';
import { runDailyNotifications } from './notifications.job.js';
import { alreadyRan, runJob } from './runtime.js';
import { runYearClose } from './yearClose.job.js';

/** Current time in the app time zone: { date: 'YYYY-MM-DD', time: 'HH:mm', weekday: 0-6 }. */
export function nowInTz(now = new Date(), tz = APP_TZ) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { date: todayKey(now, tz), time: `${parts.hour}:${parts.minute}`, weekday };
}

let running = false;

export async function tick(now = new Date()) {
  if (running) return;
  running = true;
  try {
    const { date, time, weekday } = nowInTz(now);
    const settings = await getSettings();

    if (time >= settings.dailyJobTime && !(await alreadyRan('daily-notifications', date))) {
      await runJob('daily-notifications', date, () => runDailyNotifications(date));
    }

    const isDigestDay = weekday === (settings.digestDayOfWeek ?? 1);
    if (isDigestDay && time >= settings.digestTime && !(await alreadyRan('weekly-digest', date))) {
      await runJob('weekly-digest', date, () => runWeeklyDigest(date));
    }

    const closingYear = String(yearOf(date) - 1);
    if (date >= `${yearOf(date)}-01-05` && !(await alreadyRan('year-close', closingYear))) {
      await runJob('year-close', closingYear, () => runYearClose(Number(closingYear)));
    }
  } catch (err) {
    logger.error({ err: err.message }, 'scheduler tick failed');
  } finally {
    running = false;
  }
}

export function startScheduler() {
  tick();
  const timer = setInterval(tick, 60_000);
  logger.info('Scheduler started (checks every minute, America/Mexico_City)');
  return () => clearInterval(timer);
}
