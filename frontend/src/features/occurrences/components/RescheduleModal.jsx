import { useState } from 'react';
import { errorMessage } from '../../../api/client.js';
import Alert from '../../../components/ui/Alert.jsx';
import Button from '../../../components/ui/Button.jsx';
import { Field, Input, Textarea } from '../../../components/ui/Input.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import { formatDate, todayKey } from '../../../utils/dates.js';
import { useReschedule } from '../hooks/useReschedule.js';

/** mode 'request' → the owner asks; 'direct' → ADMIN reschedules immediately (BR-31). */
export default function RescheduleModal({ open, onClose, occ, mode = 'request' }) {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const mutation = useReschedule(occ._id, mode, { onSuccess: onClose });
  const year = occ.year;
  const lateApproval = todayKey() > String(occ.dueDate).slice(0, 10);

  const submit = (e) => {
    e.preventDefault();
    if (!date) return setError('Selecciona la nueva fecha');
    if (reason.trim().length < 10) return setError('El motivo debe tener al menos 10 caracteres');
    setError('');
    mutation.mutate({ date, reason: reason.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeDisabled={mutation.isPending}
      title={mode === 'direct' ? 'Reprogramar auditoría' : 'Solicitar reprogramación'}
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="reschedule-form" loading={mutation.isPending}>
            {mode === 'direct' ? 'Reprogramar' : 'Enviar solicitud'}
          </Button>
        </>
      }
    >
      <form id="reschedule-form" onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-text-muted">
          Fecha actual: <strong className="text-text">{formatDate(occ.dueDate)}</strong>.{' '}
          {mode === 'request' && 'La solicitud debe aprobarla el supervisor de calidad.'}
        </p>
        {lateApproval && (
          <Alert tone="warning">La fecha programada ya pasó: para el indicador de cumplimiento se seguirá evaluando contra la fecha original.</Alert>
        )}
        {(error || mutation.error) && <Alert tone="danger">{error || errorMessage(mutation.error)}</Alert>}
        <Field label="Nueva fecha" required hint={`Debe estar dentro del programa ${year}`}>
          {(p) => <Input {...p} type="date" min={`${year}-01-01`} max={`${year}-12-31`} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Motivo" required hint="Mínimo 10 caracteres">
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />}
        </Field>
      </form>
    </Modal>
  );
}
