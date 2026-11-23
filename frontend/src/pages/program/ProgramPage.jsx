import { useQuery } from '@tanstack/react-query';
import { groupsApi } from '../../api/groups.api.js';
import { errorMessage } from '../../api/client.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Select from '../../components/ui/Select.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import { CATEGORIES } from '../../constants/statuses.js';
import { qk } from '../../constants/queryKeys.js';
import ProgramLegend from '../../features/program/components/ProgramLegend.jsx';
import ProgramMatrix from '../../features/program/components/ProgramMatrix.jsx';
import YearSelector from '../../features/program/components/YearSelector.jsx';
import { useAuditsMeta, useProgram } from '../../features/program/hooks/useProgram.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import es from '../../i18n/es.js';
import { currentYear } from '../../utils/dates.js';

export default function ProgramPage() {
  const [params, setParams] = useQueryParams();
  const year = Number(params.year) || currentYear();
  const filters = { category: params.category, requiredBy: params.requiredBy, ownerGroupId: params.ownerGroupId };
  const program = useProgram(year, filters);
  const meta = useAuditsMeta(year);
  const groups = useQuery({ queryKey: qk.groups({ active: true }), queryFn: () => groupsApi.list({ active: 'true' }) });

  return (
    <>
      <PageHeader title={`Programa General de Auditorías ${year}`} subtitle={`Enero – Diciembre ${year}`} />
      <Card
        className="mb-4"
        bodyClassName="flex flex-wrap items-end gap-3 p-4"
      >
        <div>
          <label htmlFor="pg-year" className="mb-1 block text-xs font-medium text-text-muted">Año</label>
          <YearSelector id="pg-year" value={year} years={meta.data?.years} onChange={(y) => setParams({ year: y, requiredBy: '' })} />
        </div>
        <div className="w-56">
          <label htmlFor="pg-cat" className="mb-1 block text-xs font-medium text-text-muted">Tipo</label>
          <Select id="pg-cat" value={params.category || ''} onChange={(e) => setParams({ category: e.target.value })} placeholder={es.common.all} options={CATEGORIES.map((c) => ({ value: c, label: es.categoriesShort[c] }))} />
        </div>
        <div className="w-48">
          <label htmlFor="pg-cust" className="mb-1 block text-xs font-medium text-text-muted">Cliente / requerido por</label>
          <Select id="pg-cust" value={params.requiredBy || ''} onChange={(e) => setParams({ requiredBy: e.target.value })} placeholder={es.common.all} options={(meta.data?.customers ?? []).map((c) => ({ value: c, label: c }))} />
        </div>
        <div className="w-56">
          <label htmlFor="pg-group" className="mb-1 block text-xs font-medium text-text-muted">Grupo responsable</label>
          <Select id="pg-group" value={params.ownerGroupId || ''} onChange={(e) => setParams({ ownerGroupId: e.target.value })} placeholder={es.common.all} options={(groups.data ?? []).map((g) => ({ value: g._id, label: g.name }))} />
        </div>
      </Card>

      <Card bodyClassName="p-0" title="Matriz anual" actions={<ProgramLegend />}>
        {program.isLoading && <FullPageSpinner />}
        {program.isError && <Alert tone="danger" className="m-4">{errorMessage(program.error)}</Alert>}
        {program.data && program.data.rows.length === 0 && (
          <EmptyState title={`No hay auditorías en el programa ${year}`} message="Importa el Excel o crea auditorías desde el catálogo." />
        )}
        {program.data && program.data.rows.length > 0 && <ProgramMatrix data={program.data} />}
      </Card>
    </>
  );
}
