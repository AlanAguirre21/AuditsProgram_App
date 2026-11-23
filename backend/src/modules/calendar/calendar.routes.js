import { Router } from 'express';
import { z } from 'zod';
import { ROLE } from '../../constants/roles.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { isDateKey } from '../../utils/dates.js';
import * as ctrl from './calendar.controller.js';

const router = Router();
const idParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });

router.get('/', validate({ query: z.object({ year: z.coerce.number().int().optional() }) }), asyncHandler(ctrl.list));
router.post(
  '/',
  authorize(ROLE.ADMIN),
  validate({
    body: z.object({
      date: z.string().refine(isDateKey, 'Fecha inválida (YYYY-MM-DD)'),
      description: z.string().trim().min(2).max(200),
    }),
  }),
  asyncHandler(ctrl.create),
);
router.delete('/:id', authorize(ROLE.ADMIN), validate({ params: idParams }), asyncHandler(ctrl.remove));

export default router;
