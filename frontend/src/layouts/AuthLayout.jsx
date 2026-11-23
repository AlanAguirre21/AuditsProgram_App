import { Navigate, Outlet, useSearchParams } from 'react-router-dom';
import ZfLogo from '../assets/ZF_logo.svg';
import { useAuth } from '../auth/useAuth.js';
import { FullPageSpinner } from '../components/ui/Spinner.jsx';
import es from '../i18n/es.js';

/** Centered glass card for login, register and password reset. */
export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const [params] = useSearchParams();
  if (isLoading) return <FullPageSpinner />;
  if (isAuthenticated) return <Navigate to={params.get('next') || '/'} replace />;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={ZfLogo} alt="ZF" className="neu-raised h-14 w-14 rounded-2xl bg-white p-1.5" />
          <h1 className="mt-4 text-xl font-semibold text-zf-blue">{es.appName}</h1>
          <p className="text-sm text-text-muted">{es.plant}</p>
        </div>
        <div className="glass neu-raised rounded-[28px] border border-white/50 bg-white/50 p-6 sm:p-8">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
