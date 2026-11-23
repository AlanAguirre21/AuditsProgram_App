import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth.api.js';
import { errorMessage } from '../../api/client.js';
import { registerSchema } from '../../auth/schemas.js';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import { Field, Input } from '../../components/ui/Input.jsx';
import { PATHS } from '../../routes/paths.js';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(registerSchema) });
  const e = formState.errors;

  const onSubmit = async ({ confirm: _confirm, ...values }) => {
    setError('');
    try {
      await authApi.register(values);
      navigate(PATHS.login, { replace: true, state: { message: 'Cuenta creada. Inicia sesión; te enviaremos un código por Teams.' } });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
      <div>
        <h2 className="text-lg font-semibold text-text">Crear cuenta</h2>
        <p className="mt-1 text-xs text-text-muted">Usa tu correo corporativo. Un administrador te asignará los permisos que correspondan.</p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Nombre completo" required error={e.name?.message}>
        {(p) => <Input {...p} autoComplete="name" {...register('name')} />}
      </Field>
      <Field label="Correo corporativo" required error={e.email?.message}>
        {(p) => <Input {...p} type="email" autoComplete="email" {...register('email')} />}
      </Field>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="No. de empleado" error={e.employeeNumber?.message}>
          {(p) => <Input {...p} {...register('employeeNumber')} />}
        </Field>
        <Field label="Departamento" error={e.department?.message}>
          {(p) => <Input {...p} {...register('department')} />}
        </Field>
      </div>
      <Field label="Contraseña" required error={e.password?.message} hint="Mínimo 10 caracteres, con letras y números">
        {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('password')} />}
      </Field>
      <Field label="Confirmar contraseña" required error={e.confirm?.message}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('confirm')} />}
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={formState.isSubmitting}>
        Registrarme
      </Button>
      <p className="text-center text-sm text-text-muted">
        ¿Ya tienes cuenta?{' '}
        <Link to={PATHS.login} className="font-medium text-accent hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
