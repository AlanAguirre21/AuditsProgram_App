import { Router } from 'express';
import { ROLE } from '../../constants/roles.js';
import { authorize } from '../../middleware/authorize.js';
import { uploadEvidence } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as ctrl from './occurrences.controller.js';
import * as v from './occurrences.validation.js';

const router = Router();
const admin = authorize(ROLE.ADMIN);
const id = validate({ params: v.idParams });

router.get('/', validate({ query: v.listQuery }), asyncHandler(ctrl.list));
router.get('/mine', validate({ query: v.listQuery }), asyncHandler(ctrl.mine));
router.get('/:id', id, asyncHandler(ctrl.getDetail));
router.get('/:id/history', id, asyncHandler(ctrl.history));
router.patch('/:id', admin, validate({ params: v.idParams, body: v.updateBody }), asyncHandler(ctrl.update));

// Ownership ("own") is checked in the service layer.
router.post('/:id/complete', validate({ params: v.idParams, body: v.completeBody }), asyncHandler(ctrl.complete));
router.post('/:id/evidence', id, uploadEvidence, asyncHandler(ctrl.uploadEvidence));
router.post('/:id/reschedule-request', validate({ params: v.idParams, body: v.rescheduleRequestBody }), asyncHandler(ctrl.requestReschedule));

router.post('/:id/validate', admin, id, asyncHandler(ctrl.validate));
router.post('/:id/reject', admin, validate({ params: v.idParams, body: v.rejectBody }), asyncHandler(ctrl.reject));
router.post('/:id/reschedule-request/approve', admin, id, asyncHandler(ctrl.approveReschedule));
router.post('/:id/reschedule-request/reject', admin, validate({ params: v.idParams, body: v.rejectBody }), asyncHandler(ctrl.rejectReschedule));
router.post('/:id/reschedule', admin, validate({ params: v.idParams, body: v.rescheduleDirectBody }), asyncHandler(ctrl.reschedule));
router.post('/:id/cancel', admin, validate({ params: v.idParams, body: v.reasonBody }), asyncHandler(ctrl.cancel));
router.post('/:id/close-not-done', admin, validate({ params: v.idParams, body: v.reasonBody }), asyncHandler(ctrl.closeNotDone));
router.post('/:id/reopen', admin, validate({ params: v.idParams, body: v.reasonBody }), asyncHandler(ctrl.reopen));

export const validationsRouter = Router();
validationsRouter.get('/', admin, asyncHandler(ctrl.validationQueue));

export default router;
