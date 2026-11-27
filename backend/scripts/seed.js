/**
 * Demo data for testing every feature with every role.
 *
 *   npm run seed:demo          → rebuilds the DEMO database (<MONGO_URI db>_demo) from scratch
 *
 * It never touches the real database: it always runs in demo mode and only drops a database
 * whose name ends in "_demo". Data is created through the app's own services (real state
 * transitions, change log, evidence files) relative to today's date, then the daily
 * notifications job and the weekly digest run in dry-run mode.
 */
// Must stay the first import: it forces --demo before src/config/env.js is evaluated.
import './forceDemoMode.js';

import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import '../src/models.js';
import { env } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { ROLE } from '../src/constants/roles.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';
import { User } from '../src/modules/users/user.model.js';
import { Group } from '../src/modules/groups/group.model.js';
import { NonWorkingDay } from '../src/modules/calendar/calendar.model.js';
import { nonWorkingSet } from '../src/modules/calendar/calendar.service.js';
import { Settings } from '../src/modules/settings/settings.model.js';
import { Occurrence } from '../src/modules/occurrences/occurrence.model.js';
import { NotificationRule } from '../src/modules/notifications/notificationRule.model.js';
import * as audits from '../src/modules/audits/audits.service.js';
import * as occurrences from '../src/modules/occurrences/occurrences.service.js';
import * as evidence from '../src/modules/evidence/evidence.service.js';
import { flushNotifications, getDefaultRule } from '../src/modules/notifications/notifications.service.js';
import * as changelog from '../src/modules/changelog/changelog.service.js';
import { runJob } from '../src/jobs/runtime.js';
import { runDailyNotifications } from '../src/jobs/notifications.job.js';
import { runWeeklyDigest } from '../src/jobs/digest.job.js';
import { addDays, lastWorkingDayOfMonth, nextWorkingDay, parseDateKey, previousWorkingDay, todayKey, toDateKey, yearOf } from '../src/utils/dates.js';
import { derivedState } from '../src/modules/occurrences/occurrence.logic.js';

if (env.isProd) {
  console.error('seed must not run in production.');
  process.exit(1);
}

// ----------------------------------------------------------------------------- reset demo DB
await connectDb();
const dbName = mongoose.connection.name;
if (!dbName.endsWith('_demo')) {
  console.error(`Refusing to seed "${dbName}": only databases ending in _demo are reset.`);
  process.exit(1);
}
await mongoose.connection.db.dropDatabase();
await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
console.log(`Demo database "${dbName}" reset.`);

const T = todayKey();
const Y = yearOf(T);
const PY = Y - 1;
const domain = env.allowedEmailDomains[0] || 'zf.com';
const PASSWORD = 'Demo-2026-pass';

// ----------------------------------------------------------------------------- calendar
const HOLIDAYS = [
  ['01-01', 'Año Nuevo'],
  ['05-01', 'Día del Trabajo'],
  ['09-16', 'Día de la Independencia'],
  ['12-24', 'Paro de planta (Nochebuena)'],
  ['12-25', 'Navidad'],
];
await NonWorkingDay.insertMany([PY, Y].flatMap((y) => HOLIDAYS.map(([md, description]) => ({ date: parseDateKey(`${y}-${md}`), description, year: y }))));
const nw = await nonWorkingSet([PY, Y, Y + 1]);

/** A working day `offset` days from today, kept inside the current year. */
function day(offset) {
  let k = addDays(T, offset);
  if (yearOf(k) < Y) k = `${Y}-01-05`;
  if (yearOf(k) > Y) k = `${Y}-12-30`;
  const prev = previousWorkingDay(k, nw);
  return yearOf(prev) === Y ? prev : nextWorkingDay(k, nw);
}
const endOfMonth = (y, m) => lastWorkingDayOfMonth(y, m, nw);
const min = (a, b) => (a < b ? a : b);

