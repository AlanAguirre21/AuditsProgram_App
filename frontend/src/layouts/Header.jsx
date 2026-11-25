import { Link, useNavigate } from 'react-router-dom';
import ZfLogo from '../assets/ZF_logo.svg';
import { useAuth } from '../auth/useAuth.js';
import Icon from '../components/Icon.jsx';
import es from '../i18n/es.js';
import { PATHS } from '../routes/paths.js';
import { roleLabels } from '../utils/formatters.js';

export default function Header({ onMenu }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.name || '?')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <header className="glass sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/50 bg-white/50 px-4 py-2.5 lg:px-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onMenu} className="rounded-lg p-1.5 text-text-muted hover:bg-white/70 lg:hidden" aria-label="Abrir menú">
          <Icon name="menu" size={20} />
        </button>
        <img src={ZfLogo} alt="" className="h-7 w-7" />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-zf-blue">{es.appName}</p>
          <p className="hidden text-[11px] text-text-muted sm:block">{es.plant}</p>
        </div>
        {user?.features?.demo && (
          <span className="rounded-full bg-warning px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white" title="Base de datos de demostración">
            Datos de prueba
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Link to={PATHS.profile} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
          <span className="neu-raised flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#5AC8FA] text-xs font-semibold text-white">{initials}</span>
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-sm font-medium text-text">{user?.name}</span>
            <span className="block text-[11px] text-text-muted">{roleLabels(user?.roles)}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => {
            signOut();
            navigate(PATHS.login, { replace: true });
          }}
          className="rounded-full p-2 text-text-muted hover:bg-white/70 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          aria-label={es.nav.logout}
          title={es.nav.logout}
        >
          <Icon name="logout" />
        </button>
      </div>
    </header>
  );
}
