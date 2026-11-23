import { useState } from 'react';
import { errorMessage } from '../../../api/client.js';
import Alert from '../../../components/ui/Alert.jsx';
import Button from '../../../components/ui/Button.jsx';
import { Field, Textarea } from '../../../components/ui/Input.jsx';
import Modal from '../../../components/ui/Modal.jsx';

/**
 * Generic "write a reason and confirm" modal, used for reject, cancel, close as not done,
 * reopen and rejecting a reschedule request. `mutation` is a TanStack mutation taking the text.
 */
export default function ReasonModal({ open, onClose, title, description, label = 'Motivo', confirmLabel = 'Confirmar', variant = 'primary', mutation }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (text.trim().length < 10) return setError('Escribe al menos 10 caracteres');
    setError('');
    mutation.mutate(text.trim(), { onSuccess: () => setText('') });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeDisabled={mutation.isPending}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button variant={variant} type="submit" form="reason-form" loading={mutation.isPending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id="reason-form" onSubmit={submit} className="space-y-3" noValidate>
        {description && <p className="text-sm text-text-muted">{description}</p>}
        {(error || mutation.error) && <Alert tone="danger">{error || errorMessage(mutation.error)}</Alert>}
        <Field label={label} required hint="Mínimo 10 caracteres">
          {(p) => <Textarea {...p} rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />}
        </Field>
      </form>
    </Modal>
  );
}
