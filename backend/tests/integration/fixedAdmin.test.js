/**
 * Fixed admin account (ensureAdmin) and its login alias: typing ADMIN_USERNAME (admin@zf.com)
 * logs into the ADMIN_EMAIL account, and the 2FA code goes to that real email.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const sent = [];
vi.mock('../../src/integrations/teams/twoFactorWorkflow.js', () => ({
  APP_NAME: 'test',
  sendCode: vi.fn(async (payload) => {
    sent.push(payload);
    return { delivered: true, channel: 'TEST' };
  }),
}));

const { env } = await import('../../src/config/env.js');
const { createApp } = await import('../../src/app.js');
const { connectDb } = await import('../../src/config/db.js');
const { ensureAdmin } = await import('../../src/modules/users/ensureAdmin.js');
const { User } = await import('../../src/modules/users/user.model.js');

const ADMIN = { email: 'persona.real@zf.com', username: 'admin@zf.com', name: 'Administrador', password: 'clave-admin-123' };
let app;

beforeAll(async () => {
  Object.assign(env, { ADMIN_EMAIL: ADMIN.email, ADMIN_USERNAME: ADMIN.username, ADMIN_NAME: ADMIN.name, ADMIN_PASSWORD: ADMIN.password });
  await connectDb(process.env.MONGO_URI);
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  app = createApp();
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

describe('fixed admin account', () => {
  it('creates the account with the real email and ADMIN role (no extra user for the alias)', async () => {
    const { changes } = await ensureAdmin();
    expect(changes).toEqual(['created']);
    const u = await User.findOne({ email: ADMIN.email }).lean();
    expect(u.roles).toEqual(expect.arrayContaining(['ADMIN', 'OWNER']));
    expect(await User.exists({ email: ADMIN.username })).toBeNull();
  });

  it('is idempotent and repairs password, roles and active flag', async () => {
    expect((await ensureAdmin()).changes).toEqual([]);
    await User.updateOne({ email: ADMIN.email }, { $set: { roles: ['VIEWER'], active: false, passwordHash: 'x' } });
    expect((await ensureAdmin()).changes).toEqual(expect.arrayContaining(['roles', 'active', 'password']));
  });

  it('logs in with the alias and sends the 2FA code to the real email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: ADMIN.username, password: ADMIN.password });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const last = sent.at(-1);
    expect(last.email).toBe(ADMIN.email);
    expect(res.body.data.sentTo).toMatch(/^pe\*+@zf\.com$/);
    const verify = await request(app).post('/api/v1/auth/2fa/verify').send({ challengeId: res.body.data.challengeId, code: last.code });
    expect(verify.status, JSON.stringify(verify.body)).toBe(200);
    expect(verify.body.data.user.email).toBe(ADMIN.email);
  });

  it('nobody can register the alias as a separate account', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ name: 'Intruso', email: ADMIN.username, password: 'Otra-clave-2026' });
    expect(res.status).toBe(409);
  });
});
