export function parsePagination(query = {}, { defaultLimit = 25, maxLimit = 100, defaultSort = '-createdAt' } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const sortStr = typeof query.sort === 'string' && /^-?[A-Za-z0-9_.]+$/.test(query.sort) ? query.sort : defaultSort;
  const sort = sortStr.startsWith('-') ? { [sortStr.slice(1)]: -1 } : { [sortStr]: 1 };
  return { page, limit, skip: (page - 1) * limit, sort };
}

export function pageMeta({ page, limit }, total) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Lowercase, strip accents and collapse spaces — for name matching. */
export const normalizeText = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
