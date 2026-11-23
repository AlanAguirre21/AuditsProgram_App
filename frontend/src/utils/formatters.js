import es from '../i18n/es.js';

/** KPI percentage; null means "nothing due yet" and is shown as N/A, never 0%. */
export const formatPct = (value) => (value == null ? es.common.na : `${value}%`);

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export const roleLabels = (roles = []) => roles.map((r) => es.roles[r] ?? r).join(', ');
