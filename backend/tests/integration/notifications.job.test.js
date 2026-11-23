/**
 * Phase 2 acceptance: with a fixed date the worker sends exactly the notifications of spec 8.1,
 * running twice sends nothing new, and EN_VALIDACION gets no reminders.
 */
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectDb } from '../../src/config/db.js';
import { runDailyNotifications } from '../../src/jobs/notifications.job.js';
import { runJob } from '../../src/jobs/runtime.js';
import { runYearClose } from '../../src/jobs/yearClose.job.js';
import { runWeeklyDigest } from '../../src/jobs/digest.job.js';
import { AuditDefinition } from '../../src/modules/audits/auditDefinition.model.js';
import { Group } from '../../src/modules/groups/group.model.js';
import { NotificationLog } from '../../src/modules/notifications/notificationLog.model.js';
import { Occurrence } from '../../src/modules/occurrences/occurrence.model.js';
import { Settings } from '../../src/modules/settings/settings.model.js';
import { User } from '../../src/modules/users/user.model.js';
import { parseDateKey } from '../../src/utils/dates.js';

const ids = {};

async function occurrence(due, extra = {}) {
  const d = parseDateKey(due);
  return Occurrence.create({ definitionId: ids.def, year: 2026, dueDate: d, originalDueDate: d, ownerUserId: ids.owner, ownerGroupId: ids.group, ...extra });
}

const sentFor = (occId, filter = {}) => NotificationLog.find({ occurrenceId: occId, ...filter }).sort({ type: 1, level: 1, recipientAddress: 1 }).lean();
const summary = (logs) => logs.map((l) => `${l.type}${l.level ? `:${l.level}` : ''}→${l.recipientAddress}`).sort();

