/** API fixtures for UI tests. The axios adapter in renderApp() routes requests here. */
const id = (n) => String(n).padStart(24, '0');

export const adminUser = { _id: id(1), name: 'Ana Supervisor', email: 'ana@zf.com', roles: ['ADMIN', 'OWNER'], isQualitySupervisor: true, groups: [{ _id: id(50), name: 'Equipo Soldadura' }] };
export const viewerUser = { _id: id(2), name: 'Victor Consulta', email: 'victor@zf.com', roles: ['VIEWER'], isQualitySupervisor: false, groups: [] };

const def = { _id: id(10), code: 9, year: 2026, category: 'SISTEMA_CALIDAD', name: 'Special Process: Welding System Assessment', standard: 'CQI-15', requiredBy: ['GM', 'Ford'], executor: { type: 'INTERNAL', name: 'Equipo Soldadura' }, evidenceRequired: true, requiresValidation: true, ownerGroupId: { _id: id(50), name: 'Equipo Soldadura' }, defaultOwnerUserId: { _id: id(1), name: 'Ana Supervisor' }, active: true };

export const occurrence = (overrides = {}) => ({
  _id: id(100),
  year: 2026,
  definitionId: def,
  dueDate: '2026-09-30T00:00:00.000Z',
  originalDueDate: '2026-09-30T00:00:00.000Z',
  status: 'PROGRAMADA',
  derived: 'VENCIDA',
  daysToDue: -53,
  rescheduled: false,
  ownerUserId: { _id: id(1), name: 'Ana Supervisor' },
  ownerGroupId: { _id: id(50), name: 'Equipo Soldadura' },
  validation: { rejections: [] },
  rescheduleHistory: [],
  evidence: [],
  permissions: { isOwner: true, isAdmin: true, canComplete: true, canUploadEvidence: true, canRequestReschedule: true, canResolveReschedule: false, canValidate: false, canCancel: true, canCloseNotDone: true, canReopen: false, canReassign: true },
  ...overrides,
});

const kpi = (p, a, f, e) => ({ programadas: p, exigibles: e, aTiempo: a, fueraDeTiempo: f, realizadas: a + f, pendientesValidacion: 0, noRealizadas: 0, vencidas: 0, abiertas: 0, onTime: e ? Math.round((a * 100) / e) : null, total: e ? Math.round(((a + f) * 100) / e) : null });

export const program = {
  year: 2026,
  today: '2026-11-22',
  headline: 'onTime',
  rows: [
    {
      definitionId: id(10),
      code: 9,
      category: 'SISTEMA_CALIDAD',
      name: def.name,
      standard: 'CQI-15',
      requiredBy: ['GM', 'Ford'],
      ownerGroup: 'Equipo Soldadura',
      months: {
        ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), null])),
        2: { occurrenceId: id(101), status: 'REALIZADA_FUERA_DE_TIEMPO', derived: null, dueDate: '2026-02-27', rescheduled: false, others: [] },
        9: { occurrenceId: id(100), status: 'PROGRAMADA', derived: 'VENCIDA', dueDate: '2026-09-30', rescheduled: true, others: [] },
        11: { occurrenceId: id(102), status: 'PROGRAMADA', derived: 'PROXIMA', dueDate: '2026-11-30', rescheduled: false, others: [] },
      },
    },
  ],
  summary: {
    ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), kpi(0, 0, 0, 0)])),
    2: kpi(1, 0, 1, 1),
    9: kpi(1, 0, 0, 1),
    11: kpi(1, 0, 0, 0),
  },
  totals: kpi(3, 0, 1, 2),
};

export const dashboard = {
  today: '2026-11-22',
  mine: { upcoming: [occurrence({ _id: id(102), derived: 'PROXIMA', daysToDue: 8 })], overdue: [occurrence()], inValidation: [], recentDone: [] },
  admin: { year: 2026, month: 11, headline: 'onTime', ytd: kpi(51, 44, 1, 48), currentMonth: kpi(3, 0, 0, 0), pendingValidations: 1, pendingReschedules: 0, overdueByLevel: { 0: 3, 1: 0, 2: 0, 3: 0 }, overdue: [occurrence()] },
};

