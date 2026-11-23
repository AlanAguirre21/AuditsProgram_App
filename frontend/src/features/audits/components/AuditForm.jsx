import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '../../../api/client.js';
import { groupsApi } from '../../../api/groups.api.js';
import { notificationsApi } from '../../../api/notifications.api.js';
import { usersApi } from '../../../api/users.api.js';
import Alert from '../../../components/ui/Alert.jsx';
import Button from '../../../components/ui/Button.jsx';
import Card from '../../../components/ui/Card.jsx';
import { Field, Input, Textarea } from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import { qk } from '../../../constants/queryKeys.js';
import { CATEGORIES } from '../../../constants/statuses.js';
import es from '../../../i18n/es.js';
import { currentYear } from '../../../utils/dates.js';
import MonthPicker from './MonthPicker.jsx';

// Mirrors backend audits.validation.js
const schema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  code: z.coerce.number().int('Número entero').min(1, 'Mínimo 1'),
  category: z.enum(CATEGORIES, { message: 'Selecciona el tipo' }),
  name: z.string().trim().min(3, 'Mínimo 3 caracteres').max(300),
  standard: z.string().trim().min(1, 'Requerido').max(200),
  requiredByText: z.string().trim().min(1, 'Indica al menos un cliente o entidad'),
  ownerGroupId: z.string().min(1, 'Selecciona el grupo'),
  defaultOwnerUserId: z.string().min(1, 'Selecciona el responsable'),
  executorType: z.enum(['INTERNAL', 'EXTERNAL']),
  executorName: z.string().trim().min(1, 'Requerido').max(120),
  evidenceRequired: z.boolean(),
  requiresValidation: z.boolean(),
  folderPath: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  notificationRuleId: z.string().optional(),
  months: z.array(z.number()).optional(),
  propagateOwner: z.boolean().optional(),
});

const toFormValues = (d) =>
  d
    ? {
        year: d.year,
        code: d.code,
        category: d.category,
        name: d.name,
        standard: d.standard,
        requiredByText: d.requiredBy.join(', '),
        ownerGroupId: d.ownerGroupId?._id ?? d.ownerGroupId,
        defaultOwnerUserId: d.defaultOwnerUserId?._id ?? d.defaultOwnerUserId,
        executorType: d.executor?.type ?? 'INTERNAL',
        executorName: d.executor?.name ?? '',
        evidenceRequired: d.evidenceRequired,
        requiresValidation: d.requiresValidation,
        folderPath: d.folderPath ?? '',
        notes: d.notes ?? '',
        notificationRuleId: d.notificationRuleId ?? '',
        propagateOwner: true,
      }
    : { year: currentYear(), executorType: 'INTERNAL', evidenceRequired: true, requiresValidation: true, months: [], requiredByText: '' };

/** Form values → API body. */
function toBody(v, isEdit) {
  const body = {
    code: v.code,
    category: v.category,
    name: v.name,
    standard: v.standard,
    requiredBy: v.requiredByText.split(/[,/]/).map((s) => s.trim()).filter(Boolean),
    ownerGroupId: v.ownerGroupId,
    defaultOwnerUserId: v.defaultOwnerUserId,
    executor: { type: v.executorType, name: v.executorName },
    evidenceRequired: v.evidenceRequired,
    requiresValidation: v.requiresValidation,
    folderPath: v.folderPath || undefined,
    notes: v.notes || undefined,
    notificationRuleId: v.notificationRuleId || null,
  };
  if (isEdit) return { ...body, propagateOwner: v.propagateOwner };
  return { ...body, year: v.year, months: v.months ?? [] };
}

