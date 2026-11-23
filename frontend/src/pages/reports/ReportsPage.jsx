import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { errorMessage } from '../../api/client.js';
import { reportsApi } from '../../api/reports.api.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Card from '../../components/ui/Card.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { qk } from '../../constants/queryKeys.js';
import YearSelector from '../../features/program/components/YearSelector.jsx';
import { useAuditsMeta } from '../../features/program/hooks/useProgram.js';
import ComplianceByMonthChart from '../../features/reports/components/ComplianceByMonthChart.jsx';
import ComplianceTable from '../../features/reports/components/ComplianceTable.jsx';
import ExportButtons from '../../features/reports/components/ExportButtons.jsx';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { currentYear } from '../../utils/dates.js';
import { formatPct } from '../../utils/formatters.js';

const GROUPS = [
  { value: 'month', label: 'Por mes', header: 'Mes' },
  { value: 'category', label: 'Por tipo', header: 'Tipo' },
  { value: 'customer', label: 'Por cliente', header: 'Cliente' },
  { value: 'ownerGroup', label: 'Por grupo', header: 'Grupo' },
  { value: 'owner', label: 'Por responsable', header: 'Responsable' },
];

function Stat({ label, value, sub }) {
  return (
    <div className="glass neu-raised rounded-panel border border-white/50 bg-white/60 p-4">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-zf-blue">{value}</p>
      {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

export default function ReportsPage() {
  const [params, setParams] = useQueryParams();
  const year = Number(params.year) || currentYear();
  const group = GROUPS.find((g) => g.value === params.groupBy) ?? GROUPS[0];
  const meta = useAuditsMeta(year);
  const monthly = useQuery({ queryKey: qk.compliance(year, 'month'), queryFn: () => reportsApi.compliance(year, 'month'), placeholderData: keepPreviousData });
  const grouped = useQuery({ queryKey: qk.compliance(year, group.value), queryFn: () => reportsApi.compliance(year, group.value), placeholderData: keepPreviousData });
  const totals = monthly.data?.totals;

  return (
    <>
      <PageHeader
        title="Reportes de cumplimiento"
        subtitle="Cumplimiento a tiempo = realizadas a tiempo / exigibles. N/A cuando nada es exigible todavía."
        actions={
          <>
            <YearSelector value={year} years={meta.data?.years} onChange={(y) => setParams({ year: y })} />
            <ExportButtons year={year} />
          </>
        }
      />
      {(monthly.error || grouped.error) && <Alert tone="danger" className="mb-4">{errorMessage(monthly.error || grouped.error)}</Alert>}
      {monthly.isLoading && <FullPageSpinner />}
      {totals && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label={`Cumplimiento a tiempo ${year}`} value={formatPct(totals.onTime)} sub={`${totals.aTiempo} de ${totals.exigibles} exigibles`} />
            <Stat label={`Cumplimiento total ${year}`} value={formatPct(totals.total)} sub={`Incluye ${totals.fueraDeTiempo} fuera de tiempo`} />
            <Stat label="Programadas" value={totals.programadas} sub={`${totals.noRealizadas} no realizadas · ${totals.pendientesValidacion} en validación`} />
            <Stat label="Vencidas abiertas" value={totals.vencidas} sub="Programadas con fecha pasada" />
          </div>
          <Card title={`Cumplimiento por mes · ${year}`}>
            <ComplianceByMonthChart rows={monthly.data.rows} />
          </Card>
          <Card title="Detalle" actions={<Tabs tabs={GROUPS} value={group.value} onChange={(v) => setParams({ groupBy: v })} label="Agrupar por" />} bodyClassName="p-2">
            {grouped.data ? <ComplianceTable rows={grouped.data.rows} totals={grouped.data.totals} firstHeader={group.header} /> : <FullPageSpinner />}
          </Card>
        </div>
      )}
    </>
  );
}
