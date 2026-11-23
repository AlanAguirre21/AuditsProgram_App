import { Router } from 'express';
import { z } from 'zod';
import { CHANNELS, ESCALATION_TARGETS, NOTIFICATION_TYPES } from '../../constants/notifications.js';
import { ROLE } from '../../constants/roles.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as ctrl from './notifications.controller.js';

const router = Router();
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const id = validate({ params: z.object({ id: objectId }) });

const ruleFields = {
  name: z.string().trim().min(2).max(120),
  reminderOffsetsDays: z.array(z.number().int().min(1).max(90)).max(10),
  sendOnDueDate: z.boolean(),
  overdueRepeatEveryDays: z.number().int().min(1).max(30),
  escalationLevels: z
    .array(z.object({ level: z.number().int().min(1).max(3), afterDaysOverdue: z.number().int().min(0).max(120), target: z.enum(ESCALATION_TARGETS) }))
    .max(3),
  includeGroupMembers: z.boolean(),
  channels: z
    .array(z.enum(CHANNELS))
    .refine((c) => c.includes('TEAMS_CHAT'), 'El chat de Teams es obligatorio: es el canal principal'),
  active: z.boolean(),
};

router.use(authorize(ROLE.ADMIN));
router.get('/rules', asyncHandler(ctrl.listRules));
router.post('/rules', validate({ body: z.object(ruleFields).partial({ active: true }) }), asyncHandler(ctrl.createRule));
router.patch('/rules/:id', validate({ params: z.object({ id: objectId }), body: z.object(ruleFields).partial().strict() }), asyncHandler(ctrl.updateRule));
router.get(
  '/log',
  validate({
    query: z.object({
      status: z.enum(['PENDING', 'SENT', 'FAILED']).optional(),
      type: z.enum(NOTIFICATION_TYPES).optional(),
      channel: z.enum(CHANNELS).optional(),
      occurrenceId: objectId.optional(),
      recipientId: objectId.optional(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      page: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
      sort: z.string().optional(),
    }),
  }),
  asyncHandler(ctrl.listLog),
);
router.post('/log/:id/retry', id, asyncHandler(ctrl.retry));
router.post('/test', validate({ body: z.object({ channel: z.boolean().optional() }) }), asyncHandler(ctrl.test));

export default router;
