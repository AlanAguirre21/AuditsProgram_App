import { useState } from 'react';
import { errorMessage } from '../../../api/client.js';
import Alert from '../../../components/ui/Alert.jsx';
import Button from '../../../components/ui/Button.jsx';
import { Field, Input } from '../../../components/ui/Input.jsx';
import EscalationLevelsEditor from './EscalationLevelsEditor.jsx';

const parseOffsets = (text) =>
  [...new Set(text.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 90))].sort((a, b) => b - a);

function Check({ checked, onChange, children, disabled }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** Edits one notification rule (offsets, repetition, escalation, channels). */
export default function RuleForm({ rule, mutation, onCancel, emailEnabled }) {
  const [form, setForm] = useState(() => ({
    name: rule?.name ?? '',
    offsets: (rule?.reminderOffsetsDays ?? [14, 7, 3, 1]).join(', '),
    sendOnDueDate: rule?.sendOnDueDate ?? true,
    overdueRepeatEveryDays: rule?.overdueRepeatEveryDays ?? 1,
    escalationLevels: rule?.escalationLevels ?? [],
    includeGroupMembers: rule?.includeGroupMembers ?? false,
    channel: rule?.channels?.includes('TEAMS_CHANNEL') ?? false,
    email: rule?.channels?.includes('EMAIL') ?? false,
    active: rule?.active ?? true,
  }));
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const busy = mutation.isPending;

  const submit = (e) => {
    e.preventDefault();
    mutation.mutate({
      name: form.name.trim(),
      reminderOffsetsDays: parseOffsets(form.offsets),
      sendOnDueDate: form.sendOnDueDate,
      overdueRepeatEveryDays: Number(form.overdueRepeatEveryDays) || 1,
      escalationLevels: form.escalationLevels,
      includeGroupMembers: form.includeGroupMembers,
      channels: ['TEAMS_CHAT', ...(form.channel ? ['TEAMS_CHANNEL'] : []), ...(form.email ? ['EMAIL'] : [])],
      ...(rule?.isDefault ? {} : { active: form.active }),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {mutation.error && <Alert tone="danger">{errorMessage(mutation.error)}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nombre" required className="sm:col-span-3">
          {(p) => <Input {...p} value={form.name} disabled={busy} onChange={(e) => set({ name: e.target.value })} />}
        </Field>
        <Field label="Recordatorios (días antes de la fecha)" hint={`Se enviarán: ${parseOffsets(form.offsets).map((d) => `D-${d}`).join(', ') || 'ninguno'}`} className="sm:col-span-2">
          {(p) => <Input {...p} value={form.offsets} disabled={busy} placeholder="14, 7, 3, 1" onChange={(e) => set({ offsets: e.target.value })} />}
        </Field>
        <Field label="Aviso de vencida cada (días)">
          {(p) => <Input {...p} type="number" min={1} max={30} value={form.overdueRepeatEveryDays} disabled={busy} onChange={(e) => set({ overdueRepeatEveryDays: e.target.value })} />}
        </Field>
      </div>
      <div className="space-y-2">
        <Check checked={form.sendOnDueDate} disabled={busy} onChange={(v) => set({ sendOnDueDate: v })}>Aviso el día de vencimiento («vence hoy»)</Check>
        <Check checked={form.includeGroupMembers} disabled={busy} onChange={(v) => set({ includeGroupMembers: v })}>Los recordatorios también llegan a todos los miembros del grupo responsable</Check>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-zf-blue">Escalación (acumulativa, cada nivel se envía una vez)</legend>
        <EscalationLevelsEditor value={form.escalationLevels} disabled={busy} onChange={(escalationLevels) => set({ escalationLevels })} />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold text-zf-blue">Canales</legend>
        <Check checked disabled>Chat de Teams con el responsable/destinatario (siempre activo)</Check>
        <Check checked={form.channel} disabled={busy} onChange={(v) => set({ channel: v })}>Tarjeta en el canal de Calidad para escalaciones N2/N3</Check>
        <Check checked={form.email} disabled={busy} onChange={(v) => set({ email: v })}>
          Copia por correo a quien lo active en su perfil {!emailEnabled && <span className="text-xs text-warning">(el correo está desactivado en Configuración)</span>}
        </Check>
      </fieldset>

      {!rule?.isDefault && (
        <Check checked={form.active} disabled={busy} onChange={(v) => set({ active: v })}>Regla activa</Check>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && <Button onClick={onCancel} disabled={busy}>Cancelar</Button>}
        <Button type="submit" variant="primary" loading={busy} disabled={form.name.trim().length < 2}>Guardar</Button>
      </div>
    </form>
  );
}
