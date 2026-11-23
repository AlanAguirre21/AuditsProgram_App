import EmptyState from '../../../components/ui/EmptyState.jsx';
import Table from '../../../components/ui/Table.jsx';
import { formatPct } from '../../../utils/formatters.js';

/** Inline meter: the value is always printed, the bar only supports it. */
function Meter({ value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-right font-semibold tabular-nums">{formatPct(value)}</span>
      {value != null && (
        <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 sm:block" aria-hidden="true">
          <span className="block h-full rounded-full bg-[#2a78d6]" style={{ width: `${value}%` }} />
        </span>
      )}
    </div>
  );
}

/** Table view of a compliance report (also the accessible alternative to the chart). */
export default function ComplianceTable({ rows, totals, firstHeader }) {
  const columns = [
    { key: 'label', header: firstHeader, className: 'font-medium capitalize' },
    { key: 'programadas', header: 'Programadas', className: 'tabular-nums text-right', headerClassName: 'text-right' },
    { key: 'exigibles', header: 'Exigibles', className: 'tabular-nums text-right', headerClassName: 'text-right' },
    { key: 'aTiempo', header: 'A tiempo', className: 'tabular-nums text-right', headerClassName: 'text-right' },
    { key: 'fueraDeTiempo', header: 'Fuera de tiempo', className: 'tabular-nums text-right', headerClassName: 'text-right' },
    { key: 'noRealizadas', header: 'No realizadas', className: 'tabular-nums text-right', headerClassName: 'text-right' },
    { key: 'pendientesValidacion', header: 'En validación', className: 'tabular-nums text-right', headerClassName: 'text-right' },
    { key: 'vencidas', header: 'Vencidas', className: 'tabular-nums text-right', headerClassName: 'text-right', render: (r) => <span className={r.vencidas ? 'font-semibold text-danger' : ''}>{r.vencidas}</span> },
    { key: 'onTime', header: '% A tiempo', render: (r) => <Meter value={r.onTime} /> },
    { key: 'total', header: '% Total', className: 'tabular-nums font-semibold', render: (r) => formatPct(r.total) },
  ];
  const all = totals ? [...rows, { ...totals, key: '__total', label: 'Total' }] : rows;
  return <Table columns={columns} rows={all} rowKey={(r) => r.key} empty={<EmptyState title="Sin datos para este año" />} />;
}