beforeAll(async () => {
  await connectDb(process.env.MONGO_URI);
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  const [manager, sup, plant] = await User.create([
    { name: 'Gerente', email: 'gerente@zf.com', roles: ['MANAGER'] },
    { name: 'Supervisora', email: 'sup@zf.com', roles: ['ADMIN'], isQualitySupervisor: true, notificationPrefs: { email: true } },
    { name: 'Gerente Planta', email: 'planta@zf.com', roles: ['VIEWER'] },
  ]);
  const owner = await User.create({ name: 'Responsable', email: 'owner@zf.com', roles: ['OWNER'], managerId: manager._id });
  const group = await Group.create({ name: 'Equipo Soldadura', memberIds: [owner._id], leaderId: owner._id });
  const def = await AuditDefinition.create({
    code: 1, year: 2026, category: 'CSR', name: 'Welding', standard: 'CQI-15', requiredBy: ['GM'],
    ownerGroupId: group._id, defaultOwnerUserId: owner._id, executor: { type: 'INTERNAL', name: 'Equipo Soldadura' },
  });
  await Settings.create({ _id: 'global', plantQualityManagerId: plant._id });
  Object.assign(ids, { owner: owner._id, manager: manager._id, sup: sup._id, plant: plant._id, group: group._id, def: def._id });
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

describe('daily notifications job', () => {
  it('sends exactly the scheduled notifications for a fixed date', async () => {
    const reminder = await occurrence('2026-10-19'); // Monday 10-05 = D-14
    const overdueN1 = await occurrence('2026-09-30'); // 10-05: D+5 → OVERDUE + N1 (D+3 was Saturday)
    const n2 = await occurrence('2026-09-28', { lastEscalationLevel: 1 }); // 10-05 = D+7 → OVERDUE + N2
    const validating = await occurrence('2026-09-15', { status: 'EN_VALIDACION' });
    const quiet = await occurrence('2026-10-30'); // D-25: nothing

    const res = await runDailyNotifications('2026-10-05');
    expect(res.failed).toBe(0);

    expect(summary(await sentFor(reminder._id))).toEqual(['REMINDER→owner@zf.com']);
    expect(summary(await sentFor(overdueN1._id))).toEqual(['ESCALATION:1→gerente@zf.com', 'OVERDUE→owner@zf.com']);
    expect(summary(await sentFor(n2._id))).toEqual(['ESCALATION:2→sup@zf.com', 'ESCALATION:2→teams:quality-channel', 'OVERDUE→owner@zf.com']);
    expect(await sentFor(validating._id)).toEqual([]);
    expect(await sentFor(quiet._id)).toEqual([]);

    expect((await Occurrence.findById(overdueN1._id)).lastEscalationLevel).toBe(1);
    expect((await Occurrence.findById(n2._id)).lastEscalationLevel).toBe(2);
  });

  it('is idempotent: a second run on the same date sends nothing new', async () => {
    const before = await NotificationLog.countDocuments();
    const res = await runDailyNotifications('2026-10-05');
    expect(await NotificationLog.countDocuments()).toBe(before);
    expect(res.sent).toBe(0);
    expect(res.details.duplicates).toBeGreaterThan(0);
  });

  it('builds the Teams payload with an Adaptive Card and a link to the occurrence', async () => {
    const log = await NotificationLog.findOne({ type: 'REMINDER' }).select('+payload').lean();
    expect(log.status).toBe('SENT');
    expect(log.dryRun).toBe(true);
    expect(log.payload.postToChat).toBe(true);
    expect(log.payload.card.type).toBe('AdaptiveCard');
    expect(log.payload.link).toMatch(/^https:\/\/auditorias\.test\/occurrences\/[a-f\d]{24}$/);
    expect(log.payload.subject).toMatch(/^\[Programa de Auditorías\] Recordatorio: CQI-15 Welding — vence 19\/10\/2026$/);
    expect(log.payload.sendEmail).toBe(false); // email is off globally by default
  });

  it('adds the optional email copy only when it is enabled globally, in the rule and by the user', async () => {
    await Settings.updateOne({ _id: 'global' }, { $set: { emailEnabled: true } });
    const { NotificationRule } = await import('../../src/modules/notifications/notificationRule.model.js');
    await NotificationRule.updateOne({ isDefault: true }, { $set: { channels: ['TEAMS_CHAT', 'TEAMS_CHANNEL', 'EMAIL'] } });
    const occ = await occurrence('2026-09-25', { lastEscalationLevel: 1 }); // 10-05 = D+10 → N2
    await runDailyNotifications('2026-10-05');
    const logs = await NotificationLog.find({ occurrenceId: occ._id, type: 'ESCALATION' }).select('+payload').lean();
    const toSup = logs.find((l) => l.recipientAddress === 'sup@zf.com');
    expect(toSup.emailCopy).toBe(true); // sup has notificationPrefs.email = true
    expect(toSup.payload.email.cc).toEqual(expect.arrayContaining(['owner@zf.com', 'gerente@zf.com']));
    expect(toSup.payload.email.html).toContain('Ver auditoría');
    const owner = await NotificationLog.findOne({ occurrenceId: occ._id, type: 'OVERDUE' }).lean();
    expect(owner.emailCopy).toBe(false); // the owner didn't opt in
  });

  it('skips non-working days entirely', async () => {
    const res = await runDailyNotifications('2026-10-04'); // Sunday
    expect(res.skipped).toBe(true);
  });

  it('runs under a lock and records the run', async () => {
    const run = await runJob('daily-notifications', '2026-10-06', () => runDailyNotifications('2026-10-06'));
    expect(run.status).toBe('SUCCESS');
  });

  it('sends the weekly digest to supervisors and the channel', async () => {
    const res = await runWeeklyDigest('2026-10-05');
    expect(res.sent).toBe(2);
    const log = await NotificationLog.findOne({ type: 'DIGEST', channel: 'TEAMS_CHAT' }).select('+payload').lean();
    expect(log.payload.card.body.some((b) => /Vencidas/.test(b.text ?? ''))).toBe(true);
  });

  it('closes the previous year on January 5 (BR-40)', async () => {
    const res = await runYearClose(2026);
    expect(res.processed).toBeGreaterThan(0);
    expect(await Occurrence.countDocuments({ year: 2026, status: 'PROGRAMADA' })).toBe(0);
    expect(await Occurrence.countDocuments({ year: 2026, status: 'EN_VALIDACION' })).toBe(1); // untouched
  });
});
