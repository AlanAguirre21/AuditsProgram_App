/**
 * Phases 3–4 over HTTP: compliance report, Excel/PDF export, rollover, settings,
 * notification rules/log/test and event notifications.
 */
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { connectDb } from '../../src/config/db.js';
import { AuditDefinition } from '../../src/modules/audits/auditDefinition.model.js';
import { hashPassword } from '../../src/modules/auth/auth.service.js';
import { Group } from '../../src/modules/groups/group.model.js';
import { mapDueDate } from '../../src/modules/imports/rollover.service.js';
import { NotificationLog } from '../../src/modules/notifications/notificationLog.model.js';
import { flushNotifications } from '../../src/modules/notifications/notifications.service.js';
import { Occurrence } from '../../src/modules/occurrences/occurrence.model.js';
import { User } from '../../src/modules/users/user.model.js';
import { parseDateKey } from '../../src/utils/dates.js';

// vi.mock is hoisted above the imports; vi.hoisted makes `codes` available to its factory.
const codes = vi.hoisted(() => new Map());
vi.mock('../../src/integrations/teams/twoFactorWorkflow.js', () => ({
  APP_NAME: 'test',
  sendCode: vi.fn(async ({ email, code }) => {
    codes.set(email, code);
    return { delivered: true };
  }),
}));

const PASSWORD = 'Prueba-2026-ok';
let app;
const t = {};
const ids = {};
const auth = (who) => ({ Authorization: `Bearer ${t[who]}` });
const api = () => request(app);

async function login(email) {
  const res = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
  const v = await api().post('/api/v1/auth/2fa/verify').send({ challengeId: res.body.data.challengeId, code: codes.get(email) });
  return v.body.data.token;
}

const binary = (res, cb) => {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (c) => (data += c));
  res.on('end', () => cb(null, Buffer.from(data, 'binary')));
};

beforeAll(async () => {
  await connectDb(process.env.MONGO_URI);
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  app = createApp();
  const hash = await hashPassword(PASSWORD);
  const [admin, admin2, manager, owner, viewer] = await User.create([
    { name: 'Admin', email: 'admin@zf.com', roles: ['ADMIN'], isQualitySupervisor: true, passwordHash: hash },
    { name: 'Admin Dos', email: 'admin2@zf.com', roles: ['ADMIN'], passwordHash: hash },
    { name: 'Gerente', email: 'gerente@zf.com', roles: ['MANAGER'], passwordHash: hash },
    { name: 'Responsable', email: 'owner@zf.com', roles: ['OWNER'], passwordHash: hash },
    { name: 'Consulta', email: 'viewer@zf.com', roles: ['VIEWER'], passwordHash: hash },
  ]);
  const group = await Group.create({ name: 'Equipo Soldadura', memberIds: [owner._id], leaderId: owner._id });
  const def = await AuditDefinition.create({
    code: 9, year: 2025, category: 'SISTEMA_CALIDAD', name: 'Welding', standard: 'CQI-15', requiredBy: ['GM', 'Ford'],
    ownerGroupId: group._id, defaultOwnerUserId: owner._id, executor: { type: 'INTERNAL', name: 'Equipo Soldadura' },
  });
  const mk = (due, status, extra = {}) =>
    Occurrence.create({ definitionId: def._id, year: 2025, dueDate: parseDateKey(due), originalDueDate: parseDateKey(due), status, ownerUserId: owner._id, ownerGroupId: group._id, ...extra });
  await mk('2025-02-28', 'REALIZADA', { completion: { performedAt: parseDateKey('2025-02-20') } });
  await mk('2025-08-29', 'REALIZADA_FUERA_DE_TIEMPO', { completion: { performedAt: parseDateKey('2025-09-03') } });
  await mk('2025-10-31', 'NO_REALIZADA');
  const open = await mk('2025-12-31', 'PROGRAMADA');
  Object.assign(ids, { admin: admin._id, owner: owner._id, group: group._id, def: def._id, open: open._id, admin2: admin2._id });
  for (const [k, e] of [['admin', 'admin@zf.com'], ['admin2', 'admin2@zf.com'], ['manager', 'gerente@zf.com'], ['owner', 'owner@zf.com'], ['viewer', 'viewer@zf.com']]) t[k] = await login(e);
});

