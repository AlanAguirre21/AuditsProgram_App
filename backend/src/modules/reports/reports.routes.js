import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as ctrl from './reports.controller.js';

const router = Router();

router.get('/dashboard', asyncHandler(ctrl.dashboard));
// Phase 3/4: /compliance, /export/program.xlsx, /export/program.pdf

export default router;
