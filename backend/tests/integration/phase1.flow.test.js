/**
 * Phase 1 end-to-end flow over HTTP against a throwaway database (TEST_MONGO_URI or
 * mongodb://127.0.0.1:27017/auditsprogram_test). The database is dropped before and after.
 */
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildTemplate } from '../fixtures/buildTemplate.js';

const codes = new Map();
vi.mock('../../src/integrations/teams/twoFactorWorkflow.js', () => ({
  APP_NAME: 'test',
  sendCode: vi.fn(async ({ email, code, purpose }) => {
    codes.set(`${purpose}:${email}`, code);
    return { delivered: true, channel: 'TEST' };
  }),
}));

const { createApp } = await import('../../src/app.js');
const { connectDb } = await import('../../src/config/db.js');
const { hashPassword } = await import('../../src/modules/auth/auth.service.js');
const { User } = await import('../../src/modules/users/user.model.js');
const { addDays, todayKey, yearOf } = await import('../../src/utils/dates.js');

const PASSWORD = 'Prueba-2026-ok';
let app;
const api = () => request(app);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function login(email, password = PASSWORD) {
  const res = await api().post('/api/v1/auth/login').send({ email, password });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const code = codes.get(`LOGIN:${email}`);
  const verify = await api().post('/api/v1/auth/2fa/verify').send({ challengeId: res.body.data.challengeId, code });
  expect(verify.status, JSON.stringify(verify.body)).toBe(200);
  return verify.body.data.token;
}

const tokens = {};
const ids = {};

beforeAll(async () => {
  await connectDb(process.env.MONGO_URI);
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  app = createApp();
  await User.create([
    { name: 'Admin Uno', email: 'admin1@zf.com', roles: ['ADMIN', 'OWNER'], isQualitySupervisor: true, passwordHash: await hashPassword(PASSWORD) },
    { name: 'Admin Dos', email: 'admin2@zf.com', roles: ['ADMIN'], passwordHash: await hashPassword(PASSWORD) },
  ]);
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
  await fs.rm('./tests/.storage', { recursive: true, force: true });
});

