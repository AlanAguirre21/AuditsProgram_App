import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '../../api/client.js';
import { occurrencesApi } from '../../api/occurrences.api.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Card from '../../components/ui/Card.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { qk } from '../../constants/queryKeys.js';
import OccurrenceTable from '../../features/occurrences/components/OccurrenceTable.jsx';
import { useQueryParams } from '../../hooks/useQueryParams.js';

const TABS = [
  { value: 'proximas', label: 'Próximas', filter: (o) => o.status === 'PROGRAMADA' && o.daysToDue >= 0 },
  { value: 'vencidas', label: 'Vencidas', filter: (o) => o.derived === 'VENCIDA' },
  { value: 'validacion', label: 'En validación', filter: (o) => o.status === 'EN_VALIDACION' },
  { value: 'realizadas', label: 'Realizadas', filter: (o) => ['REALIZADA', 'REALIZADA_FUERA_DE_TIEMPO'].includes(o.status) },
  { value: 'otras', label: 'Cerradas', filter: (o) => ['NO_REALIZADA', 'CANCELADA'].includes(o.status) },
];

export default function MyAuditsPage() {
  const [params, setParams] = useQueryParams();
  const tab = TABS.find((t) => t.value === params.tab) ?? TABS[0];
  const { data = [], isLoading, error } = useQuery({ queryKey: qk.myOccurrences, queryFn: () => occurrencesApi.mine() });
  const items = data.filter(tab.filter);
  const sorted = tab.value === 'realizadas' || tab.value === 'otras' ? [...items].reverse() : items;

  return (
    <>
      <PageHeader title="Mis auditorías" subtitle="Auditorías donde eres responsable o miembro del grupo responsable" />
      <div className="mb-4">
        <Tabs tabs={TABS.map((t) => ({ ...t, count: data.filter(t.filter).length }))} value={tab.value} onChange={(v) => setParams({ tab: v })} />
      </div>
      <Card bodyClassName="p-2">
        {isLoading && <FullPageSpinner />}
        {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
        {!isLoading && !error && <OccurrenceTable items={sorted} emptyTitle={`Sin auditorías ${tab.label.toLowerCase()}`} />}
      </Card>
    </>
  );
}
