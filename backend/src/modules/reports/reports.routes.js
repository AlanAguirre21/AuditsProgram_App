import { Router } from 'express';
import { z } from 'zod';
import { ROLE } from '../../constants/roles.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { currentYearInTz } from './reports.service.js';
import { GROUP_BY } from './reports.compliance.js';
import * as ctrl from './reports.controller.js';

const router = Router();
const managers = authorize(ROLE.ADMIN, ROLE.MANAGER);
const year = z.coerce.number().int().min(2000).max(2100).default(() => currentYearInTz());

router.get('/dashboard', asyncHandler(ctrl.dashboard));
router.get('/compliance', managers, validate({ query: z.object({ year, groupBy: z.enum(GROUP_BY).default('month') }) }), asyncHandler(ctrl.compliance));
router.get('/export/program.xlsx', managers, validate({ query: z.object({ year }) }), asyncHandler(ctrl.exportXlsx));
router.get('/export/program.pdf', managers, validate({ query: z.object({ year }) }), asyncHandler(ctrl.exportPdf));

export default router;
