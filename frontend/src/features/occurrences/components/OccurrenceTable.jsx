import { useNavigate } from 'react-router-dom';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Table from '../../../components/ui/Table.jsx';
import StatusBadge from '../../../components/StatusBadge.jsx';
import { PATHS } from '../../../routes/paths.js';
import { daysText, formatDate } from '../../../utils/dates.js';

/** Occurrence list; rows open the detail page. `extra` adds columns. */
export default function OccurrenceTable({ items = [], showOwner = true, emptyTitle = 'Sin auditorías', emptyMessage, extra = [] }) {
  const navigate = useNavigate();
  const columns = [
    {
      key: 'audit',
      header: 'Auditoría',
      render: (o) => (
        <div className="min-w-[200px]">
          <p className="font-medium text-text">
            <span className="text-text-muted">#{o.definitionId?.code}</span> {o.definitionId?.name}
          </p>
          <p className="text-xs text-text-muted">
            {o.definitionId?.standard} · {o.definitionId?.requiredBy?.join(', ')}
          </p>
        </div>
      ),
    },
    {
      key: 'due',
      header: 'Fecha',
      render: (o) => (
        <div className="whitespace-nowrap">
          <p>{formatDate(o.dueDate)}</p>
          {o.status === 'PROGRAMADA' && <p className={`text-xs ${o.daysToDue < 0 ? 'text-danger font-medium' : 'text-text-muted'}`}>{daysText(o.daysToDue)}</p>}
        </div>
      ),
    },
    { key: 'status', header: 'Estado', render: (o) => <StatusBadge status={o.status} derived={o.derived} /> },
    ...(showOwner
      ? [
          {
            key: 'owner',
            header: 'Responsable',
            render: (o) => (
              <div className="text-xs">
                <p className="text-text">{o.ownerUserId?.name}</p>
                <p className="text-text-muted">{o.ownerGroupId?.name}</p>
              </div>
            ),
          },
        ]
      : []),
    ...extra,
  ];
  return (
    <Table
      columns={columns}
      rows={items}
      onRowClick={(o) => navigate(PATHS.occurrence(o._id))}
      empty={<EmptyState title={emptyTitle} message={emptyMessage} />}
    />
  );
}
