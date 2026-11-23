import { AppError } from '../../utils/AppError.js';
import { escapeRegex, normalizeText } from '../../utils/pagination.js';
import { AuditDefinition } from '../audits/auditDefinition.model.js';
import * as changelog from '../changelog/changelog.service.js';
import { User } from '../users/user.model.js';
import { Group } from './group.model.js';

const USER_FIELDS = 'name email department active';

export async function list(query = {}) {
  const filter = {};
  if (query.active !== undefined) filter.active = query.active;
  if (query.q) filter.name = { $regex: escapeRegex(query.q), $options: 'i' };
  const groups = await Group.find(filter).sort({ name: 1 }).populate('leaderId', USER_FIELDS).populate('escalationContactId', USER_FIELDS).lean();
  return groups.map((g) => ({ ...g, memberCount: g.memberIds.length }));
}

export async function getById(id) {
  const group = await Group.findById(id)
    .populate('leaderId', USER_FIELDS)
    .populate('escalationContactId', USER_FIELDS)
    .populate('memberIds', USER_FIELDS)
    .lean();
  if (!group) throw AppError.notFound('Grupo no encontrado');
  const definitions = await AuditDefinition.find({ ownerGroupId: id, active: true }, { code: 1, name: 1, year: 1 }).sort({ year: -1, code: 1 }).lean();
  return { ...group, definitions };
}

/** Case- and accent-insensitive lookup used by the Excel import. */
export async function findByNormalizedName(name) {
  const target = normalizeText(name);
  const groups = await Group.find({}, { name: 1, active: 1 }).lean();
  return groups.find((g) => normalizeText(g.name) === target) ?? null;
}

async function assertUsers(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return;
  const count = await User.countDocuments({ _id: { $in: unique } });
  if (count !== unique.length) throw AppError.badRequest('Uno o más usuarios no existen');
}

export async function create(data, actor) {
  if (await findByNormalizedName(data.name)) throw AppError.duplicate('Ya existe un grupo con ese nombre');
  const memberIds = [...new Set([...(data.memberIds ?? []), data.leaderId].filter(Boolean).map(String))];
  await assertUsers([...memberIds, data.escalationContactId]);
  const group = await Group.create({ ...data, memberIds });
  await changelog.record({ entity: 'Group', entityId: group._id, action: 'CREATE', after: { name: group.name, leaderId: group.leaderId, memberIds }, user: actor });
  return group.toObject();
}

export async function update(id, patch, actor) {
  const group = await Group.findById(id);
  if (!group) throw AppError.notFound('Grupo no encontrado');
  if (patch.name) {
    const other = await findByNormalizedName(patch.name);
    if (other && String(other._id) !== String(id)) throw AppError.duplicate('Ya existe un grupo con ese nombre');
  }
  if (patch.active === false) await assertNoActiveDefinitions(id);
  await assertUsers([patch.leaderId, patch.escalationContactId]);

  const d = changelog.diff(group.toObject(), patch, Object.keys(patch));
  if (!d.changed) return group.toObject();
  group.set(patch);
  // The leader is always a member.
  if (patch.leaderId && !group.memberIds.some((m) => String(m) === String(patch.leaderId))) group.memberIds.push(patch.leaderId);
  await group.save();
  await changelog.record({ entity: 'Group', entityId: group._id, action: 'UPDATE', before: d.before, after: d.after, user: actor });
  return group.toObject();
}

export async function addMembers(id, userIds, actor) {
  await assertUsers(userIds);
  const group = await Group.findById(id);
  if (!group) throw AppError.notFound('Grupo no encontrado');
  const before = group.memberIds.map(String);
  const added = userIds.filter((u) => !before.includes(String(u)));
  if (!added.length) return group.toObject();
  group.memberIds.push(...added);
  await group.save();
  await changelog.record({ entity: 'Group', entityId: group._id, action: 'UPDATE', before: { memberIds: before }, after: { memberIds: group.memberIds }, meta: { added }, user: actor });
  return group.toObject();
}

export async function removeMember(id, userId, actor) {
  const group = await Group.findById(id);
  if (!group) throw AppError.notFound('Grupo no encontrado');
  const before = group.memberIds.map(String);
  if (!before.includes(String(userId))) throw AppError.notFound('El usuario no pertenece al grupo');
  if (String(group.leaderId) === String(userId)) throw AppError.conflict('No puedes quitar al líder del grupo. Cambia el líder primero.');
  group.memberIds = group.memberIds.filter((m) => String(m) !== String(userId));
  await group.save();
  await changelog.record({ entity: 'Group', entityId: group._id, action: 'UPDATE', before: { memberIds: before }, after: { memberIds: group.memberIds }, meta: { removed: userId }, user: actor });
  return group.toObject();
}

async function assertNoActiveDefinitions(id) {
  const count = await AuditDefinition.countDocuments({ ownerGroupId: id, active: true });
  if (count > 0) throw AppError.conflict(`El grupo tiene ${count} auditoría(s) activas asignadas`);
}

export async function remove(id, actor) {
  const group = await Group.findById(id);
  if (!group) throw AppError.notFound('Grupo no encontrado');
  await assertNoActiveDefinitions(id);
  group.active = false;
  await group.save();
  await changelog.record({ entity: 'Group', entityId: group._id, action: 'DELETE', before: { active: true }, after: { active: false }, user: actor });
}
