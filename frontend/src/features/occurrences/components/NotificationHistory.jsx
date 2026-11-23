import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../../../api/notifications.api.js';
import Badge from '../../../components/ui/Badge.jsx';
import { qk } from '../../../constants/queryKeys.js';
import { NOTIFICATION_TYPE_ES } from '../../notification-rules/targets.js';
import { formatDateTime } from '../../../utils/dates.js';

const TONE = { SENT: 'success', FAILED: 'danger', PENDING: 'warning' };
const LABEL = { SENT: 'Enviada', FAILED: 'Fallida', PENDING: 'Pendiente' };

/** Teams notifications sent for one occurrence (visible to its owner and ADMIN). */
export default function NotificationHistory({ occurrenceId }) {
  const { data = [], isLoading } = useQuery({ queryKey: qk.occurrenceNotifications(occurrenceId), queryFn: () => notificationsApi.forOccurrence(occurrenceId) });
  if (isLoading) return <p className="text-sm text-text-muted">Cargando…</p>;
  if (!data.length) return <p className="text-sm text-text-muted">Aún no se han enviado notificaciones.</p>;
  return (
    <ul className="space-y-2">
      {data.map((n) => (
        <li key={n._id} className="text-xs">
          <p className="flex flex-wrap items-center gap-1.5 font-medium text-text">
            {NOTIFICATION_TYPE_ES[n.type] ?? n.type}
            {n.level ? ` N${n.level}` : ''}
            <Badge tone={TONE[n.status]}>{LABEL[n.status]}</Badge>
            {n.dryRun && <Badge>Simulada</Badge>}
          </p>
          <p className="text-text-muted">
            {n.channel === 'TEAMS_CHANNEL' ? 'Canal de Calidad' : n.recipientId?.name ?? n.recipientAddress} · {formatDateTime(n.sentAt ?? n.createdAt)}
            {n.emailCopy ? ' · + correo' : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}
