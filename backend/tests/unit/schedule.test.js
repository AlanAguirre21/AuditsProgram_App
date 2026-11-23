import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE } from '../../src/constants/notifications.js';
import { computeActions, resolveRecipients } from '../../src/modules/notifications/schedule.js';
import { parseDateKey } from '../../src/utils/dates.js';

// Due date: Wednesday 2026-09-30.
const occ = (extra = {}) => ({ status: 'PROGRAMADA', dueDate: parseDateKey('2026-09-30'), lastEscalationLevel: 0, ...extra });
const types = (today, o = occ(), rule = DEFAULT_RULE, nw) => computeActions(o, rule, today, nw).map((a) => (a.level ? `${a.type}:${a.level}` : a.type));

describe('computeActions (spec 8.1–8.3)', () => {
  it('sends reminders at D-14, D-7, D-3, D-1 and the due-date notice', () => {
    expect(types('2026-09-16')).toEqual(['REMINDER']); // D-14
    expect(types('2026-09-23')).toEqual(['REMINDER']); // D-7
    expect(types('2026-09-29')).toEqual(['REMINDER']); // D-1
    expect(types('2026-09-30')).toEqual(['DUE_TODAY']);
    expect(types('2026-09-17')).toEqual([]);
  });

  it('moves a reminder that falls on a non-working day to the previous working day', () => {
    // D-3 = Sunday 2026-09-27 → Friday 2026-09-25.
    expect(types('2026-09-25')).toEqual(['REMINDER']);
    expect(types('2026-09-27')).toEqual([]);
    // Holiday on D-7 (Wed 09-23) → Tue 09-22.
    const nw = new Set(['2026-09-23']);
    expect(types('2026-09-22', occ(), DEFAULT_RULE, nw)).toEqual(['REMINDER']);
    expect(types('2026-09-23', occ(), DEFAULT_RULE, nw)).toEqual([]);
  });

  it('sends the due-date notice the previous working day when the due date is not a working day', () => {
    const satDue = occ({ dueDate: parseDateKey('2026-10-31') });
    expect(types('2026-10-30', satDue)).toEqual(['DUE_TODAY']);
  });

  it('sends daily overdue notices from D+1 and escalates N1 at D+3, N2 at D+7, N3 at D+15', () => {
    expect(types('2026-10-01')).toEqual(['OVERDUE']); // D+1
    expect(types('2026-10-02')).toEqual(['OVERDUE']);
    expect(types('2026-10-03')).toEqual([]); // Saturday
    // D+3 is Saturday → N1 goes out on Monday 10-05 together with the overdue notice.
    expect(types('2026-10-05')).toEqual(['OVERDUE', 'ESCALATION:1']);
    expect(types('2026-10-07', occ({ lastEscalationLevel: 1 }))).toEqual(['OVERDUE', 'ESCALATION:2']);
    expect(types('2026-10-15', occ({ lastEscalationLevel: 2 }))).toEqual(['OVERDUE', 'ESCALATION:3']);
  });

  it('does not repeat a level already sent (cumulative escalation)', () => {
    expect(types('2026-10-06', occ({ lastEscalationLevel: 1 }))).toEqual(['OVERDUE']);
    expect(types('2026-11-20', occ({ lastEscalationLevel: 3 }))).toEqual(['OVERDUE']);
  });

  it('sends every missed level at once if the worker was down', () => {
    expect(types('2026-10-16')).toEqual(['OVERDUE', 'ESCALATION:1', 'ESCALATION:2', 'ESCALATION:3']);
  });

  it('starts over after a reschedule (lastEscalationLevel reset, new date in the future)', () => {
    const rescheduled = occ({ dueDate: parseDateKey('2026-10-30'), lastEscalationLevel: 0 });
    expect(types('2026-10-16', rescheduled)).toEqual(['REMINDER']); // D-14 of the new date
  });

  it('sends nothing for EN_VALIDACION or terminal statuses, nor on non-working days', () => {
    for (const status of ['EN_VALIDACION', 'REALIZADA', 'REALIZADA_FUERA_DE_TIEMPO', 'NO_REALIZADA', 'CANCELADA']) {
      expect(types('2026-10-05', occ({ status }))).toEqual([]);
    }
    expect(types('2026-10-04')).toEqual([]); // Sunday
  });

  it('applies a definition-specific rule instead of the default', () => {
    const rule = { ...DEFAULT_RULE, reminderOffsetsDays: [5], sendOnDueDate: false, overdueRepeatEveryDays: 3, escalationLevels: [{ level: 1, afterDaysOverdue: 1, target: 'MANAGER' }] };
    expect(types('2026-09-25', occ(), rule)).toEqual(['REMINDER']); // D-5
    expect(types('2026-09-16', occ(), rule)).toEqual([]);
    expect(types('2026-09-30', occ(), rule)).toEqual([]);
    expect(types('2026-10-01', occ(), rule)).toEqual(['OVERDUE', 'ESCALATION:1']);
    expect(types('2026-10-02', occ({ lastEscalationLevel: 1 }), rule)).toEqual([]);
    // Every 3 days: 10-01, 10-04 (Sunday → Monday 10-05), 10-07.
    expect(types('2026-10-05', occ({ lastEscalationLevel: 1 }), rule)).toEqual(['OVERDUE']);
    expect(types('2026-10-06', occ({ lastEscalationLevel: 1 }), rule)).toEqual([]);
    expect(types('2026-10-07', occ({ lastEscalationLevel: 1 }), rule)).toEqual(['OVERDUE']);
  });
});

