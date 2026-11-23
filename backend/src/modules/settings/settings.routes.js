import { Router } from 'express';
import { z } from 'zod';
import { ROLE } from '../../constants/roles.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as settings from './settings.service.js';

const router = Router();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm');

const patchBody = z
  .object({
    plantQualityManagerId: z.string().regex(/^[a-f\d]{24}$/i).nullable(),
    emailEnabled: z.boolean(),
    qualityChannelEnabled: z.boolean(),
    dailyJobTime: time,
    digestDayOfWeek: z.number().int().min(0).max(6),
    digestTime: time,
    appBaseUrl: z.string().url(),
    lateCompletionCountsAsCompliant: z.boolean(),
    rescheduleAfterDueCountsAsLate: z.boolean(),
  })
  .partial()
  .strict();

router.get(
  '/',
  authorize(ROLE.ADMIN),
  asyncHandler(async (_req, res) => res.json({ data: await settings.getSettings() })),
);
router.patch(
  '/',
  authorize(ROLE.ADMIN),
  validate({ body: patchBody }),
  asyncHandler(async (req, res) => res.json({ data: await settings.updateSettings(req.body, req.user) })),
);

export default router;
