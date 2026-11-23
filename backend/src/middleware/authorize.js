import { AppError } from '../utils/AppError.js';

export const hasRole = (user, ...roles) => Boolean(user?.roles?.some((r) => roles.includes(r)));

/** authorize('ADMIN', 'MANAGER') — the user needs at least one of the roles. */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(AppError.unauthenticated());
    if (!hasRole(req.user, ...roles)) return next(AppError.forbidden());
    next();
  };