afterAll(async () => {
  await flushNotifications();
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

describe('reports (phase 3)', () => {
  it('computes compliance by month, category, customer, group and owner', async () => {
    const byMonth = await api().get('/api/v1/reports/compliance?year=2025&groupBy=month').set(auth('manager'));
    expect(byMonth.status).toBe(200);
    expect(byMonth.body.data.rows).toHaveLength(12);
    expect(byMonth.body.data.rows[1]).toMatchObject({ key: '2', onTime: 100 });
    expect(byMonth.body.data.rows[7]).toMatchObject({ key: '8', onTime: 0, total: 100 });
    expect(byMonth.body.data.rows[0].onTime).toBeNull(); // January: nothing → N/A
    const byCustomer = await api().get('/api/v1/reports/compliance?year=2025&groupBy=customer').set(auth('admin'));
    expect(byCustomer.body.data.rows.map((r) => r.key).sort()).toEqual(['Ford', 'GM']);
    for (const g of ['category', 'ownerGroup', 'owner']) {
      expect((await api().get(`/api/v1/reports/compliance?year=2025&groupBy=${g}`).set(auth('admin'))).status).toBe(200);
    }
  });

  it('VIEWER and OWNER cannot see reports or export (403)', async () => {
    expect((await api().get('/api/v1/reports/compliance?year=2025').set(auth('viewer'))).status).toBe(403);
    expect((await api().get('/api/v1/reports/export/program.xlsx?year=2025').set(auth('viewer'))).status).toBe(403);
    expect((await api().get('/api/v1/reports/export/program.pdf?year=2025').set(auth('owner'))).status).toBe(403);
  });

  it('exports the program as .xlsx with the template layout', async () => {
    const res = await api().get('/api/v1/reports/export/program.xlsx?year=2025').set(auth('manager')).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const ws = wb.getWorksheet('Programa');
    expect(ws.getCell('C3').value).toBe('PROGRAMA GENERAL DE AUDITORIAS');
    expect(ws.getCell('D9').value).toBe('NOMBRE DE LA AUDITORIA');
    expect(ws.getCell('J9').value).toBe('ene-25');
    expect(ws.getCell('C10').value).toBe(9);
    expect(ws.getCell('K10').fill.fgColor.argb).toBe('FF00FF00'); // Feb REALIZADA green
    expect(ws.getCell('Q10').fill.fgColor.argb).toBe('FFFFFF00'); // Aug late yellow
    expect(ws.getCell('S10').fill.fgColor.argb).toBe('FFFF0000'); // Oct NO_REALIZADA red
    expect(wb.getWorksheet('Cambios')).toBeTruthy();
  });

  it('exports the program as PDF', async () => {
    const res = await api().get('/api/v1/reports/export/program.pdf?year=2025').set(auth('admin')).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('event notifications (spec 8.4)', () => {
  it('logs Teams notifications for reschedule request and result', async () => {
    const req = await api().post(`/api/v1/occurrences/${ids.open}/reschedule-request`).set(auth('owner')).send({ requestedDate: '2025-12-15', reason: 'Paro de planta en diciembre' });
    expect(req.status).toBe(200);
    await flushNotifications();
    const toSup = await NotificationLog.findOne({ occurrenceId: ids.open, type: 'RESCHEDULE_REQUEST' }).lean();
    expect(toSup).toMatchObject({ recipientAddress: 'admin@zf.com', channel: 'TEAMS_CHAT', status: 'SENT' });

    await api().post(`/api/v1/occurrences/${ids.open}/reschedule-request/approve`).set(auth('admin'));
    await flushNotifications();
    const toOwner = await NotificationLog.findOne({ occurrenceId: ids.open, type: 'RESCHEDULE_RESULT' }).lean();
    expect(toOwner.recipientAddress).toBe('owner@zf.com');

    const own = await api().get(`/api/v1/occurrences/${ids.open}/notifications`).set(auth('owner'));
    expect(own.body.data.length).toBe(2);
    expect((await api().get(`/api/v1/occurrences/${ids.open}/notifications`).set(auth('viewer'))).status).toBe(403);
  });

  it('sends a reassignment message to the new owner', async () => {
    const res = await api().patch(`/api/v1/occurrences/${ids.open}`).set(auth('admin')).send({ ownerUserId: ids.admin2, reason: 'Cambio de área del responsable' });
    expect(res.status).toBe(200);
    await flushNotifications();
    expect(await NotificationLog.exists({ type: 'REASSIGNED', recipientAddress: 'admin2@zf.com' })).toBeTruthy();
  });
});

describe('notification rules, log, test and settings (phases 2/4)', () => {
  it('lists and edits rules; the default rule exists and cannot be deactivated', async () => {
    const rules = await api().get('/api/v1/notifications/rules').set(auth('admin'));
    const def = rules.body.data.find((r) => r.isDefault);
    expect(def.reminderOffsetsDays).toEqual([14, 7, 3, 1]);
    expect((await api().patch(`/api/v1/notifications/rules/${def._id}`).set(auth('admin')).send({ active: false })).status).toBe(409);
    expect((await api().patch(`/api/v1/notifications/rules/${def._id}`).set(auth('admin')).send({ channels: ['EMAIL'] })).status).toBe(400);
    const created = await api().post('/api/v1/notifications/rules').set(auth('admin')).send({ name: 'Externas', reminderOffsetsDays: [30, 14], sendOnDueDate: true, overdueRepeatEveryDays: 2, escalationLevels: [], includeGroupMembers: true, channels: ['TEAMS_CHAT'] });
    expect(created.status).toBe(201);
    expect((await api().get('/api/v1/notifications/rules').set(auth('owner'))).status).toBe(403);
  });

  it('sends a test message to the caller and shows it in the log', async () => {
    const res = await api().post('/api/v1/notifications/test').set(auth('admin')).send({ channel: true });
    expect(res.body.data).toMatchObject({ chat: 'SENT', channel: 'SENT', dryRun: true });
    const log = await api().get('/api/v1/notifications/log?type=TEST').set(auth('admin'));
    expect(log.body.meta.total).toBe(2);
  });

  it('updates settings (email switch) and exposes it in /auth/me', async () => {
    const res = await api().patch('/api/v1/settings').set(auth('admin')).send({ emailEnabled: true, plantQualityManagerId: String(ids.admin) });
    expect(res.status).toBe(200);
    const me = await api().get('/api/v1/auth/me').set(auth('owner'));
    expect(me.body.data.features.emailEnabled).toBe(true);
    const prefs = await api().patch('/api/v1/users/me/preferences').set(auth('owner')).send({ notificationPrefs: { email: true } });
    expect(prefs.body.data.notificationPrefs).toEqual({ email: true, teams: true });
  });

  it('reports the worker status in /health', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.body.worker.status).toBe('never_ran');
  });
});

describe('year rollover (BR-60/61)', () => {
  it('keeps "last working day of the month" and never moves a date into another month', () => {
    const nw = new Set();
    expect(mapDueDate('2025-02-28', 2025, 2026, nw, nw)).toBe('2026-02-27'); // last working day → last working day
    expect(mapDueDate('2025-03-01', 2025, 2026, nw, nw)).toBe('2026-03-02'); // Sunday 03-01 → Monday, same month
    expect(mapDueDate('2025-09-15', 2025, 2026, nw, nw)).toBe('2026-09-15');
  });

  it('previews and confirms 2025 → 2026; a second confirm needs force', async () => {
    const pre = await api().post('/api/v1/imports/rollover/preview').set(auth('admin')).send({ fromYear: 2025, toYear: 2026 });
    expect(pre.status).toBe(200);
    expect(pre.body.data.definitions[0]).toMatchObject({ code: 9, exists: false });
    expect(pre.body.data.definitions[0].dueDates).toHaveLength(4);
    const ok = await api().post('/api/v1/imports/rollover/confirm').set(auth('admin')).send({ fromYear: 2025, toYear: 2026 });
    expect(ok.body.data).toMatchObject({ definitions: 1, occurrences: 4 });
    expect(await Occurrence.countDocuments({ year: 2026, status: 'PROGRAMADA' })).toBe(4);
    const again = await api().post('/api/v1/imports/rollover/confirm').set(auth('admin')).send({ fromYear: 2025, toYear: 2026 });
    expect(again.status).toBe(409);
    const forced = await api().post('/api/v1/imports/rollover/confirm').set(auth('admin')).send({ fromYear: 2025, toYear: 2026, force: true });
    expect(forced.body.data).toMatchObject({ definitions: 0, skipped: [9] });
  });
});