/** URL → response data. */
export function route(method, url) {
  const path = url.replace(/\?.*$/, '');
  if (path === '/auth/me') return adminUser;
  if (path === '/reports/dashboard') return dashboard;
  if (path.startsWith('/program/')) return program;
  if (path === '/audits/meta') return { years: [2026], customers: ['Ford', 'GM'] };
  if (path === '/audits') return [{ ...def, occurrenceCounts: { REALIZADA: 1, PROGRAMADA: 2 } }];
  if (path.startsWith('/audits/')) return { ...def, occurrences: [occurrence()] };
  if (path === '/occurrences/mine') return [occurrence(), occurrence({ _id: id(103), status: 'REALIZADA', derived: null })];
  if (/^\/occurrences\/[^/]+\/notifications$/.test(path)) return [{ _id: id(950), type: 'OVERDUE', level: 0, channel: 'TEAMS_CHAT', status: 'SENT', recipientId: { name: 'Ana Supervisor' }, createdAt: '2026-10-01T13:00:00Z', dryRun: true }];
  if (path === '/notifications/rules') return [{ _id: id(80), name: 'Regla general', isDefault: true, active: true, reminderOffsetsDays: [14, 7, 3, 1], sendOnDueDate: true, overdueRepeatEveryDays: 1, escalationLevels: [{ level: 1, afterDaysOverdue: 3, target: 'MANAGER' }], includeGroupMembers: false, channels: ['TEAMS_CHAT', 'TEAMS_CHANNEL'] }];
  if (path === '/notifications/log') return { __page: [{ _id: id(951), type: 'ESCALATION', level: 2, channel: 'TEAMS_CHANNEL', status: 'FAILED', attempts: 3, error: 'Workflow responded 401', recipientAddress: 'teams:quality-channel', createdAt: '2026-10-07T13:00:00Z' }] };
  if (path === '/settings') return { _id: 'global', emailEnabled: false, qualityChannelEnabled: true, dailyJobTime: '07:00', digestDayOfWeek: 1, digestTime: '08:00', lateCompletionCountsAsCompliant: false, rescheduleAfterDueCountsAsLate: true };
  if (path === '/reports/compliance') {
    const rows = Array.from({ length: 12 }, (_, i) => ({ key: String(i + 1), label: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][i], ...kpi(i < 10 ? 5 : 3, i < 10 ? 4 : 0, i === 1 ? 1 : 0, i < 10 ? 5 : 0) }));
    return { year: 2026, groupBy: 'month', headline: 'onTime', rows, totals: kpi(56, 40, 1, 50) };
  }
  if (/^\/occurrences\/[^/]+\/history$/.test(path)) return [{ _id: id(900), action: 'CREATE', at: '2026-01-06T12:00:00Z', userId: { name: 'Ana Supervisor' }, after: { status: 'PROGRAMADA' } }];
  if (path.startsWith('/occurrences/')) return occurrence();
  if (path === '/validations') return { completions: [occurrence({ status: 'EN_VALIDACION', derived: null })], reschedules: [] };
  if (path === '/users/lookup') return [adminUser, viewerUser];
  if (path === '/users') return { __page: [adminUser, viewerUser] };
  if (path === '/groups') return [{ _id: id(50), name: 'Equipo Soldadura', memberCount: 1, active: true, leaderId: { name: 'Ana Supervisor' } }];
  if (path.startsWith('/groups/')) return { _id: id(50), name: 'Equipo Soldadura', active: true, memberIds: [adminUser], leaderId: adminUser, definitions: [def] };
  if (path === '/calendar') return [{ _id: id(70), date: '2026-12-25T00:00:00.000Z', description: 'Navidad', year: 2026 }];
  if (path === '/changelog') return { __page: [{ _id: id(901), entity: 'AuditOccurrence', entityId: id(100), action: 'COMPLETE', at: '2026-10-01T12:00:00Z', userId: { name: 'Ana Supervisor' }, after: { status: 'EN_VALIDACION' } }] };
  throw new Error(`No fixture for ${method} ${url}`);
}
