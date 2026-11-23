import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as ctrl from './evidence.controller.js';

const router = Router();
const id = validate({ params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }) });

// Upload lives under /occurrences/:id/evidence.
router.get('/:id/download', id, asyncHandler(ctrl.download));
router.delete('/:id', id, asyncHandler(ctrl.remove));

export default router;
