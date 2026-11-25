import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { ROLE } from '../../constants/roles.js';
import { sendCode } from '../../integrations/teams/twoFactorWorkflow.js';
import { AppError } from '../../utils/AppError.js';
import * as changelog from '../changelog/changelog.service.js';
import { User } from '../users/user.model.js';
import { signAccessToken } from './token.js';
import { TwoFactorChallenge } from './twoFactorChallenge.model.js';

export const BCRYPT_COST = 12;
const RESEND_COOLDOWN_MS = 60_000;
const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';
let dummyHashPromise;
const dummyHash = () => (dummyHashPromise ??= bcrypt.hash(crypto.randomUUID(), BCRYPT_COST));

export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_COST);

export function isAllowedEmail(email) {
  if (env.allowedEmailDomains.length === 0) return true;
  const domain = String(email).split('@')[1]?.toLowerCase();
  return env.allowedEmailDomains.includes(domain);
}

const generateCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
const hashCode = (challengeId, code) =>
  crypto.createHmac('sha256', env.JWT_SECRET).update(`${challengeId}:${code}`).digest('hex');
const safeEqual = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const maskEmail = (email) => {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
};

export function publicUser(user) {
  const { passwordHash, __v, ...rest } = typeof user.toObject === 'function' ? user.toObject() : user;
  return rest;
}

/**
 * Normalizes the email typed at login. ADMIN_USERNAME (e.g. admin@zf.com) is an alias of the
 * fixed admin's real email (ADMIN_EMAIL), so codes always reach a real mailbox.
 */
export function resolveLoginEmail(email) {
  const normalized = email.toLowerCase().trim();
  return env.ADMIN_USERNAME && env.ADMIN_EMAIL && normalized === env.ADMIN_USERNAME ? env.ADMIN_EMAIL : normalized;
}

// ---------------------------------------------------------------------------- registration

export async function register({ name, email, password, employeeNumber, department, jobTitle }) {
  const normalized = email.toLowerCase().trim();
  if (env.ADMIN_USERNAME && normalized === env.ADMIN_USERNAME) throw AppError.duplicate('Ya existe una cuenta con ese correo');
  if (!isAllowedEmail(normalized)) {
    throw AppError.forbidden(`Solo se permiten correos de: ${env.allowedEmailDomains.map((d) => '@' + d).join(', ')}`);
  }
  if (await User.exists({ email: normalized })) throw AppError.duplicate('Ya existe una cuenta con ese correo');

  const user = await User.create({
    name,
    email: normalized,
    employeeNumber,
    department,
    jobTitle,
    roles: [ROLE.VIEWER],
    passwordHash: await hashPassword(password),
    passwordChangedAt: new Date(),
  });
  await changelog.record({
    entity: 'User',
    entityId: user._id,
    action: 'REGISTER',
    after: { name, email: normalized, roles: user.roles },
    user,
  });
  return publicUser(user);
}

// ---------------------------------------------------------------------------- challenges

async function issueChallenge(user, purpose, ip) {
  const code = generateCode();
  const now = new Date();
  const challenge = new TwoFactorChallenge({
    userId: user._id,
    purpose,
    codeHash: 'pending',
    sentAt: now,
    expiresAt: new Date(now.getTime() + env.TWO_FACTOR_CODE_TTL_MINUTES * 60_000),
    ip,
  });
  challenge.codeHash = hashCode(challenge._id, code);
  // Invalidate earlier open challenges of the same purpose.
  await TwoFactorChallenge.updateMany(
    { userId: user._id, purpose, consumedAt: null },
    { $set: { consumedAt: now } },
  );
  await challenge.save();

  try {
    await sendCode({ email: user.email, name: user.name, code, purpose, expiresInMinutes: env.TWO_FACTOR_CODE_TTL_MINUTES });
  } catch (err) {
    logger.error({ err: err.message, userId: user._id }, '2FA delivery failed');
    await TwoFactorChallenge.deleteOne({ _id: challenge._id });
    throw new AppError(502, 'TWO_FACTOR_DELIVERY_FAILED', 'No se pudo enviar el código por Teams. Intenta de nuevo.');
  }
  return challenge;
}

