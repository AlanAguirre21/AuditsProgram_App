import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import es from '../../../i18n/es.js';
import { PATHS } from '../../../routes/paths.js';
import { monthLabel } from '../../../utils/dates.js';
import { formatPct } from '../../../utils/formatters.js';
import MonthCell from './MonthCell.jsx';

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1));

function SummaryRow({ label, values, className = '', title }) {
  return (
    <tr className={`border-t border-slate-200 ${className}`}>
      <th scope="row" colSpan={4} className="sticky left-0 z-10 bg-white/95 px-3 py-1.5 text-right text-xs font-semibold text-text" title={title}>
        {label}
      </th>
      {values.map((v, i) => (
        <td key={MONTHS[i]} className="border-l border-slate-100 px-1 py-1.5 text-center text-xs font-semibold tabular-nums">
          {v}
        </td>
      ))}
      <td className="border-l border-slate-200 px-2 py-1.5" />
    </tr>
  );
}

/** Audits × months matrix with category header rows and the Excel summary rows (spec 10). */
export default function ProgramMatrix({ data, linkAudits = true }) {
  const { year, rows, summary, headline, totals } = data;
  const byCategory = rows.reduce((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});
  const pctKey = headline === 'total' ? 'total' : 'onTime';
  const s = (k) => MONTHS.map((m) => summary[m]?.[k] ?? 0);

  return (
    <div className="overflow-x-auto rounded-panel">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <caption className="sr-only">Programa general de auditorías {year}</caption>
        <thead>
          <tr className="bg-accent-soft/80 text-[11px] uppercase tracking-wide text-zf-blue">
            <th scope="col" className="sticky left-0 z-20 w-10 bg-accent-soft px-2 py-2 text-center">#</th>
            <th scope="col" className="sticky left-10 z-20 min-w-[220px] bg-accent-soft px-2 py-2 text-left">Nombre de la auditoría</th>
            <th scope="col" className="min-w-[120px] px-2 py-2 text-left">Norma / Req.</th>
            <th scope="col" className="min-w-[130px] px-2 py-2 text-left">Requerido por / Responsable</th>
            {MONTHS.map((m) => (
              <th key={m} scope="col" className="w-12 border-l border-white/70 px-1 py-2 text-center normal-case">
                {monthLabel(year, Number(m))}
              </th>
            ))}
            <th scope="col" className="border-l border-white/70 px-2 py-2 text-center">Cumpl.</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(byCategory).map(([category, list]) => (
            <Fragment key={category}>
              <tr className="bg-slate-50/90">
                <th scope="rowgroup" colSpan={17} className="sticky left-0 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zf-blue">
                  {es.categories[category] ?? category}
                </th>
              </tr>
              {list.map((r) => (
                <tr key={r.definitionId} className="border-t border-slate-100 bg-white/60 hover:bg-white/90">
                  <td className="sticky left-0 z-10 bg-white/95 px-2 py-1 text-center text-xs font-semibold text-text-muted">{r.code}</td>
                  <th scope="row" className="sticky left-10 z-10 bg-white/95 px-2 py-1 text-left font-medium">
                    {linkAudits ? (
                      <Link to={PATHS.audit(r.definitionId)} className="hover:text-accent hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )}
                  </th>
                  <td className="px-2 py-1 text-xs text-text-muted">{r.standard}</td>
                  <td className="px-2 py-1 text-xs">
                    <span className="block text-text">{r.requiredBy.join(', ')}</span>
                    <span className="block text-text-muted">{r.ownerGroup}</span>
                  </td>
                  {MONTHS.map((m) => (
                    <MonthCell key={m} cell={r.months[m]} auditName={r.name} />
                  ))}
                  <td className="border-l border-slate-200" />
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
        <tfoot className="bg-white/80">
          <SummaryRow label="Programadas" values={s('programadas')} />
          <SummaryRow label="Realizadas" values={s('realizadas')} />
          <SummaryRow label="En validación" values={s('pendientesValidacion')} className="text-yellow-800" />
          <SummaryRow
            label={headline === 'total' ? '% Cumplimiento (total)' : '% Cumplimiento (a tiempo)'}
            title="N/A = ninguna auditoría del mes es exigible todavía"
            values={MONTHS.map((m) => formatPct(summary[m]?.[pctKey]))}
            className="bg-accent-soft/50 text-zf-blue"
          />
        </tfoot>
      </table>
      <p className="px-3 py-2 text-right text-xs text-text-muted">
        Acumulado {year}: <strong className="text-text">{formatPct(totals?.[pctKey])}</strong> ({totals?.aTiempo ?? 0} a tiempo, {totals?.fueraDeTiempo ?? 0} fuera de tiempo, {totals?.exigibles ?? 0} exigibles)
      </p>
    </div>
  );
}
