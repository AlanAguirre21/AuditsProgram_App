import { useNavigate } from 'react-router-dom';
import Badge from '../../../components/ui/Badge.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Table from '../../../components/ui/Table.jsx';
import es from '../../../i18n/es.js';
import { PATHS } from '../../../routes/paths.js';

const sum = (counts = {}) => Object.values(counts).reduce((a, b) => a + b, 0);

export default function AuditTable({ items }) {
  const navigate = useNavigate();
  const columns = [
    { key: 'code', header: '#', className: 'w-10 font-semibold text-text-muted', render: (d) => d.code },
    {
      key: 'name',
      header: 'Auditoría',
      render: (d) => (
        <div className="min-w-[220px]">
          <p className="font-medium text-text">{d.name}</p>
          <p className="text-xs text-text-muted">{d.standard}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Tipo', render: (d) => <Badge tone="accent">{es.categoriesShort[d.category]}</Badge> },
    { key: 'requiredBy', header: 'Requerido por', className: 'text-xs', render: (d) => d.requiredBy.join(', ') },
    {
      key: 'owner',
      header: 'Responsable',
      render: (d) => (
        <div className="text-xs">
          <p>{d.defaultOwnerUserId?.name}</p>
          <p className="text-text-muted">{d.ownerGroupId?.name}</p>
        </div>
      ),
    },
    {
      key: 'executor',
      header: 'Ejecuta',
      className: 'text-xs',
      render: (d) => (
        <>
          {d.executor?.name} {d.executor?.type === 'EXTERNAL' && <Badge tone="warning">Externo</Badge>}
        </>
      ),
    },
    {
      key: 'occ',
      header: 'Fechas',
      className: 'text-xs whitespace-nowrap',
      render: (d) => {
        const c = d.occurrenceCounts;
        const done = (c.REALIZADA ?? 0) + (c.REALIZADA_FUERA_DE_TIEMPO ?? 0);
        return `${done} / ${sum(c) - (c.CANCELADA ?? 0)} realizadas`;
      },
    },
  ];
  return <Table columns={columns} rows={items} onRowClick={(d) => navigate(PATHS.audit(d._id))} empty={<EmptyState title="No hay auditorías con esos filtros" />} />;
}
