import { Link } from 'react-router-dom';
import { STATUS_STYLE } from '../../../constants/statuses.js';
import es from '../../../i18n/es.js';
import { PATHS } from '../../../routes/paths.js';
import { formatDate } from '../../../utils/dates.js';

/** One month cell of the matrix: status color + icon, red ring when overdue, ↻ when rescheduled. */
export default function MonthCell({ cell, auditName }) {
  if (!cell) return <td className="border-l border-slate-100 p-0.5" />;
  const style = STATUS_STYLE[cell.status];
  const overdue = cell.derived === 'VENCIDA';
  const extra = cell.others?.length ?? 0;
  const label = `${auditName}: ${es.status[cell.status]}${overdue ? ` (${es.derived.VENCIDA})` : ''}, vence ${formatDate(cell.dueDate)}${cell.rescheduled ? ', reprogramada' : ''}${cell.ownerName ? `, responsable ${cell.ownerName}` : ''}`;

  return (
    <td className="border-l border-slate-100 p-0.5 text-center">
      <Link
        to={PATHS.occurrence(cell.occurrenceId)}
        title={label}
        aria-label={label}
        className={`relative mx-auto flex h-8 w-full min-w-9 items-center justify-center rounded-md text-sm font-bold transition-transform hover:scale-105
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${style.cell} ${overdue ? 'ring-2 ring-red-600 ring-inset' : ''}`}
      >
        <span aria-hidden="true">{style.icon}</span>
        {cell.rescheduled && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-1 text-[11px] font-bold text-zf-blue drop-shadow-[0_0_2px_white]">
            ↻
          </span>
        )}
        {cell.pendingReschedule && <span aria-hidden="true" className="absolute -left-0.5 -top-1 h-2 w-2 rounded-full bg-warning ring-1 ring-white" />}
        {extra > 0 && (
          <span aria-hidden="true" className="absolute -bottom-1 -right-0.5 rounded-full bg-zf-blue px-1 text-[9px] leading-tight text-white">
            +{extra}
          </span>
        )}
      </Link>
    </td>
  );
}