// ----------------------------------------------------------------------------- users
const passwordHash = await hashPassword(PASSWORD);
const mk = (local, name, roles, extra = {}) => ({ email: `${local}@${domain}`, name, roles, passwordHash, passwordChangedAt: new Date(), department: 'Calidad', ...extra });
const u = {};
for (const [key, data] of Object.entries({
  ana: mk('ana.supervisora.demo', 'Ana Supervisora', [ROLE.ADMIN, ROLE.OWNER], { isQualitySupervisor: true, jobTitle: 'Supervisora de Calidad' }),
  bruno: mk('bruno.calidad.demo', 'Bruno Calidad', [ROLE.ADMIN], { isQualitySupervisor: true, jobTitle: 'Supervisor de Calidad' }),
  patricia: mk('patricia.planta.demo', 'Patricia Planta', [ROLE.MANAGER], { jobTitle: 'Gerente de Calidad de Planta' }),
  gerardo: mk('gerardo.gerente.demo', 'Gerardo Gerente', [ROLE.MANAGER, ROLE.OWNER], { department: 'Producción', jobTitle: 'Gerente de Producción' }),
  rosa: mk('rosa.responsable.demo', 'Rosa Responsable', [ROLE.OWNER], { department: 'Soldadura', jobTitle: 'Ingeniera de Calidad' }),
  raul: mk('raul.responsable.demo', 'Raúl Responsable', [ROLE.OWNER], { department: 'Flechas', jobTitle: 'Ingeniero de Calidad' }),
  pedro: mk('pedro.pintura.demo', 'Pedro Pintura', [ROLE.OWNER], { department: 'Pintura', jobTitle: 'Técnico de Calidad' }),
  victor: mk('victor.consulta.demo', 'Víctor Consulta', [ROLE.VIEWER], { department: 'Ingeniería' }),
  ines: mk('ines.inactiva.demo', 'Inés Inactiva', [ROLE.OWNER], { active: false }),
})) {
  u[key] = (await User.create(data)).toObject();
}
await User.updateMany({ _id: { $in: [u.rosa._id, u.raul._id] } }, { $set: { managerId: u.gerardo._id } });
await User.updateOne({ _id: u.gerardo._id }, { $set: { managerId: u.patricia._id } });
// Pedro has no manager on purpose: his N1 escalation goes to the group's escalation contact.
for (const k of Object.keys(u)) u[k] = await User.findById(u[k]._id).lean();

// ----------------------------------------------------------------------------- groups
const g = {};
const groupDefs = {
  soldadura: { name: 'Equipo Soldadura', leaderId: u.rosa._id, memberIds: [u.rosa._id, u.raul._id], escalationContactId: u.gerardo._id },
  flechas: { name: 'Equipo Flechas', leaderId: u.raul._id, memberIds: [u.raul._id] },
  pintura: { name: 'Equipo Pintura', leaderId: u.pedro._id, memberIds: [u.pedro._id], escalationContactId: u.bruno._id },
  calidad: { name: 'Calidad N1 y N2', leaderId: u.ana._id, memberIds: [u.ana._id, u.bruno._id] },
  sistema: { name: 'Sistema de Calidad', leaderId: u.ana._id, memberIds: [u.ana._id, u.gerardo._id] },
};
for (const [k, data] of Object.entries(groupDefs)) g[k] = (await Group.create(data)).toObject();

// ----------------------------------------------------------------------------- settings & rules
await Settings.create({ _id: 'global', plantQualityManagerId: u.patricia._id, emailEnabled: false, qualityChannelEnabled: true });
await getDefaultRule();
const externalRule = await NotificationRule.create({
  name: 'Auditorías externas (organismo certificador)',
  reminderOffsetsDays: [30, 14, 7, 1],
  sendOnDueDate: true,
  overdueRepeatEveryDays: 1,
  escalationLevels: [
    { level: 1, afterDaysOverdue: 1, target: 'MANAGER' },
    { level: 2, afterDaysOverdue: 3, target: 'QUALITY_SUPERVISOR' },
    { level: 3, afterDaysOverdue: 7, target: 'PLANT_QUALITY_MANAGER' },
  ],
  includeGroupMembers: true,
  channels: ['TEAMS_CHAT', 'TEAMS_CHANNEL', 'EMAIL'],
});

// ----------------------------------------------------------------------------- helpers
function makePdf(title, lines) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.fontSize(18).fillColor('#0057b7').text(title);
    doc.moveDown().fontSize(11).fillColor('#000');
    for (const l of lines) doc.text(l);
    doc.moveDown().fontSize(9).fillColor('#888').text('Documento de demostración generado por scripts/seed.js');
    doc.end();
  });
}

async function attach(occId, actor, name) {
  const occ = await Occurrence.findById(occId).populate('definitionId', 'name standard').lean();
  const buffer = await makePdf(`Evidencia — ${occ.definitionId.name}`, [`Norma: ${occ.definitionId.standard}`, `Fecha programada: ${toDateKey(occ.dueDate)}`, `Cargado por: ${actor.name}`]);
  await evidence.upload(occId, [{ originalname: name, mimetype: 'application/pdf', size: buffer.length, buffer }], actor);
}

const findings = (major, minor, observations) => ({ major, minor, observations });

