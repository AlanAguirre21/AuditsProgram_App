import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '../../../api/client.js';
import Alert from '../../../components/ui/Alert.jsx';
import Button from '../../../components/ui/Button.jsx';
import { Field, Input, Textarea } from '../../../components/ui/Input.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import { toKey, todayKey } from '../../../utils/dates.js';
import { useCompleteOccurrence } from '../hooks/useCompleteOccurrence.js';

const count = z.coerce.number().int('Debe ser un número entero').min(0, 'Mínimo 0').max(999, 'Máximo 999');

// Mirrors backend occurrences.validation.js completeBody.
const schema = z.object({
  performedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona la fecha'),
  findings: z.object({ major: count, minor: count, observations: count }),
  findingsSummary: z.string().trim().max(2000).optional(),
  externalRef: z.string().trim().max(200).optional(),
});

const minDate = (dueKey) => {
  const d = new Date(`${dueKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 60);
  return d.toISOString().slice(0, 10);
};

/** BR-11/BR-12: performedAt ≤ today and ≥ due − 60 days; evidence first when required. */
export default function CompleteOccurrenceModal({ open, onClose, occ }) {
  const today = todayKey();
  const dueKey = toKey(occ.dueDate);
  const needsEvidence = occ.definitionId.evidenceRequired && occ.evidence.length === 0;
  const complete = useCompleteOccurrence(occ._id, { onSuccess: onClose });
  const { register, handleSubmit, formState, watch } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { performedAt: today, findings: { major: 0, minor: 0, observations: 0 } },
  });
  const e = formState.errors;
  const performed = watch('performedAt');
  const late = performed && performed > (occ.evaluateAgainstOriginal ? toKey(occ.originalDueDate) : dueKey);

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeDisabled={complete.isPending}
      title="Registrar auditoría como realizada"
      size="lg"
      footer={
        <>
          <Button onClick={onClose} disabled={complete.isPending}>
            Cancelar
          </Button>
          <Button variant="success" type="submit" form="complete-form" loading={complete.isPending} disabled={needsEvidence}>
            {occ.definitionId.requiresValidation ? 'Enviar a validación' : 'Registrar'}
          </Button>
        </>
      }
    >
      <form id="complete-form" onSubmit={handleSubmit((v) => complete.mutate(v))} className="space-y-4" noValidate>
        {needsEvidence && <Alert tone="warning">Esta auditoría requiere evidencia. Sube al menos un archivo antes de registrarla.</Alert>}
        {complete.error && <Alert tone="danger">{errorMessage(complete.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha en que se realizó" required error={e.performedAt?.message}>
            {(p) => <Input {...p} type="date" max={today} min={minDate(dueKey)} {...register('performedAt')} />}
          </Field>
          <Field label="Referencia externa" hint="Folio del reporte, CAPA, etc." error={e.externalRef?.message}>
            {(p) => <Input {...p} {...register('externalRef')} />}
          </Field>
        </div>
        {late && <Alert tone="warning">La fecha es posterior a la fecha programada: quedará como «Realizada fuera de tiempo».</Alert>}
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-text-muted">Hallazgos (pueden ser 0)</legend>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Mayores" error={e.findings?.major?.message}>
              {(p) => <Input {...p} type="number" min={0} {...register('findings.major')} />}
            </Field>
            <Field label="Menores" error={e.findings?.minor?.message}>
              {(p) => <Input {...p} type="number" min={0} {...register('findings.minor')} />}
            </Field>
            <Field label="Observaciones" error={e.findings?.observations?.message}>
              {(p) => <Input {...p} type="number" min={0} {...register('findings.observations')} />}
            </Field>
          </div>
        </fieldset>
        <Field label="Resumen de hallazgos" error={e.findingsSummary?.message}>
          {(p) => <Textarea {...p} rows={4} maxLength={2000} {...register('findingsSummary')} />}
        </Field>
      </form>
    </Modal>
  );
}
