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

/** Changes the owner of one occurrence (ADMIN). `mutation` receives { ownerUserId, reason }. */
export default function ReassignModal({ open, onClose, currentOwnerId, mutation }) {
  const users = useQuery({ queryKey: qk.usersLookup, queryFn: () => usersApi.lookup(), enabled: open });
  const [ownerUserId, setOwner] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!ownerUserId) return setError('Selecciona el nuevo responsable');
    if (reason.trim().length < 10) return setError('El motivo debe tener al menos 10 caracteres');
    setError('');
    mutation.mutate({ ownerUserId, reason: reason.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeDisabled={mutation.isPending}
      title="Reasignar responsable"
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="reassign-form" loading={mutation.isPending}>
            Reasignar
          </Button>
        </>
      }
    >
      <form id="reassign-form" onSubmit={submit} className="space-y-3" noValidate>
        {(error || mutation.error) && <Alert tone="danger">{error || errorMessage(mutation.error)}</Alert>}
        <Field label="Nuevo responsable" required>
          {(p) => (
            <Select
              {...p}
              value={ownerUserId}
              onChange={(e) => setOwner(e.target.value)}
              placeholder={users.isLoading ? 'Cargando…' : 'Selecciona…'}
              options={(users.data ?? []).filter((u) => u._id !== currentOwnerId).map((u) => ({ value: u._id, label: `${u.name} — ${u.email}` }))}
            />
          )}
        </Field>
        <Field label="Motivo" required hint="Mínimo 10 caracteres">
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}
        </Field>
      </form>
    </Modal>
  );
}
