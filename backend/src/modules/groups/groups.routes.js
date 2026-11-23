import { Router } from 'express';
import { ROLE } from '../../constants/roles.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as ctrl from './groups.controller.js';
import * as v from './groups.validation.js';

const router = Router();
const admin = authorize(ROLE.ADMIN);

router.get('/', validate({ query: v.listQuery }), asyncHandler(ctrl.list));
router.get('/:id', validate({ params: v.idParams }), asyncHandler(ctrl.getById));
router.post('/', admin, validate({ body: v.createBody }), asyncHandler(ctrl.create));
router.patch('/:id', admin, validate({ params: v.idParams, body: v.updateBody }), asyncHandler(ctrl.update));
router.post('/:id/members', admin, validate({ params: v.idParams, body: v.membersBody }), asyncHandler(ctrl.addMembers));
router.delete('/:id/members/:userId', admin, validate({ params: v.memberParams }), asyncHandler(ctrl.removeMember));
router.delete('/:id', admin, validate({ params: v.idParams }), asyncHandler(ctrl.remove));

export default router;
