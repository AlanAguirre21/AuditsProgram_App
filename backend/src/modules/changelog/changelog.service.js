import mongoose from 'mongoose';
import { escapeRegex, pageMeta, parsePagination } from '../../utils/pagination.js';
import { ChangeLog } from './changeLog.model.js';

const normalize = (v) => {
  if (v instanceof mongoose.Types.ObjectId) return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === 'object' && !(v instanceof Buffer)) {
    // Mongoose nested paths may expose a toObject() that returns undefined: fall back to the value.
    const src = (typeof v.toObject === 'function' ? v.toObject() : v) ?? v;
    return Object.fromEntries(Object.entries(src).map(([k, x]) => [k, normalize(x)]));
  }
  return v;
};

/** Returns { before, after } with only the fields whose values differ. */
export function diff(before = {}, after = {}, fields = Object.keys(after)) {
  const b = {};
  const a = {};
  for (const f of fields) {
    const bv = normalize(before?.[f]);
    const av = normalize(after?.[f]);
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      b[f] = bv ?? null;
      a[f] = av ?? null;
    }
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 };
}

/**
 * Appends one change log entry. Pass `session` to write inside the caller's transaction.
 * `user` may be null for system actions.
 */
export async function record({ entity, entityId, action, before, after, reason, meta, user, system = false, at, session }) {
  const [doc] = await ChangeLog.create(
    [
      {
        entity,
        entityId,
        action,
        before: before === undefined ? undefined : normalize(before),
        after: after === undefined ? undefined : normalize(after),
        reason,
        meta,
        userId: user?._id ?? null,
        system: system || !user,
        at: at ?? new Date(),
      },
    ],
    { session },
  );
  return doc;
}

export async function list(query) {
  const pg = parsePagination(query, { defaultSort: '-at', defaultLimit: 50 });
  const filter = {};
  if (query.entity) filter.entity = query.entity;
  if (query.entityId) filter.entityId = query.entityId;
  if (query.userId) filter.userId = query.userId;
  if (query.action) filter.action = query.action;
  if (query.from || query.to) {
    filter.at = {};
    if (query.from) filter.at.$gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) filter.at.$lte = new Date(`${query.to}T23:59:59.999Z`);
  }
  if (query.q) filter.reason = { $regex: escapeRegex(query.q), $options: 'i' };

  const [items, total] = await Promise.all([
    ChangeLog.find(filter).sort(pg.sort).skip(pg.skip).limit(pg.limit).populate('userId', 'name email').lean(),
    ChangeLog.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(pg, total) };
}

export async function forEntity(entity, entityId) {
  return ChangeLog.find({ entity, entityId }).sort({ at: -1 }).populate('userId', 'name email').lean();
}
