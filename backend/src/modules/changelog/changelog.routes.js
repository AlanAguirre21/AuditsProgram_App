import { Router } from 'express';
import { z } from 'zod';
import { ROLE } from '../../constants/roles.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { CHANGE_ACTIONS, CHANGE_ENTITIES } from './changeLog.model.js';
import * as ctrl from './changelog.controller.js';

const router = Router();

const query = z.object({
  entity: z.enum(CHANGE_ENTITIES).optional(),
  entityId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  userId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  action: z.enum(CHANGE_ACTIONS).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sort: z.string().optional(),
});

// Read-only by design: no route updates or deletes change log entries.
router.get('/', authorize(ROLE.ADMIN), validate({ query }), asyncHandler(ctrl.list));

export default router;
