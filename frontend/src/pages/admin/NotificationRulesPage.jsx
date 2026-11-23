import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '../../api/client.js';
import { notificationsApi } from '../../api/notifications.api.js';
import { useAuth } from '../../auth/useAuth.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import { qk } from '../../constants/queryKeys.js';
import { TARGETS } from '../../features/notification-rules/targets.js';
import RuleForm from '../../features/notification-rules/components/RuleForm.jsx';

const targetLabel = (t) => TARGETS.find((x) => x.value === t)?.label ?? t;

function RuleSummary({ rule }) {
  return (
    <ul className="space-y-1 text-sm">
      <li>Recordatorios: {rule.reminderOffsetsDays.length ? rule.reminderOffsetsDays.map((d) => `D-${d}`).join(', ') : 'ninguno'}{rule.sendOnDueDate && ', D-0 (vence hoy)'}</li>
      <li>Vencida: aviso cada {rule.overdueRepeatEveryDays === 1 ? 'día hábil' : `${rule.overdueRepeatEveryDays} días`}</li>
      {rule.escalationLevels.map((l) => (
        <li key={l.level}>
          N{l.level} a los {l.afterDaysOverdue} días → {targetLabel(l.target)}
        </li>
      ))}
      <li className="flex flex-wrap gap-1 pt-1">
        <Badge tone="accent">Chat de Teams</Badge>
        {rule.channels.includes('TEAMS_CHANNEL') && <Badge tone="accent">Canal de Calidad</Badge>}
        {rule.channels.includes('EMAIL') && <Badge>Copia por correo</Badge>}
        {rule.includeGroupMembers && <Badge>Todo el grupo</Badge>}
      </li>
    </ul>
  );
}

export default function NotificationRulesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState(null); // rule object or 'new'
  const { data, isLoading, error } = useQuery({ queryKey: qk.notificationRules, queryFn: notificationsApi.rules });
  const save = useMutation({
    mutationFn: (body) => (editing === 'new' ? notificationsApi.createRule(body) : notificationsApi.updateRule(editing._id, body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.notificationRules });
      setEditing(null);
    },
  });
  const open = (rule) => {
    save.reset();
    setEditing(rule);
  };

  return (
    <>
      <PageHeader
        title="Reglas de notificación"
        subtitle="La regla general aplica a todas las auditorías; una auditoría puede usar otra regla desde su edición."
        actions={<Button variant="primary" onClick={() => open('new')}>+ Nueva regla</Button>}
      />
      {isLoading && <FullPageSpinner />}
      {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
      <div className="grid gap-5 lg:grid-cols-2">
        {data?.map((rule) => (
          <Card
            key={rule._id}
            title={
              <>
                {rule.name} {rule.isDefault && <Badge tone="accent" className="ml-1">General</Badge>} {!rule.active && <Badge tone="danger" className="ml-1">Inactiva</Badge>}
              </>
            }
            actions={<Button size="sm" onClick={() => open(rule)}>Editar</Button>}
          >
            <RuleSummary rule={rule} />
          </Card>
        ))}
      </div>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} closeDisabled={save.isPending} title={editing === 'new' ? 'Nueva regla' : `Editar · ${editing?.name ?? ''}`} size="lg">
        {editing && <RuleForm rule={editing === 'new' ? null : editing} mutation={save} onCancel={() => setEditing(null)} emailEnabled={user.features?.emailEnabled} />}
      </Modal>
    </>
  );
}
