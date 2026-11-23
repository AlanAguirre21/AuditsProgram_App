import { STATUS_STYLE, STATUSES } from '../../../constants/statuses.js';
import es from '../../../i18n/es.js';

export default function ProgramLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted" aria-label="Leyenda">
      {STATUSES.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={`flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${STATUS_STYLE[s].cell}`} aria-hidden="true">
            {STATUS_STYLE[s].icon}
          </span>
          {es.status[s]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="h-5 w-5 rounded bg-slate-300/80 ring-2 ring-red-600" aria-hidden="true" />
        {es.derived.VENCIDA}
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="font-bold text-zf-blue">↻</span>
        Reprogramada
      </li>
    </ul>
  );
}
