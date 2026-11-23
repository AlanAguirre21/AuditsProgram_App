import es from '../i18n/es.js';

/** Calendar date ('YYYY-MM-DD' or ISO) → 'YYYY-MM-DD' without time-zone shifting. */
export const toKey = (value) => (value ? String(value).slice(0, 10) : '');

/** dd/mm/yyyy */
export function formatDate(value) {
  const key = toKey(value);
  if (!key) return '—';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

/** Timestamp → dd/mm/yyyy hh:mm in local time. */
export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 'ene-26' */
export const monthLabel = (year, month) => `${es.months[month - 1]}-${String(year).slice(-2)}`;

/** Today in America/Mexico_City as 'YYYY-MM-DD'. */
export const todayKey = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const currentYear = () => Number(todayKey().slice(0, 4));

export function daysText(daysToDue) {
  if (daysToDue == null) return '';
  if (daysToDue === 0) return 'Vence hoy';
  if (daysToDue > 0) return `Faltan ${daysToDue} día${daysToDue === 1 ? '' : 's'}`;
  const n = -daysToDue;
  return `Vencida hace ${n} día${n === 1 ? '' : 's'}`;
}
