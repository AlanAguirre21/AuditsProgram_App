import { Link } from 'react-router-dom';
import es from '../../../i18n/es.js';
import { PATHS } from '../../../routes/paths.js';
import { formatPct } from '../../../utils/formatters.js';

function Tile({ label, value, sub, tone = 'text-zf-blue', to }) {
  const body = (
    <>
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
    </>
  );
  const cls = 'glass neu-raised block rounded-panel border border-white/50 bg-white/60 p-4';
  return to ? (
    <Link to={to} className={`${cls} transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** ADMIN KPI row (spec 7.6). Shows N/A instead of 0% when nothing is due. */
export default function KpiCards({ admin }) {
  const key = admin.headline === 'total' ? 'total' : 'onTime';
  const label = admin.headline === 'total' ? 'cumplimiento total' : 'cumplimiento a tiempo';
  const overdueTotal = Object.values(admin.overdueByLevel).reduce((a, b) => a + b, 0);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        label={`Acumulado ${admin.year} · ${label}`}
        value={formatPct(admin.ytd[key])}
        sub={`${admin.ytd.aTiempo} a tiempo · ${admin.ytd.fueraDeTiempo} fuera de tiempo · ${admin.ytd.exigibles} exigibles`}
        to={`${PATHS.program}?year=${admin.year}`}
      />
      <Tile
        label={`${es.monthsLong[admin.month - 1]} · ${label}`}
        value={formatPct(admin.currentMonth[key])}
        sub={`${admin.currentMonth.programadas} programadas · ${admin.currentMonth.realizadas} realizadas`}
      />
      <Tile label="Vencidas" value={overdueTotal} tone={overdueTotal ? 'text-danger' : 'text-success'} sub="Auditorías programadas con fecha pasada" />
      <Tile
        label="Pendientes de aprobación"
        value={admin.pendingValidations + admin.pendingReschedules}
        tone={admin.pendingValidations + admin.pendingReschedules ? 'text-warning' : 'text-zf-blue'}
        sub={`${admin.pendingValidations} validaciones · ${admin.pendingReschedules} reprogramaciones`}
        to={PATHS.validations}
      />
    </div>
  );
}
