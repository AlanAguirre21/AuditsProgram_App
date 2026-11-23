import { Router } from 'express';
import { z } from 'zod';
import { ROLE } from '../../constants/roles.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as ctrl from './users.controller.js';
import * as v from './users.validation.js';

const router = Router();

// "me" routes first so they don't match /:id.
router.patch('/me', validate({ body: v.updateMeBody }), asyncHandler(ctrl.updateMe));
router.patch('/me/preferences', validate({ body: v.updateMeBody.pick({ notificationPrefs: true }) }), asyncHandler(ctrl.updateMe));

router.get('/lookup', authorize(ROLE.ADMIN, ROLE.MANAGER), validate({ query: z.object({ q: z.string().max(100).optional() }) }), asyncHandler(ctrl.lookup));
router.get('/', authorize(ROLE.ADMIN), validate({ query: v.listQuery }), asyncHandler(ctrl.list));
router.post('/', authorize(ROLE.ADMIN), validate({ body: v.createBody }), asyncHandler(ctrl.create));
router.get('/:id', authorize(ROLE.ADMIN), validate({ params: v.idParams }), asyncHandler(ctrl.getById));
router.patch('/:id', authorize(ROLE.ADMIN), validate({ params: v.idParams, body: v.updateBody }), asyncHandler(ctrl.update));
router.post('/:id/reassign', authorize(ROLE.ADMIN), validate({ params: v.idParams, body: v.reassignBody }), asyncHandler(ctrl.reassign));

export default router;
