// Phase 2: scheduler entry point (reminders, escalation, digest, year close).
// Kept as a separate PM2 process; the API never schedules jobs (spec 11.2).
import { logger } from './config/logger.js';

logger.info('Worker not implemented yet (Phase 2).');
