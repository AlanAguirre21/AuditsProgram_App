import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { authApi } from '../../api/auth.api.js';
import { errorMessage } from '../../api/client.js';
import { usersApi } from '../../api/users.api.js';
import { passwordSchema } from '../../auth/schemas.js';
import { useAuth } from '../../auth/useAuth.js';
import PageHeader from '../../components/PageHeader.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import { Field, Input } from '../../components/ui/Input.jsx';
import es from '../../i18n/es.js';

const pwSchema = z
  .object({ currentPassword: z.string().min(1, 'Requerida'), newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden' });

export default function ProfilePage() {
  const { user, refresh, signIn } = useAuth();
  const [info, setInfo] = useState({ name: user.name, department: user.department ?? '', jobTitle: user.jobTitle ?? '', employeeNumber: user.employeeNumber ?? '' });
  const saveInfo = useMutation({ mutationFn: usersApi.updateMe, onSuccess: () => refresh() });
  const savePrefs = useMutation({ mutationFn: usersApi.updateMe, onSuccess: () => refresh() });
  const pw = useForm({ resolver: zodResolver(pwSchema) });
  const changePw = useMutation({
    mutationFn: ({ confirm: _c, ...body }) => authApi.changePassword(body),
    onSuccess: ({ token }) => {
      pw.reset();
      signIn(token);
    },
  });
  const set = (k) => (e) => setInfo((i) => ({ ...i, [k]: e.target.value }));

  return (
    <>
      <PageHeader title="Mi perfil" subtitle={user.email} />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Datos personales">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveInfo.mutate(info); }}>
            {saveInfo.isSuccess && <Alert tone="success">Datos actualizados.</Alert>}
            {saveInfo.error && <Alert tone="danger">{errorMessage(saveInfo.error)}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre">{(p) => <Input {...p} value={info.name} onChange={set('name')} />}</Field>
              <Field label="No. de empleado">{(p) => <Input {...p} value={info.employeeNumber} onChange={set('employeeNumber')} />}</Field>
              <Field label="Departamento">{(p) => <Input {...p} value={info.department} onChange={set('department')} />}</Field>
              <Field label="Puesto">{(p) => <Input {...p} value={info.jobTitle} onChange={set('jobTitle')} />}</Field>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-text-muted">Roles:</span>
              {user.roles.map((r) => <Badge key={r} tone="accent">{es.roles[r]}</Badge>)}
              {user.isQualitySupervisor && <Badge tone="success">Supervisor de calidad</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-text-muted">Grupos:</span>
              {user.groups?.length ? user.groups.map((g) => <Badge key={g._id}>{g.name}</Badge>) : <span className="text-text-faint">Ninguno</span>}
            </div>
            <div className="flex justify-end"><Button type="submit" variant="primary" loading={saveInfo.isPending}>Guardar</Button></div>
          </form>
        </Card>
        <Card title="Cambiar contraseña">
          <form className="space-y-4" onSubmit={pw.handleSubmit((v) => changePw.mutate(v))} noValidate>
            {changePw.isSuccess && <Alert tone="success">Contraseña actualizada. Las demás sesiones se cerraron.</Alert>}
            {changePw.error && <Alert tone="danger">{errorMessage(changePw.error)}</Alert>}
            <Field label="Contraseña actual" error={pw.formState.errors.currentPassword?.message}>{(p) => <Input {...p} type="password" autoComplete="current-password" {...pw.register('currentPassword')} />}</Field>
            <Field label="Nueva contraseña" error={pw.formState.errors.newPassword?.message} hint="Mínimo 10 caracteres, con letras y números">{(p) => <Input {...p} type="password" autoComplete="new-password" {...pw.register('newPassword')} />}</Field>
            <Field label="Confirmar" error={pw.formState.errors.confirm?.message}>{(p) => <Input {...p} type="password" autoComplete="new-password" {...pw.register('confirm')} />}</Field>
            <div className="flex justify-end"><Button type="submit" variant="primary" loading={changePw.isPending}>Cambiar contraseña</Button></div>
          </form>
        </Card>
        <Card title="Notificaciones" className="xl:col-span-2">
          <div className="space-y-3 text-sm">
            <p>
              Recibes recordatorios, avisos de vencimiento y escalaciones como mensajes de <strong>Microsoft Teams</strong> (chat con «Workflows»). Este canal está siempre activo.
            </p>
            {user.features?.emailEnabled ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-accent)]"
                  checked={Boolean(user.notificationPrefs?.email)}
                  disabled={savePrefs.isPending}
                  onChange={(e) => savePrefs.mutate({ notificationPrefs: { email: e.target.checked } })}
                />
                Recibir también una copia por correo
              </label>
            ) : (
              <p className="text-text-muted">La copia por correo está desactivada para toda la planta.</p>
            )}
            {savePrefs.error && <Alert tone="danger">{errorMessage(savePrefs.error)}</Alert>}
          </div>
        </Card>
      </div>
    </>
  );
}
