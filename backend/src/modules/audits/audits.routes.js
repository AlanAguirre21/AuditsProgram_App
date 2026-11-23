import { Router } from 'express';
import { z } from 'zod';
import { ROLE } from '../../constants/roles.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as ctrl from './audits.controller.js';
import * as v from './audits.validation.js';

const router = Router();
const admin = authorize(ROLE.ADMIN);

router.get('/', validate({ query: v.listQuery }), asyncHandler(ctrl.list));
router.get('/meta', validate({ query: z.object({ year: z.coerce.number().int().optional() }) }), asyncHandler(ctrl.meta));
router.get('/:id', validate({ params: v.idParams }), asyncHandler(ctrl.getById));
router.post('/', admin, validate({ body: v.createBody }), asyncHandler(ctrl.create));
router.patch('/:id', admin, validate({ params: v.idParams, body: v.updateBody }), asyncHandler(ctrl.update));
router.delete('/:id', admin, validate({ params: v.idParams }), asyncHandler(ctrl.remove));
router.post('/:id/occurrences', admin, validate({ params: v.idParams, body: v.addOccurrencesBody }), asyncHandler(ctrl.addOccurrences));

export default router;
