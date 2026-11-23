/**
 * Calendar-date helpers.
 *
 * Calendar dates (dueDate, performedAt, non-working days) are stored as UTC midnight of the
 * calendar date and handled here as `YYYY-MM-DD` keys. "Today" is computed in the app time zone
 * (America/Mexico_City), so an occurrence is overdue only after 23:59:59 local time of its due date.
 */
export const APP_TZ = 'America/Mexico_City';
const DAY_MS = 86_400_000;
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const MONTH_ABBR_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const isDateKey = (s) => typeof s === 'string' && KEY_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** 'YYYY-MM-DD' → Date at UTC midnight. */
export function parseDateKey(key) {
  if (!isDateKey(key)) throw new Error(`Invalid date key: ${key}`);
  return new Date(`${key}T00:00:00.000Z`);
}

/** Stored calendar Date (UTC midnight) → 'YYYY-MM-DD'. Accepts a key and returns it unchanged. */
export function toDateKey(date) {
  if (date == null) return null;
  if (typeof date === 'string') return isDateKey(date) ? date : new Date(date).toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

/** Today's calendar date in the app time zone. `now` is injectable for tests. */
export function todayKey(now = new Date(), tz = APP_TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export const addDays = (key, n) => toDateKey(new Date(parseDateKey(key).getTime() + n * DAY_MS));

/** Whole days from a to b (b - a). */
export const diffDays = (aKey, bKey) => Math.round((parseDateKey(bKey) - parseDateKey(aKey)) / DAY_MS);

export const yearOf = (key) => Number(toDateKey(key).slice(0, 4));
export const monthOf = (key) => Number(toDateKey(key).slice(5, 7));

export const isWeekend = (key) => {
  const d = parseDateKey(key).getUTCDay();
  return d === 0 || d === 6;
};

/** `nonWorking` is a Set of 'YYYY-MM-DD' keys. */
export const isWorkingDay = (key, nonWorking = new Set()) => !isWeekend(key) && !nonWorking.has(key);

export function lastDayOfMonth(year, month) {
  return toDateKey(new Date(Date.UTC(year, month, 0)));
}

export function lastWorkingDayOfMonth(year, month, nonWorking = new Set()) {
  let key = lastDayOfMonth(year, month);
  while (!isWorkingDay(key, nonWorking)) key = addDays(key, -1);
  return key;
}

export function previousWorkingDay(key, nonWorking = new Set()) {
  let k = key;
  while (!isWorkingDay(k, nonWorking)) k = addDays(k, -1);
  return k;
}

export function nextWorkingDay(key, nonWorking = new Set()) {
  let k = key;
  while (!isWorkingDay(k, nonWorking)) k = addDays(k, 1);
  return k;
}

/** Positive = days left, 0 = due today, negative = days overdue. */
export const daysToDue = (dueKey, today) => diffDays(today, toDateKey(dueKey));

/** Month header in the Excel style: 'ene-26'. */
export const monthLabel = (year, month) => `${MONTH_ABBR_ES[month - 1]}-${String(year).slice(-2)}`;

/** dd/mm/yyyy */
export function formatDateMx(date) {
  const key = toDateKey(date);
  if (!key) return '';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}
