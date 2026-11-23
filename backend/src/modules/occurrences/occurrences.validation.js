import { z } from 'zod';
import { CATEGORIES } from '../../constants/auditCategories.js';
import { DERIVED, STATUSES } from '../../constants/statuses.js';
import { isDateKey } from '../../utils/dates.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido');
export const dateKey = z.string().refine(isDateKey, 'Fecha inválida (YYYY-MM-DD)');
const reason = z.string().trim().min(10, 'El motivo debe tener al menos 10 caracteres').max(1000);

export const idParams = z.object({ id: objectId });

const statusList = z
  .union([z.enum(STATUSES), z.string().transform((s) => s.split(','))])
  .pipe(z.union([z.enum(STATUSES), z.array(z.enum(STATUSES))]));

export const listQuery = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  status: statusList.optional(),
  derived: z.enum(Object.values(DERIVED)).optional(),
  ownerUserId: objectId.optional(),
  ownerGroupId: objectId.optional(),
  definitionId: objectId.optional(),
  category: z.enum(CATEGORIES).optional(),
  requiredBy: z.string().max(100).optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sort: z.string().optional(),
});

const count = z.coerce.number().int().min(0).max(999);

export const completeBody = z.object({
  performedAt: dateKey,
  findings: z.object({ major: count, minor: count, observations: count }),
  findingsSummary: z.string().trim().max(2000).optional(),
  externalRef: z.string().trim().max(200).optional(),
});

export const updateBody = z.object({ ownerUserId: objectId, reason });
export const rejectBody = z.object({ comment: reason });
export const rescheduleRequestBody = z.object({ requestedDate: dateKey, reason });
export const rescheduleDirectBody = z.object({ newDate: dateKey, reason });
export const reasonBody = z.object({ reason });
