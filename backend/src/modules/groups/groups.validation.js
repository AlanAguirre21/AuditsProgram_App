import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido');

export const idParams = z.object({ id: objectId });
export const memberParams = z.object({ id: objectId, userId: objectId });

export const listQuery = z.object({
  q: z.string().max(100).optional(),
  active: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export const createBody = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  leaderId: objectId.optional(),
  memberIds: z.array(objectId).optional(),
  escalationContactId: objectId.optional(),
});

export const updateBody = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500),
    leaderId: objectId.nullable(),
    escalationContactId: objectId.nullable(),
    active: z.boolean(),
  })
  .partial()
  .strict();

export const membersBody = z.object({ userIds: z.array(objectId).min(1) });
