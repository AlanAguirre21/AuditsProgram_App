import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysToDue,
  formatDateMx,
  lastWorkingDayOfMonth,
  monthLabel,
  nextWorkingDay,
  parseDateKey,
  previousWorkingDay,
  toDateKey,
  todayKey,
} from '../../src/utils/dates.js';

describe('dates', () => {
  it('computes the last working day of a month', () => {
    expect(lastWorkingDayOfMonth(2026, 9)).toBe('2026-09-30'); // Wednesday
    expect(lastWorkingDayOfMonth(2026, 5)).toBe('2026-05-29'); // May 31 is Sunday
    expect(lastWorkingDayOfMonth(2026, 1)).toBe('2026-01-30'); // Jan 31 is Saturday
    expect(lastWorkingDayOfMonth(2026, 2)).toBe('2026-02-27'); // Feb 28 is Saturday
  });

  it('skips non-working days', () => {
    const nw = new Set(['2026-09-30', '2026-09-29']);
    expect(lastWorkingDayOfMonth(2026, 9, nw)).toBe('2026-09-28');
    expect(previousWorkingDay('2026-09-30', nw)).toBe('2026-09-28');
    expect(nextWorkingDay('2026-09-26', nw)).toBe('2026-09-28'); // Saturday → Monday
  });

  it('uses Mexico City for "today" at the UTC day boundary', () => {
    // 2026-09-16 03:30 UTC is still 2026-09-15 21:30 in Mexico City (UTC-6).
    expect(todayKey(new Date('2026-09-16T03:30:00Z'))).toBe('2026-09-15');
    // 06:00 UTC = 00:00 local → new day.
    expect(todayKey(new Date('2026-09-16T06:00:00Z'))).toBe('2026-09-16');
  });

  it('counts days to due (negative = overdue)', () => {
    expect(daysToDue(parseDateKey('2026-09-15'), '2026-09-15')).toBe(0);
    expect(daysToDue(parseDateKey('2026-09-15'), '2026-09-01')).toBe(14);
    expect(daysToDue(parseDateKey('2026-09-15'), '2026-09-18')).toBe(-3);
  });

  it('formats dates and month headers', () => {
    expect(formatDateMx('2026-09-05')).toBe('05/09/2026');
    expect(monthLabel(2026, 1)).toBe('ene-26');
    expect(toDateKey(parseDateKey('2026-12-31'))).toBe('2026-12-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
