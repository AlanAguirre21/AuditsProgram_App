import { describe, expect, it } from 'vitest';
import { parseDateKey } from '../../src/utils/dates.js';
import { completionStatus, derivedState } from '../../src/modules/occurrences/occurrence.logic.js';
import { computeKpis, pct } from '../../src/modules/reports/kpi.js';

const occ = (due, status, extra = {}) => ({ dueDate: parseDateKey(due), originalDueDate: parseDateKey(due), status, ...extra });
const many = (n, due, status) => Array.from({ length: n }, () => occ(due, status));

describe('KPIs (spec 7.6)', () => {
  const today = '2026-11-22';

  it('reproduces the 2026 Excel values: Aug 80%, Sep 75%, Oct 83%', () => {
    const aug = [...many(4, '2026-08-31', 'REALIZADA'), occ('2026-08-31', 'PROGRAMADA')];
    const sep = [...many(3, '2026-09-30', 'REALIZADA'), occ('2026-09-30', 'PROGRAMADA')];
    const oct = [...many(5, '2026-10-30', 'REALIZADA'), occ('2026-10-30', 'PROGRAMADA')];
    expect(computeKpis(aug, today).onTime).toBe(80);
    expect(computeKpis(sep, today).onTime).toBe(75);
    expect(computeKpis(oct, today).onTime).toBe(83);
  });

  it('returns N/A (null), not 0%, when nothing is due yet (Nov/Dec)', () => {
    const nov = many(3, '2026-11-30', 'PROGRAMADA');
    const k = computeKpis(nov, today);
    expect(k.exigibles).toBe(0);
    expect(k.onTime).toBeNull();
    expect(k.total).toBeNull();
    expect(k.programadas).toBe(3);
  });

  it('counts done occurrences as exigible even before their due date', () => {
    const k = computeKpis([occ('2026-12-15', 'REALIZADA'), occ('2026-12-15', 'PROGRAMADA')], today);
    expect(k.exigibles).toBe(1);
    expect(k.onTime).toBe(100);
  });

  it('separates on-time and total compliance', () => {
    const k = computeKpis([occ('2026-02-27', 'REALIZADA'), occ('2026-02-27', 'REALIZADA_FUERA_DE_TIEMPO')], today);
    expect(k.onTime).toBe(50);
    expect(k.total).toBe(100);
  });

  it('excludes cancelled occurrences and counts EN_VALIDACION as pending', () => {
    const k = computeKpis(
      [occ('2026-03-31', 'CANCELADA'), occ('2026-03-31', 'EN_VALIDACION'), occ('2026-03-31', 'REALIZADA')],
      today,
    );
    expect(k.programadas).toBe(2);
    expect(k.pendientesValidacion).toBe(1);
    expect(k.exigibles).toBe(2);
    expect(k.onTime).toBe(50);
  });

  it('BR-33: a reschedule approved after the due date is evaluated against the original date', () => {
    const late = occ('2026-12-15', 'PROGRAMADA', { originalDueDate: parseDateKey('2026-10-30'), evaluateAgainstOriginal: true });
    const k = computeKpis([late], today);
    expect(k.exigibles).toBe(1);
    expect(k.onTime).toBe(0);
    expect(completionStatus(late, '2026-11-20')).toBe('REALIZADA_FUERA_DE_TIEMPO');
  });

  it('decides the final status by performedAt vs dueDate (BR-14)', () => {
    const o = occ('2026-09-30', 'PROGRAMADA');
    expect(completionStatus(o, '2026-09-30')).toBe('REALIZADA');
    expect(completionStatus(o, '2026-10-01')).toBe('REALIZADA_FUERA_DE_TIEMPO');
  });

  it('derives VENCIDA and PROXIMA', () => {
    expect(derivedState(occ('2026-11-21', 'PROGRAMADA'), today)).toBe('VENCIDA');
    expect(derivedState(occ('2026-11-22', 'PROGRAMADA'), today)).toBe('PROXIMA');
    expect(derivedState(occ('2026-12-06', 'PROGRAMADA'), today)).toBe('PROXIMA');
    expect(derivedState(occ('2026-12-07', 'PROGRAMADA'), today)).toBeNull();
    expect(derivedState(occ('2026-11-01', 'EN_VALIDACION'), today)).toBeNull();
  });

  it('rounds half up', () => {
    expect(pct(1, 8)).toBe(13); // 12.5
    expect(pct(5, 6)).toBe(83);
    expect(pct(0, 0)).toBeNull();
  });
});
