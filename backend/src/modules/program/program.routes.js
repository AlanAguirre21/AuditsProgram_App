import { Router } from 'express';
import { z } from 'zod';
import { CATEGORIES } from '../../constants/auditCategories.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getProgram } from './program.service.js';

const router = Router();

router.get(
  '/:year',
  validate({
    params: z.object({ year: z.coerce.number().int().min(2000).max(2100) }),
    query: z.object({
      category: z.enum(CATEGORIES).optional(),
      requiredBy: z.string().max(100).optional(),
      ownerGroupId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    }),
  }),
  asyncHandler(async (req, res) => res.json({ data: await getProgram(req.params.year, req.query) })),
);

export default router;
