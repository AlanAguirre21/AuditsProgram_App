/**
 * Development seed: the groups from the 2026 program (spec appendix A) and a few demo users.
 * Idempotent. Refuses to run in production.
 *
 *   npm run seed
 */
import { connectDb, disconnectDb } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { ROLE } from '../src/constants/roles.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';
import { Group } from '../src/modules/groups/group.model.js';
import { User } from '../src/modules/users/user.model.js';

if (env.isProd) {
  console.error('seed.js must not run in production.');
  process.exit(1);
}

// "Calidad N1, N2" is merged into "Calidad N1 y N2" (the import matches both).
const GROUPS = [
  'CORPORATIVO',
  'Auditores Calidad N1 y N2',
  'Calidad (CS, Proyectos)',
  'Equipo Flechas',
  'Equipo Pintura',
  'Garantias',
  'Equipo Soldadura',
  'Calidad N1 y N2',
  'Calidad Soldadura',
  'Calidad Flechas',
  'Calidad Pintura',
  'Logística-Customer Services',
  'Calidad Clientes - Proyectos',
  'Equipo Ensamble',
  'Calidad',
  'Sistema de Calidad',
  'Calidad Nave 1 / 2',
];

const domain = env.allowedEmailDomains[0] || 'example.com';
const DEMO_PASSWORD = 'Demo-2026-pass';
const USERS = [
  { name: 'Supervisor Demo', email: `supervisor.demo@${domain}`, roles: [ROLE.ADMIN, ROLE.OWNER], isQualitySupervisor: true },
  { name: 'Gerente Demo', email: `gerente.demo@${domain}`, roles: [ROLE.MANAGER, ROLE.OWNER] },
  { name: 'Responsable Demo', email: `responsable.demo@${domain}`, roles: [ROLE.OWNER], manager: `gerente.demo@${domain}` },
  { name: 'Consulta Demo', email: `consulta.demo@${domain}`, roles: [ROLE.VIEWER] },
];

await connectDb();

let groupsCreated = 0;
for (const name of GROUPS) {
  const res = await Group.updateOne({ name }, { $setOnInsert: { name, memberIds: [], active: true } }, { upsert: true });
  groupsCreated += res.upsertedCount;
}

const passwordHash = await hashPassword(DEMO_PASSWORD);
let usersCreated = 0;
for (const u of USERS) {
  const { manager, ...data } = u;
  const res = await User.updateOne(
    { email: data.email },
    { $setOnInsert: { ...data, passwordHash, passwordChangedAt: new Date(), active: true } },
    { upsert: true },
  );
  usersCreated += res.upsertedCount;
}
for (const u of USERS.filter((x) => x.manager)) {
  const mgr = await User.findOne({ email: u.manager });
  await User.updateOne({ email: u.email }, { $set: { managerId: mgr._id } });
}
const responsable = await User.findOne({ email: `responsable.demo@${domain}` });
await Group.updateOne({ name: 'Equipo Soldadura' }, { $addToSet: { memberIds: responsable._id }, $set: { leaderId: responsable._id } });

console.log(`Groups created: ${groupsCreated}/${GROUPS.length}. Demo users created: ${usersCreated}/${USERS.length}.`);
console.log(`Demo users password: ${DEMO_PASSWORD}`);
await disconnectDb();
