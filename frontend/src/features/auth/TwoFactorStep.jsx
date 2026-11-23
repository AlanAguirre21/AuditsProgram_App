import { useEffect, useState } from 'react';
import { authApi } from '../../api/auth.api.js';
import { errorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import { Field, Input } from '../../components/ui/Input.jsx';

const secondsUntil = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));

/** Second login step: the 6-digit code sent to the user's Teams. */
export default function TwoFactorStep({ challenge: initial, onVerified, onBack }) {
  const [challenge, setChallenge] = useState(initial);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const expiresIn = secondsUntil(challenge.expiresAt);
  const resendIn = secondsUntil(challenge.resendAvailableAt);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError('El código tiene 6 dígitos');
    setBusy(true);
    setError('');
    try {
      const { token } = await authApi.verify({ challengeId: challenge.challengeId, code });
      onVerified(token);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError('');
    try {
      setChallenge(await authApi.resend(challenge.challengeId));
      setCode('');
      setInfo('Te enviamos un nuevo código.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  };

  const mm = String(Math.floor(expiresIn / 60)).padStart(1, '0');
  const ss = String(expiresIn % 60).padStart(2, '0');

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <h2 className="text-lg font-semibold text-text">Verificación en dos pasos</h2>
        <p className="mt-1 text-sm text-text-muted">
          Enviamos un código de 6 dígitos a tu <strong>Microsoft Teams</strong> ({challenge.sentTo}).
        </p>
      </div>
      {info && <Alert tone="success">{info}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Código de verificación" hint={expiresIn > 0 ? `Expira en ${mm}:${ss}` : 'El código expiró. Solicita uno nuevo.'}>
        {(p) => (
          <Input
            {...p}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="text-center text-2xl tracking-[0.5em] font-semibold"
            autoFocus
          />
        )}
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={code.length !== 6 || expiresIn === 0}>
        Verificar e ingresar
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="text-text-muted hover:text-text hover:underline">
          ← Usar otra cuenta
        </button>
        <button type="button" onClick={resend} disabled={resendIn > 0 || resending} className="font-medium text-accent hover:underline disabled:text-text-faint disabled:no-underline">
          {resendIn > 0 ? `Reenviar en ${resendIn}s` : 'Reenviar código'}
        </button>
      </div>
    </form>
  );
}