let code = 100;
async function definition(fields, dueDates, year = Y) {
  code += 1;
  const def = await audits.create(
    {
      code,
      year,
      evidenceRequired: true,
      requiresValidation: true,
      executor: { type: 'INTERNAL', name: fields.groupName },
      folderPath: `\\\\America\\esl\\Team\\CC500004\\Individual\\3.1 Auditorias\\Demo\\${code}`,
      ...fields,
      groupName: undefined,
      occurrences: dueDates.map((dueDate) => ({ dueDate })),
      force: true,
    },
    u.ana,
  );
  return { def, occ: def.occurrences.map((o) => o._id) };
}

const log = [];
const note = (label, occId) => log.push({ label, occId });

// ----------------------------------------------------------------------------- previous year (reports, rollover, year close)
{
  const a = await definition(
    { category: 'SISTEMA_CALIDAD', name: 'Auditoría Interna de Seguimiento', standard: 'IATF 16949:2016', requiredBy: ['ZFGDL'], ownerGroupId: g.sistema._id, defaultOwnerUserId: u.ana._id, groupName: 'Sistema de Calidad' },
    [endOfMonth(PY, 3), endOfMonth(PY, 9)],
    PY,
  );
  for (const id of a.occ) {
    await attach(id, u.ana, 'reporte-auditoria-interna.pdf');
    const occ = await Occurrence.findById(id).lean();
    await occurrences.complete(id, { performedAt: addDays(toDateKey(occ.dueDate), -3), findings: findings(0, 2, 1) }, u.ana);
    await occurrences.validate(id, u.bruno);
  }
  const b = await definition(
    { category: 'CSR', name: 'GM 1927 16B Welding Process Audit', standard: 'GM 1927-Welding', requiredBy: ['GM'], ownerGroupId: g.soldadura._id, defaultOwnerUserId: u.rosa._id, groupName: 'Equipo Soldadura' },
    [endOfMonth(PY, 5), endOfMonth(PY, 12)],
    PY,
  );
  await attach(b.occ[0], u.rosa, 'checklist-soldadura.pdf');
  const late = await Occurrence.findById(b.occ[0]).lean();
  await occurrences.complete(b.occ[0], { performedAt: addDays(toDateKey(late.dueDate), 4), findings: findings(1, 0, 0), findingsSummary: 'Un hallazgo mayor en parámetros de soldadura.' }, u.rosa);
  await occurrences.validate(b.occ[0], u.ana);
  note(`${PY}: abierta del año anterior (el cierre de año la pasará a NO REALIZADA)`, b.occ[1]);
}

// ----------------------------------------------------------------------------- current year
code = 100; // each year's program numbers its audits from #101
// 1. Soldadura: realizada a tiempo, fuera de tiempo, próxima y futura.
const sold = await definition(
  { category: 'SISTEMA_CALIDAD', name: 'Special Process: Welding System Assessment', standard: 'CQI-15', requiredBy: ['GM', 'Ford', 'Stellantis'], ownerGroupId: g.soldadura._id, defaultOwnerUserId: u.rosa._id, groupName: 'Equipo Soldadura' },
  [endOfMonth(Y, 2), endOfMonth(Y, 4), day(3), endOfMonth(Y, 12)],
);
await attach(sold.occ[0], u.rosa, 'CQI-15 evaluacion febrero.pdf');
await occurrences.complete(sold.occ[0], { performedAt: addDays(endOfMonth(Y, 2), -5), findings: findings(0, 1, 3), findingsSummary: 'Sin hallazgos mayores. Ajustar registro de mantenimiento de pistolas.', externalRef: 'CAPA-2026-014' }, u.rosa);
await occurrences.validate(sold.occ[0], u.ana);
note('REALIZADA a tiempo (con evidencia y hallazgos)', sold.occ[0]);
await attach(sold.occ[1], u.raul, 'CQI-15 evaluacion abril.pdf');
await occurrences.complete(sold.occ[1], { performedAt: min(addDays(endOfMonth(Y, 4), 6), T), findings: findings(0, 0, 1) }, u.raul);
await occurrences.validate(sold.occ[1], u.bruno);
note('REALIZADA FUERA DE TIEMPO (registrada por un miembro del grupo)', sold.occ[1]);
note('PRÓXIMA (vence en ~3 días; recibe recordatorio)', sold.occ[2]);

