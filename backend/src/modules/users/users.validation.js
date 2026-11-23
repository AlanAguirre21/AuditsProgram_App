import { z } from 'zod';
import { ROLES } from '../../constants/roles.js';
import { passwordSchema } from '../auth/auth.validation.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido');
export const idParams = z.object({ id: objectId });

const boolQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

export const listQuery = z.object({
  q: z.string().max(100).optional(),
  role: z.enum(ROLES).optional(),
  active: boolQuery,
  groupId: objectId.optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sort: z.string().optional(),
});

export const createBody = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  employeeNumber: z.string().trim().max(30).optional(),
  department: z.string().trim().max(100).optional(),
  jobTitle: z.string().trim().max(100).optional(),
  roles: z.array(z.enum(ROLES)).optional(),
  isQualitySupervisor: z.boolean().optional(),
  managerId: objectId.optional(),
});

export const updateBody = z
  .object({
    name: z.string().trim().min(3).max(120),
    employeeNumber: z.string().trim().max(30),
    department: z.string().trim().max(100),
    jobTitle: z.string().trim().max(100),
    managerId: objectId.nullable(),
    roles: z.array(z.enum(ROLES)),
    isQualitySupervisor: z.boolean(),
    active: z.boolean(),
  })
  .partial()
  .strict();

export const updateMeBody = z
  .object({
    name: z.string().trim().min(3).max(120),
    employeeNumber: z.string().trim().max(30),
    department: z.string().trim().max(100),
    jobTitle: z.string().trim().max(100),
    notificationPrefs: z.object({ email: z.boolean(), teams: z.boolean() }).partial(),
  })
  .partial()
  .strict();

export const reassignBody = z.object({
  toUserId: objectId,
  reason: z.string().trim().min(10, 'El motivo debe tener al menos 10 caracteres').max(500),
  occurrenceIds: z.array(objectId).optional(),
  includeDefinitions: z.boolean().optional(),
});
