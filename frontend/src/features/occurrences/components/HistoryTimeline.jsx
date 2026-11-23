import es from '../../../i18n/es.js';
import { formatDate, formatDateTime } from '../../../utils/dates.js';

const FIELD_LABELS = {
  status: 'Estado',
  dueDate: 'Fecha',
  requestedDate: 'Fecha solicitada',
  ownerUserId: 'Responsable',
  ownerGroupId: 'Grupo',
  evidenceAdded: 'Evidencia agregada',
  evidenceRemoved: 'Evidencia eliminada',
};

function describe(entry) {
  const parts = [];
  const after = entry.after ?? {};
  const before = entry.before ?? {};
  if (after.status) parts.push(`${es.status[before.status] ?? before.status ?? '—'} → ${es.status[after.status] ?? after.status}`);
  if (after.dueDate && before.dueDate) parts.push(`${formatDate(before.dueDate)} → ${formatDate(after.dueDate)}`);
  else if (after.dueDate) parts.push(`Fecha ${formatDate(after.dueDate)}`);
  if (after.requestedDate) parts.push(`Fecha solicitada ${formatDate(after.requestedDate)}`);
  if (after.evidenceAdded) parts.push(`${FIELD_LABELS.evidenceAdded}: ${[].concat(after.evidenceAdded).join(', ')}`);
  if (after.evidenceRemoved) parts.push(`${FIELD_LABELS.evidenceRemoved}: ${after.evidenceRemoved}`);
  if (after.ownerUserId && entry.action === 'REASSIGN') parts.push('Cambio de responsable');
  return parts;
}

export default function HistoryTimeline({ entries = [] }) {
  if (!entries.length) return <p className="text-sm text-text-muted">Sin movimientos registrados.</p>;
  return (
    <ol className="relative space-y-4 border-l-2 border-accent/20 pl-5">
      {entries.map((h) => (
        <li key={h._id} className="relative">
          <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-accent shadow" aria-hidden="true" />
          <p className="text-sm font-medium text-text">
            {es.changeActions[h.action] ?? h.action}
            {h.meta?.selfValidated && <span className="ml-1 text-xs text-warning">(auto-validada)</span>}
          </p>
          <p className="text-xs text-text-muted">
            {h.system ? 'Sistema' : h.userId?.name ?? '—'} · {formatDateTime(h.at)}
          </p>
          {describe(h).map((d) => (
            <p key={d} className="text-xs text-text">
              {d}
            </p>
          ))}
          {h.reason && <p className="mt-0.5 text-xs italic text-text-muted">“{h.reason}”</p>}
        </li>
      ))}
    </ol>
  );
}
