import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '../../api/client.js';
import { notificationsApi } from '../../api/notifications.api.js';
import { settingsApi } from '../../api/settings.api.js';
import { usersApi } from '../../api/users.api.js';
import { useAuth } from '../../auth/useAuth.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import { Field, Input } from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { FullPageSpinner } from '../../components/ui/Spinner.jsx';
import { qk } from '../../constants/queryKeys.js';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function Check({ checked, onChange, children }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

const TEST_RESULT = { SENT: 'enviado', FAILED: 'falló (revisa la bitácora de notificaciones)', DUPLICATE: 'ya enviado', DISABLED: 'canal desactivado' };

export default function SettingsPage() {
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const settings = useQuery({ queryKey: qk.settings, queryFn: settingsApi.get });
  const users = useQuery({ queryKey: qk.usersLookup, queryFn: () => usersApi.lookup() });
  // Unsaved edits on top of the server values.
  const [draft, setDraft] = useState({});
  const form = settings.data ? { ...settings.data, ...draft } : null;

  const save = useMutation({
    mutationFn: (body) => settingsApi.update(body),
    onSuccess: (data) => {
      qc.setQueryData(qk.settings, data);
      setDraft({});
      refresh();
    },
  });
  const test = useMutation({ mutationFn: notificationsApi.test, onSettled: () => qc.invalidateQueries({ queryKey: ['notification-log'] }) });

  if (settings.isLoading || !form) return <FullPageSpinner />;
  if (settings.error) return <Alert tone="danger">{errorMessage(settings.error)}</Alert>;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const submit = (e) => {
    e.preventDefault();
    save.mutate({
      plantQualityManagerId: form.plantQualityManagerId || null,
      emailEnabled: form.emailEnabled,
      qualityChannelEnabled: form.qualityChannelEnabled,
      dailyJobTime: form.dailyJobTime,
      digestDayOfWeek: Number(form.digestDayOfWeek),
      digestTime: form.digestTime,
      lateCompletionCountsAsCompliant: form.lateCompletionCountsAsCompliant,
      rescheduleAfterDueCountsAsLate: form.rescheduleAfterDueCountsAsLate,
    });
  };

  return (
    <>
      <PageHeader title="Configuración" subtitle="Parámetros generales del programa y de las notificaciones" />
      <form onSubmit={submit} className="space-y-5" noValidate>
        {save.isSuccess && <Alert tone="success">Configuración guardada.</Alert>}
        {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
        <div className="grid gap-5 xl:grid-cols-2">
          <Card title="Notificaciones por Teams">
            <div className="space-y-4">
              <Check checked={form.qualityChannelEnabled} onChange={(v) => set({ qualityChannelEnabled: v })}>
                Publicar escalaciones N2/N3 y el resumen semanal en el canal de Calidad
              </Check>
              <Check checked={form.emailEnabled} onChange={(v) => set({ emailEnabled: v })}>
                Permitir copia por correo (la envía el mismo flujo de Teams; cada usuario la activa en su perfil y la regla debe incluir «correo»)
              </Check>
              <Field label="Gerente de calidad de planta (escalación N3)" hint="Sin asignar, N3 llega a los supervisores de calidad">
                {(p) => <Select {...p} value={form.plantQualityManagerId ?? ''} onChange={(e) => set({ plantQualityManagerId: e.target.value })} placeholder="Sin asignar" options={(users.data ?? []).map((u) => ({ value: u._id, label: `${u.name} — ${u.email}` }))} />}
              </Field>
              <div className="rounded-control bg-white/50 p-3">
                <p className="mb-2 text-sm font-medium">Probar el flujo de notificaciones</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => test.mutate({ channel: false })} loading={test.isPending && !test.variables?.channel}>Enviarme un mensaje</Button>
                  <Button size="sm" onClick={() => test.mutate({ channel: true })} loading={test.isPending && test.variables?.channel}>Mensaje + canal de Calidad</Button>
                </div>
                {test.data && (
                  <Alert tone={test.data.chat === 'SENT' ? 'success' : 'danger'} className="mt-2">
                    Chat: {TEST_RESULT[test.data.chat]}
                    {test.data.channel && ` · Canal: ${TEST_RESULT[test.data.channel]}`}
                    {test.data.emailCopy && ' · con copia por correo'}
                    {test.data.dryRun && ' · MODO SIMULACIÓN (NOTIFICATIONS_DRY_RUN=true): no se envió nada a Teams'}
                    {!test.data.configured && !test.data.dryRun && ' · falta TEAMS_NOTIFY_WEBHOOK_URL en el servidor'}
                  </Alert>
                )}
                {test.error && <Alert tone="danger" className="mt-2">{errorMessage(test.error)}</Alert>}
              </div>
            </div>
          </Card>

          <Card title="Horarios (hora de Ciudad de México)">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Envío diario de recordatorios y escalaciones">
                {(p) => <Input {...p} type="time" value={form.dailyJobTime} onChange={(e) => set({ dailyJobTime: e.target.value })} />}
              </Field>
              <div />
              <Field label="Día del resumen semanal">
                {(p) => <Select {...p} value={form.digestDayOfWeek} onChange={(e) => set({ digestDayOfWeek: e.target.value })} options={DAYS.map((d, i) => ({ value: i, label: d }))} />}
              </Field>
              <Field label="Hora del resumen semanal">
                {(p) => <Input {...p} type="time" value={form.digestTime} onChange={(e) => set({ digestTime: e.target.value })} />}
              </Field>
            </div>
            <p className="mt-3 text-xs text-text-muted">No se envía nada en fines de semana ni en días no laborables.</p>
          </Card>

          <Card title="Indicadores de cumplimiento" className="xl:col-span-2">
            <div className="space-y-3">
              <Check checked={form.lateCompletionCountsAsCompliant} onChange={(v) => set({ lateCompletionCountsAsCompliant: v })}>
                Mostrar como indicador principal el cumplimiento <strong>total</strong> (incluye «realizada fuera de tiempo»). Si está desactivado se muestra el cumplimiento <strong>a tiempo</strong>.
              </Check>
              <Check checked={form.rescheduleAfterDueCountsAsLate} onChange={(v) => set({ rescheduleAfterDueCountsAsLate: v })}>
                Una reprogramación aprobada después de la fecha límite se sigue evaluando contra la fecha original (evita ocultar atrasos)
              </Check>
            </div>
          </Card>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={save.isPending}>Guardar configuración</Button>
        </div>
      </form>
    </>
  );
}
