import { env } from '../../config/env.js';
import { withTransaction } from '../../config/db.js';
import { ROLE } from '../../constants/roles.js';
import { OPEN_STATUSES } from '../../constants/statuses.js';
import { AppError } from '../../utils/AppError.js';
import { escapeRegex, pageMeta, parsePagination } from '../../utils/pagination.js';
import { AuditDefinition } from '../audits/auditDefinition.model.js';
import { hashPassword, isAllowedEmail, publicUser } from '../auth/auth.service.js';
import * as changelog from '../changelog/changelog.service.js';
import { Group } from '../groups/group.model.js';
import { notifyReassigned } from '../notifications/notifications.service.js';
import { Occurrence } from '../occurrences/occurrence.model.js';
import { User } from './user.model.js';

export async function list(query) {
  const pg = parsePagination(query, { defaultSort: 'name', defaultLimit: 50 });
  const filter = {};
  if (query.q) {
    const rx = { $regex: escapeRegex(query.q), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }, { employeeNumber: rx }, { department: rx }];
  }
  if (query.role) filter.roles = query.role;
  if (query.active !== undefined) filter.active = query.active;
  if (query.groupId) {
    const group = await Group.findById(query.groupId, { memberIds: 1 }).lean();
    filter._id = { $in: group?.memberIds ?? [] };
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort(pg.sort).skip(pg.skip).limit(pg.limit).populate('managerId', 'name email').lean(),
    User.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(pg, total) };
}

/** Lightweight list of active users for pickers. */
export async function lookup(q) {
  const filter = { active: true };
  if (q) filter.$or = [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { email: { $regex: escapeRegex(q), $options: 'i' } }];
  return User.find(filter, { name: 1, email: 1, department: 1, roles: 1 }).sort({ name: 1 }).limit(500).lean();
}

export async function getById(id) {
  const user = await User.findById(id).populate('managerId', 'name email').lean();
  if (!user) throw AppError.notFound('Usuario no encontrado');
  const [groups, openOccurrences] = await Promise.all([
    Group.find({ memberIds: user._id }, { name: 1, active: 1 }).lean(),
    Occurrence.countDocuments({ ownerUserId: user._id, status: { $in: OPEN_STATUSES } }),
  ]);
  return { ...user, groups, openOccurrences };
}

export async function create(data, actor) {
  const email = data.email.toLowerCase();
  if (!isAllowedEmail(email)) throw AppError.badRequest('El dominio del correo no está permitido');
  if ((env.ADMIN_USERNAME && email === env.ADMIN_USERNAME) || (await User.exists({ email }))) throw AppError.duplicate('Ya existe un usuario con ese correo');
  const user = await User.create({
    ...data,
    email,
    roles: data.roles?.length ? data.roles : [ROLE.VIEWER],
    passwordHash: await hashPassword(data.password),
    passwordChangedAt: new Date(),
  });
  await changelog.record({
    entity: 'User',
    entityId: user._id,
    action: 'CREATE',
    after: { name: user.name, email, roles: user.roles },
    user: actor,
  });
  return publicUser(user);
}

const EDITABLE = ['name', 'employeeNumber', 'department', 'jobTitle', 'managerId', 'roles', 'isQualitySupervisor', 'active'];