export default function AuditForm({ initial, onSubmit, mutation, onCancel }) {
  const isEdit = Boolean(initial);
  const { register, handleSubmit, control, formState, watch } = useForm({ resolver: zodResolver(schema), defaultValues: toFormValues(initial) });
  const e = formState.errors;
  const groups = useQuery({ queryKey: qk.groups({ active: true }), queryFn: () => groupsApi.list({ active: 'true' }) });
  const users = useQuery({ queryKey: qk.usersLookup, queryFn: () => usersApi.lookup() });
  const rules = useQuery({ queryKey: qk.notificationRules, queryFn: notificationsApi.rules });
  const ownerChanged = isEdit && watch('defaultOwnerUserId') !== (initial.defaultOwnerUserId?._id ?? initial.defaultOwnerUserId);

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(toBody(v, isEdit)))} className="space-y-5" noValidate>
      {mutation.error && <Alert tone="danger">{errorMessage(mutation.error)}</Alert>}
      <Card title="Datos de la auditoría">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Año del programa" required error={e.year?.message}>
            {(p) => <Input {...p} type="number" disabled={isEdit} {...register('year')} />}
          </Field>
          <Field label="Número (#)" required error={e.code?.message}>
            {(p) => <Input {...p} type="number" min={1} {...register('code')} />}
          </Field>
          <Field label="Tipo de auditoría" required error={e.category?.message} className="sm:col-span-2">
            {(p) => <Select {...p} placeholder="Selecciona…" options={CATEGORIES.map((c) => ({ value: c, label: es.categories[c] }))} {...register('category')} />}
          </Field>
          <Field label="Nombre de la auditoría" required error={e.name?.message} className="sm:col-span-2">
            {(p) => <Input {...p} {...register('name')} />}
          </Field>
          <Field label="Norma / requerimiento" required error={e.standard?.message}>
            {(p) => <Input {...p} placeholder="IATF 16949, CQI-15…" {...register('standard')} />}
          </Field>
          <Field label="Requerido por" required error={e.requiredByText?.message} hint="Separa los clientes con comas">
            {(p) => <Input {...p} placeholder="GM, Ford, Stellantis" {...register('requiredByText')} />}
          </Field>
        </div>
      </Card>

      <Card title="Responsables">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Grupo responsable" required error={e.ownerGroupId?.message}>
            {(p) => <Select {...p} placeholder="Selecciona…" options={(groups.data ?? []).map((g) => ({ value: g._id, label: g.name }))} {...register('ownerGroupId')} />}
          </Field>
          <Field label="Responsable (recibe recordatorios)" required error={e.defaultOwnerUserId?.message}>
            {(p) => <Select {...p} placeholder="Selecciona…" options={(users.data ?? []).map((u) => ({ value: u._id, label: u.name }))} {...register('defaultOwnerUserId')} />}
          </Field>
          <Field label="Quién ejecuta" required>
            {(p) => (
              <Select
                {...p}
                options={[
                  { value: 'INTERNAL', label: 'Equipo interno' },
                  { value: 'EXTERNAL', label: 'Organismo externo' },
                ]}
                {...register('executorType')}
              />
            )}
          </Field>
          <Field label="Nombre del ejecutor" required error={e.executorName?.message}>
            {(p) => <Input {...p} placeholder="Equipo Soldadura, DQS, SGS…" {...register('executorName')} />}
          </Field>
        </div>
        {ownerChanged && (
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" {...register('propagateOwner')} />
            Asignar también al nuevo responsable las fechas abiertas de esta auditoría
          </label>
        )}
      </Card>

      <Card title="Reglas y documentos">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" {...register('evidenceRequired')} />
              Evidencia obligatoria al registrar
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" {...register('requiresValidation')} />
              Requiere validación del supervisor
            </label>
          </div>
          <Field label="Carpeta de documentos (ruta de red)" error={e.folderPath?.message}>
            {(p) => <Input {...p} placeholder="\\America\esl\Team\..." {...register('folderPath')} />}
          </Field>
          <Field label="Regla de notificación" hint="Recordatorios y escalaciones de esta auditoría">
            {(p) => <Select {...p} placeholder="Regla general" options={(rules.data ?? []).filter((r) => !r.isDefault && r.active).map((r) => ({ value: r._id, label: r.name }))} {...register('notificationRuleId')} />}
          </Field>
          <Field label="Notas" error={e.notes?.message}>
            {(p) => <Textarea {...p} {...register('notes')} />}
          </Field>
        </div>
      </Card>

      {!isEdit && (
        <Card title="Meses programados">
          <p className="mb-3 text-xs text-text-muted">La fecha límite de cada mes será su último día hábil. Puedes ajustar fechas exactas después desde el detalle.</p>
          <Controller control={control} name="months" render={({ field }) => <MonthPicker value={field.value} onChange={field.onChange} year={watch('year')} />} />
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          {isEdit ? 'Guardar cambios' : 'Crear auditoría'}
        </Button>
      </div>
    </form>
  );
}
