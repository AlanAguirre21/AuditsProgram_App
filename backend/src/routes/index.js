import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/authenticate.js';
import auditsRoutes from '../modules/audits/audits.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import calendarRoutes from '../modules/calendar/calendar.routes.js';
import changelogRoutes from '../modules/changelog/changelog.routes.js';
import evidenceRoutes from '../modules/evidence/evidence.routes.js';
import groupsRoutes from '../modules/groups/groups.routes.js';
import importsRoutes from '../modules/imports/imports.routes.js';
import occurrencesRoutes, { validationsRouter } from '../modules/occurrences/occurrences.routes.js';
import programRoutes from '../modules/program/program.routes.js';
import reportsRoutes from '../modules/reports/reports.routes.js';
import settingsRoutes from '../modules/settings/settings.routes.js';
import usersRoutes from '../modules/users/users.routes.js';

const router = Router();

// Public
router.get('/health', (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  res.status(dbOk ? 200 : 503).json({
    api: 'ok',
    db: dbOk ? 'ok' : 'down',
    worker: { status: 'not_configured', lastRunAt: null }, // Phase 2: reads jobRuns
  });
});
router.use('/auth', authRoutes);

// Everything below requires a session.
router.use(authenticate);
router.use('/users', usersRoutes);
router.use('/groups', groupsRoutes);
router.use('/audits', auditsRoutes);
router.use('/occurrences', occurrencesRoutes);
router.use('/evidence', evidenceRoutes);
router.use('/validations', validationsRouter);
router.use('/program', programRoutes);
router.use('/reports', reportsRoutes);
router.use('/calendar', calendarRoutes);
router.use('/imports', importsRoutes);
router.use('/changelog', changelogRoutes);
router.use('/settings', settingsRoutes);

export default router;
