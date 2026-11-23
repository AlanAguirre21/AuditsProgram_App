import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '../../api/client.js';
import { occurrencesApi } from '../../api/occurrences.api.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Card from '../../components/ui/Card.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import { qk } from '../../constants/queryKeys.js';
import OccurrenceTable from '../../features/occurrences/components/OccurrenceTable.jsx';
import { formatDate, formatDateTime } from '../../utils/dates.js';

const completionCols = [
  {
    key: 'submitted',
    header: 'Registrada',
    render: (o) => (
      <div className="text-xs">
        <p>Realizada el {formatDate(o.completion?.performedAt)}</p>
        <p className="text-text-muted">
          por {o.completion?.submittedBy?.name} · {formatDateTime(o.completion?.submittedAt)}
        </p>
      </div>
    ),
  },
];

const rescheduleCols = [
  {
    key: 'request',
    header: 'Solicitud',
    render: (o) => (
      <div className="max-w-xs text-xs">
        <p>
          {formatDate(o.dueDate)} → <strong>{formatDate(o.rescheduleRequest?.requestedDate)}</strong>
        </p>
        <p className="text-text-muted">
          {o.rescheduleRequest?.requestedBy?.name}: “{o.rescheduleRequest?.reason}”
        </p>
      </div>
    ),
  },
];

/** Completions and reschedule requests waiting for an ADMIN. Actions happen on the detail page. */
export default function ValidationQueuePage() {
  const { data, isLoading, error } = useQuery({ queryKey: qk.validations, queryFn: occurrencesApi.validations });
  if (isLoading) return <FullPageSpinner />;
  if (error) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  return (
    <>
      <PageHeader title="Validaciones" subtitle="Abre cada auditoría para revisar la evidencia y validar o rechazar" />
      <div className="space-y-5">
        <Card title={`Registros por validar (${data.completions.length})`} bodyClassName="p-2">
          <OccurrenceTable items={data.completions} extra={completionCols} emptyTitle="No hay registros por validar" />
        </Card>
        <Card title={`Solicitudes de reprogramación (${data.reschedules.length})`} bodyClassName="p-2">
          <OccurrenceTable items={data.reschedules} extra={rescheduleCols} emptyTitle="No hay solicitudes pendientes" />
        </Card>
      </div>
    </>
  );
}