// 2. Garantías: importada, no realizada y cancelada.
const gar = await definition(
  { category: 'SISTEMA_CALIDAD', name: 'Automotive Warranty Management', standard: 'CQI-14', requiredBy: ['CSR'], ownerGroupId: g.calidad._id, defaultOwnerUserId: u.ana._id, groupName: 'Calidad N1 y N2' },
  [endOfMonth(Y, 1), endOfMonth(Y, 3), endOfMonth(Y, 6)],
);
await Occurrence.updateOne(
  { _id: gar.occ[0] },
  { $set: { status: 'REALIZADA', completion: { performedAt: parseDateKey(endOfMonth(Y, 1)), submittedAt: new Date(), submittedBy: u.ana._id, importedCompletion: true }, validation: { validatedBy: u.ana._id, validatedAt: new Date(), rejections: [] } } },
);
note('REALIZADA importada del Excel (sin evidencia en la app)', gar.occ[0]);
await occurrences.closeNotDone(gar.occ[1], { reason: 'El auditor del cliente canceló la visita y no se reprogramó.' }, u.ana);
note('NO REALIZADA (cerrada por el administrador)', gar.occ[1]);
await occurrences.cancel(gar.occ[2], { reason: 'Requisito eliminado por el cliente en la revisión de CSR.' }, u.bruno);
note('CANCELADA (excluida de los indicadores)', gar.occ[2]);

// 3. Flechas: en validación (a tiempo) + reprogramación pendiente.
const fle = await definition(
  { category: 'SISTEMA_CALIDAD', name: 'Special Process: Heat Treat System Assessment', standard: 'CQI-9', requiredBy: ['GM', 'Ford'], ownerGroupId: g.flechas._id, defaultOwnerUserId: u.raul._id, groupName: 'Equipo Flechas' },
  [day(6), day(12)],
);
await attach(fle.occ[0], u.raul, 'CQI-9 tratamiento termico.pdf');
await occurrences.complete(fle.occ[0], { performedAt: T, findings: findings(0, 2, 0), findingsSummary: 'Dos hallazgos menores en calibración de hornos.' }, u.raul);
note('EN VALIDACIÓN (se validará como realizada a tiempo)', fle.occ[0]);
await occurrences.requestReschedule(fle.occ[1], { requestedDate: day(25), reason: 'El horno 3 estará en mantenimiento mayor esa semana.' }, u.raul);
note('REPROGRAMACIÓN PENDIENTE de aprobación', fle.occ[1]);

// 4. Ana (ADMIN) registra la suya: otro ADMIN debe validarla (cuatro ojos).
const prod = await definition(
  { category: 'CSR', name: 'Auditorías de Producto', standard: 'Formel Q / D-TLD / IATF', requiredBy: ['VW', 'IATF'], ownerGroupId: g.calidad._id, defaultOwnerUserId: u.ana._id, groupName: 'Auditores Calidad N1 y N2' },
  [day(-12), endOfMonth(Y, 12)],
);
await attach(prod.occ[0], u.ana, 'auditoria-producto.pdf');
await occurrences.complete(prod.occ[0], { performedAt: T, findings: findings(0, 0, 2) }, u.ana);
note('EN VALIDACIÓN registrada por Ana (ADMIN): solo Bruno puede validarla; quedará FUERA DE TIEMPO', prod.occ[0]);

// 5. Vencidas en distintos niveles de escalación.
const pin = await definition(
  { category: 'SISTEMA_CALIDAD', name: 'Special Process: Coating System Assessment', standard: 'CQI-12', requiredBy: ['CSR'], ownerGroupId: g.pintura._id, defaultOwnerUserId: u.pedro._id, groupName: 'Equipo Pintura' },
  [day(-4)],
);
note('VENCIDA (Pedro no tiene jefe → N1 va al contacto del grupo: Bruno)', pin.occ[0]);
const gm = await definition(
  { category: 'CSR', name: 'GM 1927 16B Torque Process Audit', standard: 'GM 1927-Torque', requiredBy: ['GM'], ownerGroupId: g.soldadura._id, defaultOwnerUserId: u.rosa._id, groupName: 'Equipo Soldadura' },
  [day(-9), endOfMonth(Y, 12)],
);
note('VENCIDA nivel N2 (supervisores + canal de Calidad)', gm.occ[0]);
const nis = await definition(
  { category: 'CSR', name: 'Nissan Supplier Health Check', standard: 'SHC', requiredBy: ['NISSAN'], ownerGroupId: g.flechas._id, defaultOwnerUserId: u.raul._id, groupName: 'Equipo Flechas' },
  [day(-20)],
);
note('VENCIDA nivel N3 (gerente de calidad de planta)', nis.occ[0]);

