import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth.api.js';
import { errorMessage } from '../../api/client.js';
import { emailSchema } from '../../auth/schemas.js';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import { Field, Input } from '../../components/ui/Input.jsx';
import { PATHS } from '../../routes/paths.js';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError('Correo inválido');
    setBusy(true);
    setError('');
    try {
      await authApi.forgotPassword(parsed.data);
      navigate(`${PATHS.resetPassword}?email=${encodeURIComponent(parsed.data)}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <h2 className="text-lg font-semibold text-text">Recuperar contraseña</h2>
        <p className="mt-1 text-sm text-text-muted">Te enviaremos un código de verificación a tu Microsoft Teams.</p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Correo corporativo">
        {(p) => <Input {...p} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
        Enviar código
      </Button>
      <p className="text-center text-sm">
        <Link to={PATHS.login} className="font-medium text-accent hover:underline">
          ← Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
