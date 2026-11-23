import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '../../../api/client.js';
import { usersApi } from '../../../api/users.api.js';
import Alert from '../../../components/ui/Alert.jsx';
import Button from '../../../components/ui/Button.jsx';
import { Field, Textarea } from '../../../components/ui/Input.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Select from '../../../components/ui/Select.jsx';
import { qk } from '../../../constants/queryKeys.js';

/** BR-50/51: moves all open occurrences (and default ownership) to another user. */
export default function UserReassignModal({ user, onClose, mutation }) {
  const users = useQuery({ queryKey: qk.usersLookup, queryFn: () => usersApi.lookup() });
  const [toUserId, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [includeDefinitions, setDefs] = useState(true);
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!toUserId) return setError('Selecciona el nuevo responsable');
    if (reason.trim().length < 10) return setError('El motivo debe tener al menos 10 caracteres');
    setError('');
    mutation.mutate({ toUserId, reason: reason.trim(), includeDefinitions });
  };

  return (
    <Modal
      open
      onClose={onClose}
      closeDisabled={mutation.isPending}
      title={`Reasignar auditorías de ${user.name}`}
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button type="submit" form="reassign-user" variant="primary" loading={mutation.isPending}>Reasignar</Button>
        </>
      }
    >
      <form id="reassign-user" onSubmit={submit} className="space-y-3" noValidate>
        <p className="text-sm text-text-muted">Se moverán todas sus auditorías abiertas (programadas o en validación). Cada cambio queda en la bitácora.</p>
        {mutation.data && <Alert tone="success">Reasignadas {mutation.data.reassigned} fecha(s) y {mutation.data.definitions} auditoría(s).</Alert>}
        {(error || mutation.error) && <Alert tone="danger">{error || errorMessage(mutation.error)}</Alert>}
        <Field label="Nuevo responsable" required>
          {(p) => <Select {...p} value={toUserId} onChange={(e) => setTo(e.target.value)} placeholder="Selecciona…" options={(users.data ?? []).filter((u) => u._id !== user._id).map((u) => ({ value: u._id, label: `${u.name} — ${u.email}` }))} />}
        </Field>
        <Field label="Motivo" required hint="Mínimo 10 caracteres">
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={includeDefinitions} onChange={(e) => setDefs(e.target.checked)} />
          También cambiar el responsable por defecto de sus auditorías activas
        </label>
      </form>
    </Modal>
  );
}
