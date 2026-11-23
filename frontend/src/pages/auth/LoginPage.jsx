import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/auth.api.js';
import { errorMessage } from '../../api/client.js';
import { loginSchema } from '../../auth/schemas.js';
import { useAuth } from '../../auth/useAuth.js';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import { Field, Input } from '../../components/ui/Input.jsx';
import TwoFactorStep from '../../features/auth/TwoFactorStep.jsx';
import { PATHS } from '../../routes/paths.js';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(loginSchema) });

  const next = params.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const onSubmit = async (values) => {
    setError('');
    try {
      setChallenge(await authApi.login(values));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (challenge) {
    return (
      <TwoFactorStep
        challenge={challenge}
        onBack={() => setChallenge(null)}
        onVerified={(token) => {
          signIn(token);
          navigate(safeNext, { replace: true });
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <h2 className="text-lg font-semibold text-text">Iniciar sesión</h2>
      {location.state?.message && <Alert tone="success">{location.state.message}</Alert>}
      {next && <Alert tone="info">Inicia sesión para continuar.</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Correo corporativo" error={formState.errors.email?.message}>
        {(p) => <Input {...p} type="email" autoComplete="username" placeholder="nombre.apellido@zf.com" {...register('email')} />}
      </Field>
      <Field label="Contraseña" error={formState.errors.password?.message}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" {...register('password')} />}
      </Field>
      <div className="text-right">
        <Link to={PATHS.forgotPassword} className="text-xs font-medium text-accent hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={formState.isSubmitting}>
        Continuar
      </Button>
      <p className="text-center text-sm text-text-muted">
        ¿No tienes cuenta?{' '}
        <Link to={PATHS.register} className="font-medium text-accent hover:underline">
          Regístrate
        </Link>
      </p>
    </form>
  );
}
