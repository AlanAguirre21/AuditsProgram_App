/**
 * Keeps the fixed administrator account (ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD) exactly as
 * configured. Runs on every API start and from scripts/createAdmin.js.
 *
 * - Creates the account if it does not exist.
 * - Ensures roles ADMIN + OWNER, quality supervisor, active.
 * - Resets the password to ADMIN_PASSWORD if it was changed (sessions are revoked then).
 *
 * ADMIN_USERNAME (e.g. admin@zf.com) is only a login alias resolved in auth.service; it is not stored.
 */
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { ROLE } from '../../constants/roles.js';
import { hashPassword } from '../auth/auth.service.js';
import * as changelog from '../changelog/changelog.service.js';
import { User } from './user.model.js';

export async function ensureAdmin({ email = env.ADMIN_EMAIL, name = env.ADMIN_NAME, password = env.ADMIN_PASSWORD } = {}) {
  if (!email) return null;
  email = email.toLowerCase().trim();

  let user = await User.findOne({ email }).select('+passwordHash');
  const changes = [];

  if (!user) {
    if (!password) throw new Error(`Cannot create admin ${email} without a password`);
    user = await User.create({
      email,
      name,
      roles: [ROLE.ADMIN, ROLE.OWNER],
      isQualitySupervisor: true,
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
    });
    changes.push('created');
  } else {
    const roles = [...new Set([...user.roles, ROLE.ADMIN, ROLE.OWNER])];
    if (roles.length !== user.roles.length) {
      user.roles = roles;
      changes.push('roles');
    }
    if (!user.isQualitySupervisor) {
      user.isQualitySupervisor = true;
      changes.push('supervisor');
    }
    if (!user.active) {
      user.active = true;
      changes.push('active');
    }
    // password = null (createAdmin --email without --password): keep the current one.
    if (password && (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash)))) {
      user.passwordHash = await hashPassword(password);
      user.passwordChangedAt = new Date();
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;
      changes.push('password');
    }
    if (changes.length) await user.save();
  }

  if (changes.length) {
    await changelog.record({
      entity: 'User',
      entityId: user._id,
      action: changes.includes('created') ? 'CREATE' : 'UPDATE',
      after: { email, roles: user.roles, fields: changes },
      reason: 'Cuenta de administrador fija (ADMIN_EMAIL)',
      system: true,
    });
    logger.info({ email, changes }, 'Fixed admin account updated');
  }
  return { user, changes };
}