describe('resolveRecipients', () => {
  const u = (id, extra = {}) => ({ _id: id, name: id, email: `${id}@zf.com`, active: true, ...extra });
  const owner = u('owner');
  const manager = u('manager');
  const contact = u('contact');
  const sup1 = u('sup1');
  const sup2 = u('sup2');
  const plant = u('plant');
  const ids = (list) => list.map((x) => x._id);
  const base = { owner, manager, group: { members: [owner, u('member')], escalationContact: contact }, supervisors: [sup1, sup2], plantManager: plant, rule: DEFAULT_RULE };

  it('sends reminders to the owner only, or also to group members when configured', () => {
    expect(ids(resolveRecipients({ type: 'REMINDER' }, base).to)).toEqual(['owner']);
    expect(ids(resolveRecipients({ type: 'REMINDER' }, { ...base, rule: { ...DEFAULT_RULE, includeGroupMembers: true } }).to)).toEqual(['owner', 'member']);
  });

  it('N1 goes to the manager, then the group escalation contact, then the supervisors', () => {
    const n1 = { type: 'ESCALATION', level: 1, target: 'MANAGER' };
    expect(ids(resolveRecipients(n1, base).to)).toEqual(['manager']);
    expect(ids(resolveRecipients(n1, base).cc)).toEqual(['owner']);
    expect(ids(resolveRecipients(n1, { ...base, manager: null }).to)).toEqual(['contact']);
    expect(ids(resolveRecipients(n1, { ...base, manager: null, group: {} }).to)).toEqual(['sup1', 'sup2']);
  });

  it('skips inactive users', () => {
    const n1 = { type: 'ESCALATION', level: 1, target: 'MANAGER' };
    expect(ids(resolveRecipients(n1, { ...base, manager: u('manager', { active: false }) }).to)).toEqual(['contact']);
    expect(resolveRecipients({ type: 'OVERDUE' }, { ...base, owner: u('owner', { active: false }) }).to).toEqual([]);
  });

  it('N2 goes to the supervisors and the channel; N3 to the plant manager (supervisors as fallback)', () => {
    const n2 = resolveRecipients({ type: 'ESCALATION', level: 2, target: 'QUALITY_SUPERVISOR' }, base);
    expect(ids(n2.to)).toEqual(['sup1', 'sup2']);
    expect(ids(n2.cc)).toEqual(['owner', 'manager']);
    expect(n2.channel).toBe(true);
    const n3 = resolveRecipients({ type: 'ESCALATION', level: 3, target: 'PLANT_QUALITY_MANAGER' }, base);
    expect(ids(n3.to)).toEqual(['plant']);
    expect(ids(n3.cc)).toEqual(['owner', 'manager', 'sup1', 'sup2']);
    expect(ids(resolveRecipients({ type: 'ESCALATION', level: 3, target: 'PLANT_QUALITY_MANAGER' }, { ...base, plantManager: null }).to)).toEqual(['sup1', 'sup2']);
  });

  it('does not post to the channel when the rule excludes it', () => {
    const rule = { ...DEFAULT_RULE, channels: ['TEAMS_CHAT'] };
    expect(resolveRecipients({ type: 'ESCALATION', level: 2, target: 'QUALITY_SUPERVISOR' }, { ...base, rule }).channel).toBe(false);
  });
});
