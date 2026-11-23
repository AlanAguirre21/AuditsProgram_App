import { NavLink } from 'react-router-dom';
import SfLogo from '../assets/SF_logo.svg';
import { useAuth } from '../auth/useAuth.js';
import Icon from '../components/Icon.jsx';
import { ROLE } from '../constants/roles.js';
import es from '../i18n/es.js';
import { PATHS } from '../routes/paths.js';

const { ADMIN, OWNER, MANAGER, VIEWER } = ROLE;
const ALL = [ADMIN, OWNER, MANAGER, VIEWER];

const MAIN = [
  { to: PATHS.home, label: es.nav.home, icon: 'home', roles: ALL, end: true },
  { to: PATHS.myAudits, label: es.nav.myAudits, icon: 'check', roles: [OWNER, MANAGER, ADMIN] },
  { to: PATHS.program, label: es.nav.program, icon: 'grid', roles: ALL },
  { to: PATHS.audits, label: es.nav.audits, icon: 'book', roles: [ADMIN, MANAGER, VIEWER] },
  { to: PATHS.validations, label: es.nav.validations, icon: 'shield', roles: [ADMIN] },
];

const ADMIN_ITEMS = [
  { to: PATHS.adminUsers, label: es.nav.users, icon: 'users' },
  { to: PATHS.adminGroups, label: es.nav.groups, icon: 'group' },
  { to: PATHS.adminCalendar, label: es.nav.calendar, icon: 'calendar' },
  { to: PATHS.adminImport, label: es.nav.import, icon: 'upload' },
  { to: PATHS.adminChangelog, label: es.nav.changelog, icon: 'history' },
];

function Item({ to, label, icon, end, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
        ${isActive ? 'bg-white text-zf-blue shadow-sm' : 'text-text-muted hover:bg-white/60 hover:text-text'}`
      }
    >
      <Icon name={icon} />
      {label}
    </NavLink>
  );
}

/** Menu filtered by the user's roles (the backend enforces the same rules). */
export default function Sidebar({ onNavigate }) {
  const { hasRole } = useAuth();
  const main = MAIN.filter((i) => hasRole(...i.roles));
  return (
    <nav aria-label="Menú principal" className="flex h-full flex-col gap-1 p-3">
      <div className="mb-3 px-2 pt-1">
        <img src={SfLogo} alt="SmartFactory" className="h-9 w-auto" />
      </div>
      {main.map((i) => (
        <Item key={i.to} {...i} onNavigate={onNavigate} />
      ))}
      {hasRole(ADMIN) && (
        <>
          <p className="mt-4 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-text-faint">{es.nav.admin}</p>
          {ADMIN_ITEMS.map((i) => (
            <Item key={i.to} {...i} onNavigate={onNavigate} />
          ))}
        </>
      )}
    </nav>
  );
}
