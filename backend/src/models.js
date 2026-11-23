/**
 * Registers every Mongoose model. Imported by both entry points (server.js, worker.js) so that
 * populate() works no matter which modules a process happens to load.
 */
import './jobs/job.models.js';
import './modules/audits/auditDefinition.model.js';
import './modules/auth/twoFactorChallenge.model.js';
import './modules/calendar/calendar.model.js';
import './modules/changelog/changeLog.model.js';
import './modules/evidence/evidence.model.js';
import './modules/groups/group.model.js';
import './modules/imports/import.model.js';
import './modules/notifications/notificationLog.model.js';
import './modules/notifications/notificationRule.model.js';
import './modules/occurrences/occurrence.model.js';
import './modules/settings/settings.model.js';
import './modules/users/user.model.js';
