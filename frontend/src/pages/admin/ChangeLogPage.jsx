import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { changelogApi } from '../../api/changelog.api.js';
import { errorMessage } from '../../api/client.js';
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
import es from '../../i18n/es.js';
import { PATHS } from '../../routes/paths.js';
import { formatDateTime } from '../../utils/dates.js';

const short = (obj) =>
  obj && Object.keys(obj).length
    ? Object.entries(obj)
        .map(([k, v]) => `${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`)
        .join(' · ')
        .slice(0, 220)
    : '';

/** Read-only audit trail (spec 5.10). */
export default function ChangeLogPage() {
  const [filters, setFilters] = useState({ entity: '', action: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const params = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page, limit: 50 };
  const { data, isLoading, error } = useQuery({ queryKey: qk.changelog(params), queryFn: () => changelogApi.list(params), placeholderData: keepPreviousData });
  const set = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };

  const columns = [
    { key: 'at', header: 'Fecha', className: 'text-xs whitespace-nowrap', render: (h) => formatDateTime(h.at) },
    { key: 'user', header: 'Usuario', className: 'text-xs', render: (h) => (h.system ? <Badge>Sistema</Badge> : h.userId?.name ?? '—') },
    {
      key: 'what',
      header: 'Acción',
      render: (h) => (
        <div className="text-xs">
          <p className="font-medium text-text">{es.changeActions[h.action] ?? h.action}</p>
          <p className="text-text-muted">
            {h.entity === 'AuditOccurrence' ? <Link className="text-accent hover:underline" to={PATHS.occurrence(h.entityId)}>{es.entities[h.entity]}</Link> : es.entities[h.entity]}
            {h.meta?.historical && ` · Revisión ${h.meta.revision ?? ''} (Excel)`}
          </p>
        </div>
      ),
    },
    {
      key: 'detail',
      header: 'Detalle',
      className: 'text-xs max-w-md',
      render: (h) => (
        <div className="space-y-0.5 break-words">
          {short(h.before) && <p className="text-text-muted">Antes: {short(h.before)}</p>}
          {short(h.after) && <p>Después: {short(h.after)}</p>}
          {h.reason && <p className="italic">“{h.reason}”</p>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Bitácora de cambios" subtitle="Registro inalterable: usuario, fecha, antes/después y motivo de cada cambio" />
      <Card className="mb-4" bodyClassName="flex flex-wrap items-end gap-3 p-4">
        <div className="w-48"><Select aria-label="Entidad" value={filters.entity} onChange={set('entity')} placeholder="Todas las entidades" options={Object.entries(es.entities).map(([value, label]) => ({ value, label }))} /></div>
        <div className="w-60"><Select aria-label="Acción" value={filters.action} onChange={set('action')} placeholder="Todas las acciones" options={Object.entries(es.changeActions).map(([value, label]) => ({ value, label }))} /></div>
        <div><Input type="date" aria-label="Desde" value={filters.from} onChange={set('from')} /></div>
        <div><Input type="date" aria-label="Hasta" value={filters.to} onChange={set('to')} /></div>
      </Card>
      <Card bodyClassName="p-2">
        {isLoading && <FullPageSpinner />}
        {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
        {data && <Table columns={columns} rows={data.items} empty={<EmptyState title="Sin movimientos" />} />}
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
