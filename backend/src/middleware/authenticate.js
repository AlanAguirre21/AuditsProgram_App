import { verifyAccessToken } from '../modules/auth/token.js';
import { User } from '../modules/users/user.model.js';
import { AppError } from '../utils/AppError.js';

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw AppError.unauthenticated();

    const payload = await verifyAccessToken(token).catch(() => {
      throw AppError.unauthenticated();
    });

    const user = await User.findById(payload.sub).lean();
    if (!user || !user.active) throw AppError.unauthenticated('Usuario inactivo o inexistente');

    // Tokens issued before the last password change/reset are revoked.
    if ((payload.ver ?? 0) !== (user.sessionVersion ?? 0)) {
      throw AppError.unauthenticated('La sesión expiró. Inicia sesión de nuevo.');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
