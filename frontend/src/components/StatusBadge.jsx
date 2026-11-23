import { STATUS_STYLE } from '../constants/statuses.js';
import es from '../i18n/es.js';

/** Status badge with the Excel legend colors plus an icon and text (never color alone). */
export default function StatusBadge({ status, derived, className = '' }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.PROGRAMADA;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap ${style.badge}`}>
        <span aria-hidden="true">{style.icon}</span>
        {es.status[status] ?? status}
      </span>
      {derived === 'VENCIDA' && (
        <span className="inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white whitespace-nowrap">
          ! {es.derived.VENCIDA}
        </span>
      )}
      {derived === 'PROXIMA' && (
        <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-zf-blue ring-1 ring-inset ring-accent/20 whitespace-nowrap">
          {es.derived.PROXIMA}
        </span>
      )}
    </span>
  );
}
