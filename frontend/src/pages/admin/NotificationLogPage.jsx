import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../api/client.js';
import { notificationsApi } from '../../api/notifications.api.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Input } from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import Table from '../../components/ui/Table.jsx';
import { qk } from '../../constants/queryKeys.js';
import { CHANNEL_ES, NOTIFICATION_TYPE_ES } from '../../features/notification-rules/targets.js';
import { PATHS } from '../../routes/paths.js';
import { formatDateTime } from '../../utils/dates.js';

const STATUS = { SENT: ['success', 'Enviada'], FAILED: ['danger', 'Fallida'], PENDING: ['warning', 'Pendiente'] };

function NotificationStatus({ log }) {
  const [tone, label] = STATUS[log.status];
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={tone}>{label}</Badge>
      {log.dryRun && <Badge>Simulada</Badge>}
      {log.emailCopy && <Badge>+ correo</Badge>}
    </span>
  );
}

export default function NotificationLogPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ status: '', type: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const params = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page, limit: 50 };
  const { data, isLoading, error } = useQuery({ queryKey: qk.notificationLog(params), queryFn: () => notificationsApi.log(params), placeholderData: keepPreviousData });
  const retry = useMutation({ mutationFn: notificationsApi.retry, onSettled: () => qc.invalidateQueries({ queryKey: ['notification-log'] }) });
  const set = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };

  const columns = [
    { key: 'at', header: 'Fecha', className: 'text-xs whitespace-nowrap', render: (l) => formatDateTime(l.sentAt ?? l.createdAt) },
    {
      key: 'type',
      header: 'Tipo',
      render: (l) => (
        <div className="text-xs">
          <p className="font-medium text-text">{NOTIFICATION_TYPE_ES[l.type] ?? l.type}{l.level ? ` N${l.level}` : ''}</p>
          <p className="text-text-muted">{CHANNEL_ES[l.channel]}</p>
        </div>
      ),
    },
    { key: 'to', header: 'Destinatario', className: 'text-xs', render: (l) => (l.channel === 'TEAMS_CHANNEL' ? 'Canal de Calidad' : l.recipientId?.name ?? l.recipientAddress) },
    {
      key: 'audit',
      header: 'Auditoría',
      className: 'text-xs',
      render: (l) =>
        l.occurrenceId ? (
          <Link className="text-accent hover:underline" to={PATHS.occurrence(l.occurrenceId._id)}>
            #{l.occurrenceId.definitionId?.code} {l.occurrenceId.definitionId?.name}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (l) => (
        <div className="space-y-1">
          <NotificationStatus log={l} />
          {l.error && <p className="max-w-xs break-words text-[11px] text-danger">{l.error}</p>}
          {l.attempts > 1 && <p className="text-[11px] text-text-muted">{l.attempts} intentos</p>}
        </div>
      ),
    },
    {
      key: 'retry',
      header: '',
      className: 'text-right',
      render: (l) => l.status === 'FAILED' && (
        <Button size="sm" onClick={() => retry.mutate(l._id)} loading={retry.isPending && retry.variables === l._id}>Reintentar</Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Bitácora de notificaciones" subtitle="Todo lo enviado por Teams (y las copias por correo). Los fallos se reintentan solos hasta 3 veces." />
      <Card className="mb-4" bodyClassName="flex flex-wrap items-end gap-3 p-4">
        <div className="w-40"><Select aria-label="Estado" value={filters.status} onChange={set('status')} placeholder="Todos los estados" options={Object.entries(STATUS).map(([value, [, label]]) => ({ value, label }))} /></div>
        <div className="w-56"><Select aria-label="Tipo" value={filters.type} onChange={set('type')} placeholder="Todos los tipos" options={Object.entries(NOTIFICATION_TYPE_ES).map(([value, label]) => ({ value, label }))} /></div>
        <div><Input type="date" aria-label="Desde" value={filters.from} onChange={set('from')} /></div>
        <div><Input type="date" aria-label="Hasta" value={filters.to} onChange={set('to')} /></div>
      </Card>
      {retry.error && <Alert tone="danger" className="mb-4">{errorMessage(retry.error)}</Alert>}
      <Card bodyClassName="p-2">
        {isLoading && <FullPageSpinner />}
        {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
        {data && <Table columns={columns} rows={data.items} empty={<EmptyState title="Sin notificaciones" message="Aparecerán cuando el worker o la aplicación envíen mensajes." />} />}
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 px-3 py-2 text-xs text-text-muted">
            <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            Página {data.meta.page} de {data.meta.totalPages} · {data.meta.total} registros
            <Button size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </div>
        )}
      </Card>
    </>
  );
}