export async function update(id, patch, actor) {
  const user = await User.findById(id);
  if (!user) throw AppError.notFound('Usuario no encontrado');

  if (patch.active === false && user.active) {
    // BR-50: can't deactivate someone who still owns open occurrences.
    const open = await Occurrence.countDocuments({ ownerUserId: user._id, status: { $in: OPEN_STATUSES } });
    if (open > 0) {
      throw AppError.conflict(`El usuario tiene ${open} auditoría(s) abiertas. Reasígnalas antes de desactivarlo.`, { openOccurrences: open });
    }
  }
  if (patch.roles && String(actor._id) === String(user._id) && !patch.roles.includes(ROLE.ADMIN) && user.roles.includes(ROLE.ADMIN)) {
    const otherAdmins = await User.countDocuments({ _id: { $ne: user._id }, roles: ROLE.ADMIN, active: true });
    if (otherAdmins === 0) throw AppError.conflict('No puedes quitarte el rol ADMIN: eres el único administrador.');
  }
  if (patch.managerId && String(patch.managerId) === String(user._id)) {
    throw AppError.badRequest('Un usuario no puede ser su propio jefe');
  }

  const update = Object.fromEntries(Object.entries(patch).filter(([k]) => EDITABLE.includes(k)));
  if (update.roles && update.roles.length === 0) update.roles = [ROLE.VIEWER];
  const d = changelog.diff(user.toObject(), update, Object.keys(update));
  if (!d.changed) return publicUser(user);

  user.set(update);
  await user.save();
  await changelog.record({ entity: 'User', entityId: user._id, action: 'UPDATE', before: d.before, after: d.after, user: actor });
  return publicUser(user);
}

export async function updateMe(userId, patch) {
  const user = await User.findById(userId);
  const allowed = ['name', 'employeeNumber', 'department', 'jobTitle'];
  const update = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  if (patch.notificationPrefs) {
    update.notificationPrefs = { ...user.toObject().notificationPrefs, ...patch.notificationPrefs };
  }
  const d = changelog.diff(user.toObject(), update, Object.keys(update));
  if (!d.changed) return publicUser(user);
  user.set(update);
  await user.save();
  await changelog.record({ entity: 'User', entityId: user._id, action: 'UPDATE', before: d.before, after: d.after, user });
  return publicUser(user);
}

/**
 * BR-51: moves open occurrences (all, or the given ids) from one user to another.
 * Optionally also moves the user's default ownership on active definitions.
 */
export async function reassign(fromId, { toUserId, reason, occurrenceIds, includeDefinitions = true }, actor) {
  if (String(fromId) === String(toUserId)) throw AppError.badRequest('El usuario destino debe ser distinto');
  const [from, to] = await Promise.all([User.findById(fromId), User.findById(toUserId)]);
  if (!from) throw AppError.notFound('Usuario origen no encontrado');
  if (!to || !to.active) throw AppError.badRequest('El usuario destino no existe o está inactivo');

  const filter = { ownerUserId: from._id, status: { $in: OPEN_STATUSES } };
  if (occurrenceIds?.length) filter._id = { $in: occurrenceIds };

  const result = await withTransaction(async (session) => {
    const occs = await Occurrence.find(filter, { _id: 1 }).session(session ?? null).lean();
    for (const occ of occs) {
      await Occurrence.updateOne({ _id: occ._id }, { $set: { ownerUserId: to._id } }, { session });
      await changelog.record({
        entity: 'AuditOccurrence',
        entityId: occ._id,
        action: 'REASSIGN',
        before: { ownerUserId: from._id },
        after: { ownerUserId: to._id },
        reason,
        user: actor,
        session,
      });
    }
    let definitions = 0;
    if (includeDefinitions) {
      const defs = await AuditDefinition.find({ defaultOwnerUserId: from._id, active: true }, { _id: 1 }).session(session ?? null).lean();
      for (const def of defs) {
        await AuditDefinition.updateOne({ _id: def._id }, { $set: { defaultOwnerUserId: to._id } }, { session });
        await changelog.record({
          entity: 'AuditDefinition',
          entityId: def._id,
          action: 'REASSIGN',
          before: { defaultOwnerUserId: from._id },
          after: { defaultOwnerUserId: to._id },
          reason,
          user: actor,
          session,
        });
      }
      definitions = defs.length;
    }
    return { reassigned: occs.length, definitions, occurrenceIds: occs.map((o) => o._id) };
  });
  // BR-51: one Teams message to the new owner listing the occurrences (after commit).
  notifyReassigned(to._id, result.occurrenceIds, reason);
  return { reassigned: result.reassigned, definitions: result.definitions };
}
