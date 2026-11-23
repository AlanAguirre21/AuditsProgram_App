import { describe, expect, it } from 'vitest';
import { STATUSES } from '../../src/constants/statuses.js';
import { TRANSITIONS, assertTransition, canTransition } from '../../src/modules/occurrences/occurrences.status.js';

describe('occurrences.status', () => {
  it('allows every listed transition', () => {
    for (const [from, targets] of Object.entries(TRANSITIONS)) {
      for (const to of targets) expect(canTransition(from, to)).toBe(true);
    }
  });

  it('rejects every other transition with INVALID_TRANSITION', () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        if (TRANSITIONS[from].includes(to)) continue;
        expect(canTransition(from, to)).toBe(false);
        expect(() => assertTransition(from, to)).toThrowError(expect.objectContaining({ code: 'INVALID_TRANSITION', status: 409 }));
      }
    }
  });

  it('treats terminal statuses as final', () => {
    for (const s of ['REALIZADA', 'REALIZADA_FUERA_DE_TIEMPO', 'NO_REALIZADA', 'CANCELADA']) {
      expect(TRANSITIONS[s]).toEqual([]);
    }
  });

  it('returns false for unknown statuses', () => {
    expect(canTransition('FOO', 'PROGRAMADA')).toBe(false);
  });
});
