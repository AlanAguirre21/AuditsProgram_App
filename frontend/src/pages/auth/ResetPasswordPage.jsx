import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/auth.api.js';
import { errorMessage } from '../../api/client.js';
import { resetSchema } from '../../auth/schemas.js';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import { Field, Input } from '../../components/ui/Input.jsx';
import { PATHS } from '../../routes/paths.js';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: params.get('email') || '' },
  });
  const e = formState.errors;

  const onSubmit = async ({ confirm: _confirm, ...values }) => {
    setError('');
    try {
      const res = await authApi.resetPassword(values);
      navigate(PATHS.login, { replace: true, state: { message: res.message } });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
      <div>
        <h2 className="text-lg font-semibold text-text">Nueva contraseña</h2>
        <p className="mt-1 text-sm text-text-muted">Si el correo está registrado, recibiste un código en Teams. Escríbelo junto con tu nueva contraseña.</p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Correo corporativo" error={e.email?.message}>
        {(p) => <Input {...p} type="email" autoComplete="username" {...register('email')} />}
      </Field>
      <Field label="Código de Teams" error={e.code?.message}>
        {(p) => <Input {...p} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" {...register('code')} />}
      </Field>
      <Field label="Nueva contraseña" error={e.password?.message} hint="Mínimo 10 caracteres, con letras y números">
        {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('password')} />}
      </Field>
      <Field label="Confirmar contraseña" error={e.confirm?.message}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('confirm')} />}
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={formState.isSubmitting}>
        Cambiar contraseña
      </Button>
      <p className="flex justify-between text-sm">
        <Link to={PATHS.forgotPassword} className="text-text-muted hover:underline">
          Solicitar otro código
        </Link>
        <Link to={PATHS.login} className="font-medium text-accent hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}
