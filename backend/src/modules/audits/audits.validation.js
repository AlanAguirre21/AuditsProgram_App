import { z } from 'zod';
import { CATEGORIES, EXECUTOR_TYPES } from '../../constants/auditCategories.js';
import { isDateKey } from '../../utils/dates.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido');
const dateKey = z.string().refine(isDateKey, 'Fecha inválida (YYYY-MM-DD)');
const month = z.number().int().min(1).max(12);

export const idParams = z.object({ id: objectId });

export const listQuery = z.object({
  year: z.coerce.number().int().optional(),
  category: z.enum(CATEGORIES).optional(),
  requiredBy: z.string().max(100).optional(),
  ownerGroupId: objectId.optional(),
  active: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  q: z.string().max(100).optional(),
});

const definitionFields = {
  code: z.number().int().min(1).max(9999),
  category: z.enum(CATEGORIES),
  name: z.string().trim().min(3).max(300),
  standard: z.string().trim().min(1).max(200),
  requiredBy: z.array(z.string().trim().min(1).max(100)).min(1, 'Indica al menos un cliente o entidad'),
  ownerGroupId: objectId,
  defaultOwnerUserId: objectId,
  executor: z.object({ type: z.enum(EXECUTOR_TYPES), name: z.string().trim().min(1).max(120) }),
  evidenceRequired: z.boolean(),
  requiresValidation: z.boolean(),
  folderPath: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  /** Overrides the default notification rule (null = use the default). */
  notificationRuleId: objectId.nullable().optional(),
};

export const createBody = z.object({
  ...definitionFields,
  year: z.number().int().min(2000).max(2100),
  evidenceRequired: z.boolean().default(true),
  requiresValidation: z.boolean().default(true),
  occurrences: z.array(z.object({ dueDate: dateKey })).optional(),
  months: z.array(month).optional(),
  force: z.boolean().optional(),
});

export const updateBody = z
  .object(definitionFields)
  .partial()
  .extend({ propagateOwner: z.boolean().optional(), reason: z.string().trim().max(500).optional() })
  .strict();

export const addOccurrencesBody = z
  .object({ dueDates: z.array(dateKey).optional(), months: z.array(month).optional(), force: z.boolean().optional() })
  .refine((b) => (b.dueDates?.length ?? 0) + (b.months?.length ?? 0) > 0, 'Indica al menos una fecha o mes');
