import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../api/client.js';
import { groupsApi } from '../../api/groups.api.js';
import { useAuth } from '../../auth/useAuth.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Card from '../../components/ui/Card.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import { qk } from '../../constants/queryKeys.js';
import AuditFilters from '../../features/audits/components/AuditFilters.jsx';
import AuditTable from '../../features/audits/components/AuditTable.jsx';
import { useAudits } from '../../features/audits/hooks/useAudits.js';
import { useAuditsMeta } from '../../features/program/hooks/useProgram.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { PATHS } from '../../routes/paths.js';
import { currentYear } from '../../utils/dates.js';

export default function AuditListPage() {
  const { hasRole } = useAuth();
  const [params, setParams] = useQueryParams();
  const year = Number(params.year) || currentYear();
  const q = useDebounce(params.q || '', 300);
  const filters = { year, category: params.category, requiredBy: params.requiredBy, ownerGroupId: params.ownerGroupId, q: q || undefined };
  const audits = useAudits(filters);
  const meta = useAuditsMeta(year);
  const groups = useQuery({ queryKey: qk.groups({ active: true }), queryFn: () => groupsApi.list({ active: 'true' }) });

  return (
    <>
      <PageHeader
        title="Catálogo de auditorías"
        subtitle={`Programa ${year}`}
        actions={
          hasRole('ADMIN') && (
            <Link to={PATHS.auditNew} className="rounded-control bg-accent px-4 py-1.5 text-sm font-medium text-white shadow-md shadow-accent/25 hover:brightness-110">
              + Nueva auditoría
            </Link>
          )
        }
      />
      <Card className="mb-4" bodyClassName="p-4">
        <AuditFilters values={{ ...params, year }} onChange={setParams} years={meta.data?.years} customers={meta.data?.customers} groups={groups.data} />
      </Card>
      <Card bodyClassName="p-2">
        {audits.isLoading && <FullPageSpinner />}
        {audits.error && <Alert tone="danger">{errorMessage(audits.error)}</Alert>}
        {audits.data && <AuditTable items={audits.data} />}
      </Card>
    </>
  );
}