async function consumeChallenge(challenge, code) {
  if (!challenge || challenge.consumedAt) throw AppError.badRequest('El código ya no es válido. Solicita uno nuevo.');
  if (challenge.expiresAt < new Date()) throw AppError.badRequest('El código expiró. Solicita uno nuevo.');
  if (challenge.attempts >= env.TWO_FACTOR_MAX_ATTEMPTS) {
    throw AppError.tooMany('Demasiados intentos con este código. Solicita uno nuevo.');
  }
  if (!safeEqual(hashCode(challenge._id, code), challenge.codeHash)) {
    challenge.attempts += 1;
    await challenge.save();
    const left = env.TWO_FACTOR_MAX_ATTEMPTS - challenge.attempts;
    throw AppError.badRequest(left > 0 ? `Código incorrecto. Te quedan ${left} intento(s).` : 'Código incorrecto. Solicita uno nuevo.');
  }
  challenge.consumedAt = new Date();
  await challenge.save();
}

const challengeResponse = (challenge, user) => ({
  challengeId: challenge._id,
  expiresAt: challenge.expiresAt,
  resendAvailableAt: new Date(challenge.sentAt.getTime() + RESEND_COOLDOWN_MS),
  sentTo: maskEmail(user.email),
  channel: 'TEAMS',
});

// ---------------------------------------------------------------------------- login

export async function login({ email, password }, ip) {
  const user = await User.findOne({ email: resolveLoginEmail(email) }).select('+passwordHash');
  // Compare even when the user doesn't exist, to keep timing uniform.
  const ok = await bcrypt.compare(password, user?.passwordHash || (await dummyHash()));
  if (!user || !user.passwordHash || !ok) throw new AppError(401, 'UNAUTHENTICATED', INVALID_CREDENTIALS);
  if (!user.active) throw AppError.forbidden('Tu cuenta está desactivada. Contacta al administrador.');

  const challenge = await issueChallenge(user, 'LOGIN', ip);
  return challengeResponse(challenge, user);
}

export async function verifyLogin({ challengeId, code }) {
  const challenge = await TwoFactorChallenge.findOne({ _id: challengeId, purpose: 'LOGIN' });
  await consumeChallenge(challenge, code);

  const user = await User.findById(challenge.userId);
  if (!user || !user.active) throw AppError.unauthenticated('Usuario inactivo o inexistente');
  user.lastLoginAt = new Date();
  await user.save();

  return { token: await signAccessToken(user), user: publicUser(user) };
}

export async function resendLogin({ challengeId }, ip) {
  const previous = await TwoFactorChallenge.findOne({ _id: challengeId, purpose: 'LOGIN' });
  if (!previous || previous.consumedAt) throw AppError.badRequest('La sesión de verificación expiró. Inicia sesión de nuevo.');
  if (Date.now() - previous.sentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw AppError.tooMany('Espera un minuto antes de solicitar otro código.');
  }
  const user = await User.findById(previous.userId);
  if (!user || !user.active) throw AppError.unauthenticated();
  const challenge = await issueChallenge(user, 'LOGIN', ip);
  return challengeResponse(challenge, user);
}

// ---------------------------------------------------------------------------- password reset

/** Always answers the same way, so it can't be used to discover registered emails. */
export async function forgotPassword({ email }, ip) {
  const user = await User.findOne({ email: resolveLoginEmail(email), active: true });
  if (user) {
    const last = await TwoFactorChallenge.findOne({ userId: user._id, purpose: 'PASSWORD_RESET' }).sort({ createdAt: -1 });
    if (!last || Date.now() - last.sentAt.getTime() >= RESEND_COOLDOWN_MS) {
      await issueChallenge(user, 'PASSWORD_RESET', ip).catch((err) => logger.warn({ err: err.message }, 'reset code not sent'));
    }
  }
  return { message: 'Si el correo está registrado, recibirás un código en Teams.' };
}

export async function resetPassword({ email, code, password }) {
  const user = await User.findOne({ email: resolveLoginEmail(email), active: true });
  const challenge = user
    ? await TwoFactorChallenge.findOne({ userId: user._id, purpose: 'PASSWORD_RESET', consumedAt: null }).sort({ createdAt: -1 })
    : null;
  await consumeChallenge(challenge, code);

  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = new Date();
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  await user.save();
  await changelog.record({ entity: 'User', entityId: user._id, action: 'PASSWORD_RESET', user });
  return { message: 'Contraseña actualizada. Ya puedes iniciar sesión.' };
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash || ''))) {
    throw AppError.badRequest('La contraseña actual es incorrecta');
  }
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  await user.save();
  await changelog.record({ entity: 'User', entityId: user._id, action: 'UPDATE', after: { password: 'changed' }, user });
  // Issue a fresh token: the old ones are revoked by the new sessionVersion.
  return { token: await signAccessToken(user) };
}