// 6. Rechazada una vez: vuelve a PROGRAMADA con el comentario de Calidad.
const mmog = await definition(
  { category: 'CSR', name: 'MMOG/LE Assessment Requirement', standard: 'MMOG/LE', requiredBy: ['Ford', 'Stellantis', 'Volvo'], ownerGroupId: g.soldadura._id, defaultOwnerUserId: u.rosa._id, groupName: 'Logística-Customer Services' },
  [day(8)],
);
await attach(mmog.occ[0], u.rosa, 'MMOG autoevaluacion.pdf');
await occurrences.complete(mmog.occ[0], { performedAt: T, findings: findings(0, 0, 0) }, u.rosa);
await occurrences.reject(mmog.occ[0], { comment: 'Falta la autoevaluación firmada por el gerente de logística.' }, u.ana);
note('RECHAZADA (regresó a PROGRAMADA; el responsable debe corregir)', mmog.occ[0]);

// 7. Reprogramada después de vencer: se evalúa contra la fecha original (BR-33).
const vda = await definition(
  { category: 'PROCESOS', name: 'VDA 6.3', standard: 'VDA 6.3', requiredBy: ['VW', 'Audi', 'BMW', 'Daimler'], ownerGroupId: g.sistema._id, defaultOwnerUserId: u.gerardo._id, groupName: 'Sistema de Calidad' },
  [day(-15)],
);
await occurrences.rescheduleDirect(vda.occ[0], { newDate: day(18), reason: 'Auditores internos VDA 6.3 en capacitación; se mueve con aprobación del cliente.' }, u.ana);
note('REPROGRAMADA después de vencer (contará como fuera de tiempo)', vda.occ[0]);

// 8. Sin validación ni evidencia obligatoria: el responsable la cierra directo.
const amef = await definition(
  { category: 'PROCESOS', name: 'Auditorías de AMEF y PC', standard: 'IATF 16949', requiredBy: ['IATF 16949'], ownerGroupId: g.pintura._id, defaultOwnerUserId: u.pedro._id, groupName: 'Calidad Nave 1 / 2', evidenceRequired: false, requiresValidation: false },
  [day(15)],
);
note('SIN validación ni evidencia obligatoria (Pedro la registra y queda REALIZADA al instante)', amef.occ[0]);

// 9. Auditoría externa (DQS) con regla propia y reasignada.
const ext = await definition(
  { category: 'SISTEMA_CALIDAD', name: 'Auditoría Externa de Re-Certificación', standard: 'IATF 16949:2016', requiredBy: ['CSR'], ownerGroupId: g.sistema._id, defaultOwnerUserId: u.gerardo._id, executor: { type: 'EXTERNAL', name: 'DQS' }, notificationRuleId: externalRule._id },
  [day(28)],
);
await occurrences.updateOwner(ext.occ[0], { ownerUserId: u.ana._id, reason: 'Gerardo estará de vacaciones durante la visita de DQS.' }, u.bruno);
note('EXTERNA (DQS, regla «Auditorías externas», reasignada de Gerardo a Ana)', ext.occ[0]);

await changelog.record({ entity: 'Import', entityId: new mongoose.Types.ObjectId(), action: 'IMPORT', reason: `Emisión del programa de auditorías ${Y} (datos de demostración)`, system: true });

// ----------------------------------------------------------------------------- jobs (dry run)
await flushNotifications();
const daily = await runJob('daily-notifications', T, () => runDailyNotifications(T));
const digest = await runJob('weekly-digest', T, () => runWeeklyDigest(T));
await flushNotifications();

// ----------------------------------------------------------------------------- summary
console.log(`\nToday: ${T}. Daily job: ${daily?.status} (${daily?.sent} notifications, simulated). Digest: ${digest?.status}.`);
console.log(`\nUsers (password for all: ${PASSWORD}):`);
for (const x of Object.values(u)) console.log(`  ${x.active ? ' ' : 'x'} ${x.email.padEnd(40)} ${x.roles.join('+').padEnd(14)} ${x.name}${x.isQualitySupervisor ? ' · supervisor' : ''}${x.active ? '' : ' · INACTIVO'}`);
console.log('\nScenarios:');
for (const { label, occId } of log) {
  const o = await Occurrence.findById(occId).populate('definitionId', 'code name').populate('ownerUserId', 'name').lean();
  const d = derivedState(o, T);
  console.log(`  #${o.definitionId.code} ${toDateKey(o.dueDate)} ${o.status}${d ? `/${d}` : ''}${o.lastEscalationLevel ? ` N${o.lastEscalationLevel}` : ''} · ${o.ownerUserId.name} — ${label}`);
  console.log(`      ${env.appBaseUrl}/occurrences/${o._id}`);
}
console.log('\nStart the app in demo mode:  npm run dev:demo  (and optionally  npm run worker:demo)');
await disconnectDb();
