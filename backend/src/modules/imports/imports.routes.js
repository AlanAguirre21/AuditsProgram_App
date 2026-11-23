import { Router } from 'express';
import { z } from 'zod';
import { CATEGORIES, EXECUTOR_TYPES } from '../../constants/auditCategories.js';
import { ROLE } from '../../constants/roles.js';
import { authorize } from '../../middleware/authorize.js';
import { uploadExcel } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as ctrl from './imports.controller.js';

const router = Router();
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const id = validate({ params: z.object({ id: objectId }) });

const patchBody = z.object({
  updates: z
    .array(
      z.object({
        row: z.number().int(),
        code: z.number().int().min(1).optional(),
        category: z.enum(CATEGORIES).optional(),
        name: z.string().trim().min(3).max(300).optional(),
        standard: z.string().trim().min(1).max(200).optional(),
        requiredBy: z.array(z.string().trim().min(1).max(100)).min(1).optional(),
        ownerGroupId: objectId.optional(),
        defaultOwnerUserId: objectId.optional(),
        executor: z.object({ type: z.enum(EXECUTOR_TYPES), name: z.string().trim().min(1).max(120) }).optional(),
        evidenceRequired: z.boolean().optional(),
        requiresValidation: z.boolean().optional(),
      }),
    )
    .optional(),
  bulk: z.object({ ownerGroupId: objectId.optional(), defaultOwnerUserId: objectId.optional() }).optional(),
});

router.use(authorize(ROLE.ADMIN));
router.post('/excel/preview', uploadExcel, asyncHandler(ctrl.preview));
router.get('/:id', id, asyncHandler(ctrl.get));
router.patch('/:id', validate({ params: z.object({ id: objectId }), body: patchBody }), asyncHandler(ctrl.patch));
router.post('/:id/create-groups', id, asyncHandler(ctrl.createGroups));
router.post('/:id/confirm', id, asyncHandler(ctrl.confirm));
router.delete('/:id', id, asyncHandler(ctrl.discard));
// Phase 4: POST /rollover/preview, POST /rollover/confirm

export default router;
