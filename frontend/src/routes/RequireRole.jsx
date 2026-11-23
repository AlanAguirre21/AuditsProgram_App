import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { PATHS } from './paths.js';

export default function RequireRole({ roles }) {
  const { hasRole } = useAuth();
  return hasRole(...roles) ? <Outlet /> : <Navigate to={PATHS.forbidden} replace />;
}