describe('auth: register + login with Teams 2FA', () => {
  it('rejects emails outside the allowed domains', async () => {
    const res = await api().post('/api/v1/auth/register').send({ name: 'Externo', email: 'x@gmail.com', password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it('registers as an active VIEWER', async () => {
    for (const [key, email] of [['owner', 'owner@zf.com'], ['viewer', 'viewer@zf.com']]) {
      const res = await api().post('/api/v1/auth/register').send({ name: `Usuario ${key}`, email, password: PASSWORD });
      expect(res.status).toBe(201);
      expect(res.body.data.roles).toEqual(['VIEWER']);
      expect(res.body.data.passwordHash).toBeUndefined();
      ids[key] = res.body.data._id;
    }
  });

  it('rejects a duplicate registration and a weak password', async () => {
    expect((await api().post('/api/v1/auth/register').send({ name: 'Otro', email: 'owner@zf.com', password: PASSWORD })).status).toBe(409);
    expect((await api().post('/api/v1/auth/register').send({ name: 'Otro', email: 'otro@zf.com', password: 'corta' })).status).toBe(400);
  });

  it('requires the 2FA code and counts wrong attempts', async () => {
    const res = await api().post('/api/v1/auth/login').send({ email: 'viewer@zf.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeUndefined();
    const wrong = await api().post('/api/v1/auth/2fa/verify').send({ challengeId: res.body.data.challengeId, code: '000000' === codes.get('LOGIN:viewer@zf.com') ? '111111' : '000000' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.message).toMatch(/intento/);
  });

  it('rejects a wrong password without revealing the account', async () => {
    const a = await api().post('/api/v1/auth/login').send({ email: 'viewer@zf.com', password: 'Incorrecta-123' });
    const b = await api().post('/api/v1/auth/login').send({ email: 'nadie@zf.com', password: 'Incorrecta-123' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('logs in after the code', async () => {
    tokens.admin1 = await login('admin1@zf.com');
    tokens.admin2 = await login('admin2@zf.com');
    tokens.owner = await login('owner@zf.com');
    tokens.viewer = await login('viewer@zf.com');
    const me = await api().get('/api/v1/auth/me').set(auth(tokens.owner));
    expect(me.body.data.email).toBe('owner@zf.com');
  });

  it('resets the password with a Teams code', async () => {
    const forgot = await api().post('/api/v1/auth/forgot-password').send({ email: 'viewer@zf.com' });
    expect(forgot.status).toBe(200);
    const code = codes.get('PASSWORD_RESET:viewer@zf.com');
    const reset = await api().post('/api/v1/auth/reset-password').send({ email: 'viewer@zf.com', code, password: 'Nueva-clave-2026' });
    expect(reset.status).toBe(200);
    // Old tokens are revoked.
    expect((await api().get('/api/v1/auth/me').set(auth(tokens.viewer))).status).toBe(401);
    tokens.viewer = await login('viewer@zf.com', 'Nueva-clave-2026');
  });
});

describe('program flow', () => {
  const today = todayKey();
  const futureDue = addDays(today, 5);
  const pastDue = addDays(today, -10);

  it('admin sets up roles, a group and definitions', async () => {
    const promote = await api().patch(`/api/v1/users/${ids.owner}`).set(auth(tokens.admin1)).send({ roles: ['OWNER'] });
    expect(promote.status).toBe(200);
    const group = await api().post('/api/v1/groups').set(auth(tokens.admin1)).send({ name: 'Equipo Soldadura', leaderId: ids.owner });
    expect(group.status).toBe(201);
    ids.group = group.body.data._id;

    const base = {
      category: 'SISTEMA_CALIDAD',
      standard: 'CQI-15',
      requiredBy: ['GM', 'Ford'],
      ownerGroupId: ids.group,
      defaultOwnerUserId: ids.owner,
      executor: { type: 'INTERNAL', name: 'Equipo Soldadura' },
    };
    const a = await api().post('/api/v1/audits').set(auth(tokens.admin1)).send({ ...base, code: 101, year: yearOf(futureDue), name: 'Welding A', occurrences: [{ dueDate: futureDue }] });
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    ids.occFuture = a.body.data.occurrences[0]._id;

    const b = await api().post('/api/v1/audits').set(auth(tokens.admin1)).send({ ...base, code: 102, year: yearOf(pastDue), name: 'Welding B', occurrences: [{ dueDate: pastDue }] });
    expect(b.status).toBe(201);
    ids.occPast = b.body.data.occurrences[0]._id;
    ids.defPast = b.body.data._id;
  });

  it('BR-04 warns about a second occurrence in the same month', async () => {
    const dup = await api().post(`/api/v1/audits/${ids.defPast}/occurrences`).set(auth(tokens.admin1)).send({ dueDates: [pastDue] });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE');
  });

  it('enforces authorization', async () => {
    expect((await api().post('/api/v1/audits').set(auth(tokens.owner)).send({})).status).toBe(403);
    const viewerComplete = await api()
      .post(`/api/v1/occurrences/${ids.occFuture}/complete`)
      .set(auth(tokens.viewer))
      .send({ performedAt: today, findings: { major: 0, minor: 0, observations: 0 } });
    expect(viewerComplete.status).toBe(403);
  });

  it('requires evidence before completing (BR-12)', async () => {
    const res = await api()
      .post(`/api/v1/occurrences/${ids.occFuture}/complete`)
      .set(auth(tokens.owner))
      .send({ performedAt: today, findings: { major: 0, minor: 1, observations: 2 } });
    expect(res.status).toBe(400);
  });

  it('rejects disallowed file types', async () => {
    const res = await api().post(`/api/v1/occurrences/${ids.occFuture}/evidence`).set(auth(tokens.owner)).attach('files', Buffer.from('x'), { filename: 'virus.exe', contentType: 'application/octet-stream' });
    expect(res.status).toBe(415);
  });

  it('owner uploads evidence and completes → EN_VALIDACION', async () => {
    for (const id of [ids.occFuture, ids.occPast]) {
      const up = await api().post(`/api/v1/occurrences/${id}/evidence`).set(auth(tokens.owner)).attach('files', Buffer.from('%PDF-1.4 test'), { filename: 'reporte auditoría.pdf', contentType: 'application/pdf' });
      expect(up.status, JSON.stringify(up.body)).toBe(201);
      expect(up.body.data[0].storageKey).toBeUndefined();
      expect(up.body.data[0].originalName).toBe('reporte auditoría.pdf');
      ids.evidence = up.body.data[0]._id;
      const done = await api().post(`/api/v1/occurrences/${id}/complete`).set(auth(tokens.owner)).send({ performedAt: today, findings: { major: 0, minor: 1, observations: 2 } });
      expect(done.status, JSON.stringify(done.body)).toBe(200);
      expect(done.body.data.status).toBe('EN_VALIDACION');
    }
    const dl = await api().get(`/api/v1/evidence/${ids.evidence}/download`).set(auth(tokens.viewer));
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toMatch(/attachment/);
  });

  it('owner cannot validate; admin validates on-time → REALIZADA and a repeat is 409', async () => {
    expect((await api().post(`/api/v1/occurrences/${ids.occFuture}/validate`).set(auth(tokens.owner))).status).toBe(403);
    const ok = await api().post(`/api/v1/occurrences/${ids.occFuture}/validate`).set(auth(tokens.admin1));
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('REALIZADA');
    expect((await api().post(`/api/v1/occurrences/${ids.occFuture}/validate`).set(auth(tokens.admin1))).status).toBe(409);
  });

  it('late completion is validated as REALIZADA_FUERA_DE_TIEMPO after a rejection cycle', async () => {
    const rej = await api().post(`/api/v1/occurrences/${ids.occPast}/reject`).set(auth(tokens.admin2)).send({ comment: 'Falta el reporte firmado' });
    expect(rej.status).toBe(200);
    expect(rej.body.data.status).toBe('PROGRAMADA');

    const again = await api().post(`/api/v1/occurrences/${ids.occPast}/complete`).set(auth(tokens.owner)).send({ performedAt: today, findings: { major: 0, minor: 0, observations: 0 } });
    expect(again.body.data.status).toBe('EN_VALIDACION');
    const val = await api().post(`/api/v1/occurrences/${ids.occPast}/validate`).set(auth(tokens.admin2));
    expect(val.body.data.status).toBe('REALIZADA_FUERA_DE_TIEMPO');
  });

  it('records every change in the change log', async () => {
    const hist = await api().get(`/api/v1/occurrences/${ids.occPast}/history`).set(auth(tokens.viewer));
    const actions = hist.body.data.map((h) => h.action);
    expect(actions).toEqual(expect.arrayContaining(['CREATE', 'UPDATE', 'COMPLETE', 'REJECT', 'VALIDATE']));
    expect((await api().get('/api/v1/changelog').set(auth(tokens.owner))).status).toBe(403);
    const log = await api().get('/api/v1/changelog').set(auth(tokens.admin1));
    expect(log.body.meta.total).toBeGreaterThan(5);
  });

  it('BR-50 blocks deactivating a user with open occurrences', async () => {
    const due = addDays(today, 40);
    const def = await api().post('/api/v1/audits').set(auth(tokens.admin1)).send({
      code: 103,
      year: yearOf(due),
      category: 'CSR',
      name: 'Open one',
      standard: 'X',
      requiredBy: ['GM'],
      ownerGroupId: ids.group,
      defaultOwnerUserId: ids.owner,
      executor: { type: 'INTERNAL', name: 'Equipo Soldadura' },
      occurrences: [{ dueDate: due }],
      force: true,
    });
    expect(def.status, JSON.stringify(def.body)).toBe(201);
    const res = await api().patch(`/api/v1/users/${ids.owner}`).set(auth(tokens.admin1)).send({ active: false });
    expect(res.status).toBe(409);
  });

  it('owner home dashboard and program matrix', async () => {
    const dash = await api().get('/api/v1/reports/dashboard').set(auth(tokens.owner));
    expect(dash.status).toBe(200);
    expect(dash.body.data.mine.recentDone.length).toBe(2);
    const prog = await api().get(`/api/v1/program/${yearOf(futureDue)}`).set(auth(tokens.viewer));
    expect(prog.status).toBe(200);
    expect(prog.body.data.rows.length).toBeGreaterThan(0);
  });
});

describe('excel import', () => {
  it('preview → fix → confirm', async () => {
    const buffer = await buildTemplate();
    const pre = await api().post('/api/v1/imports/excel/preview').set(auth(tokens.admin1)).field('year', '2026').attach('file', buffer, 'programa.xlsx');
    expect(pre.status, JSON.stringify(pre.body)).toBe(201);
    const importId = pre.body.data.importId;
    expect(pre.body.data.definitions).toHaveLength(4);
    expect(pre.body.data.blockingCount).toBeGreaterThan(0);
    // "Equipo Soldadura" exists, so row #2 matched the group and its leader as owner.
    const row2 = pre.body.data.definitions.find((d) => d.code === 2);
    expect(row2.ownerGroupId).toBe(ids.group);
    expect(row2.defaultOwnerUserId).toBe(ids.owner);

    const blocked = await api().post(`/api/v1/imports/${importId}/confirm`).set(auth(tokens.admin1));
    expect(blocked.status).toBe(409);

    const groups = await api().post(`/api/v1/imports/${importId}/create-groups`).set(auth(tokens.admin1));
    expect(groups.body.data.createdGroups).toEqual(expect.arrayContaining(['Calidad N1, N2', 'Logística-Customer Services']));
    const fixed = await api()
      .patch(`/api/v1/imports/${importId}`)
      .set(auth(tokens.admin1))
      .send({ bulk: { ownerGroupId: ids.group, defaultOwnerUserId: ids.owner } });
    expect(fixed.body.data.blockingCount).toBe(0);

    const ok = await api().post(`/api/v1/imports/${importId}/confirm`).set(auth(tokens.admin1));
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data).toMatchObject({ definitions: 4, occurrences: 5 });

    const audits = await api().get('/api/v1/audits?year=2026').set(auth(tokens.viewer));
    expect(audits.body.data.filter((d) => d.code <= 4)).toHaveLength(4);
  });
});
