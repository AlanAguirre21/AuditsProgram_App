import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTemplate } from '../fixtures/buildTemplate.js';
import { cleanName, mapCategory, parseProgramWorkbook, parseRequiredBy } from '../../src/modules/imports/excelParser.js';
import { computeIssues, groupKey } from '../../src/modules/imports/imports.service.js';

describe('excelParser field mapping', () => {
  it('maps categories', () => {
    expect(mapCategory('AUDITORIAS AL SISTEMA DE CALIDAD')).toBe('SISTEMA_CALIDAD');
    expect(mapCategory("AUDITORIAS DE REQUERIMIENTOS ESPECÍFICOS DE CLIENTES\n(CSR's)")).toBe('CSR');
    expect(mapCategory('AUDITORÍAS DE PROCESOS')).toBe('PROCESOS');
    expect(mapCategory('OTRA')).toBeNull();
  });

  it('splits requiredBy', () => {
    expect(parseRequiredBy('CSR GM, Ford, Stellantis')).toEqual(['GM', 'Ford', 'Stellantis']);
    expect(parseRequiredBy('VW/IATF')).toEqual(['VW', 'IATF']);
    expect(parseRequiredBy('CSR')).toEqual(['CSR']);
    expect(parseRequiredBy('  ')).toEqual([]);
    expect(parseRequiredBy('VW, Audi, BMW, Daimler, Sesé, Vibracustic, Benteler, Thyssenkrupp')).toHaveLength(8);
  });

  it('cleans names', () => {
    expect(cleanName('Stellantis Welding Process Checklist.  ')).toBe('Stellantis Welding Process Checklist');
    expect(cleanName('GM 1927 16B  Labeling Process Audit')).toBe('GM 1927 16B Labeling Process Audit');
  });

  it('treats "Calidad N1, N2" and "Calidad N1 y N2" as the same group', () => {
    expect(groupKey('Calidad N1, N2')).toBe(groupKey('Calidad N1 y N2'));
    expect(groupKey('Logística-Customer Services')).toBe(groupKey('logistica customer services'));
  });
});

describe('excelParser template', () => {
  it('parses rows, carries the category down and maps colors/symbols to statuses', async () => {
    const r = await parseProgramWorkbook(await buildTemplate());
    expect(r.detectedYear).toBe(2026);
    expect(r.rows).toHaveLength(4);
    const [a, b, c, d] = r.rows;
    expect(a.category).toBe('SISTEMA_CALIDAD');
    expect(b.category).toBe('SISTEMA_CALIDAD'); // carried down
    expect(c.category).toBe('PROCESOS');
    expect(b.name).toBe('Special Process: Welding System Assessment');
    expect(b.requiredBy).toEqual(['GM', 'Ford', 'Stellantis']);
    expect(a.occurrences).toEqual([expect.objectContaining({ month: 10, status: 'REALIZADA' })]);
    expect(b.occurrences).toEqual([expect.objectContaining({ month: 2, status: 'REALIZADA_FUERA_DE_TIEMPO' })]);
    expect(c.occurrences.map((o) => [o.month, o.status])).toEqual([
      [3, 'NO_REALIZADA'],
      [11, 'PROGRAMADA'],
    ]);
    expect(d.occurrences).toEqual([expect.objectContaining({ month: 7, status: 'PROGRAMADA' })]);
    expect(r.fileCounts[10]).toBe(1);
    expect(r.changeHistory).toEqual([expect.objectContaining({ revision: 0, date: '2026-01-06' })]);
  });

  it('detects the issues of spec 16.3', async () => {
    const r = await parseProgramWorkbook(await buildTemplate({ mixedRow: true }));
    const drafts = r.rows.map((row) => ({
      ...row,
      executor: { type: row.responsibleRaw === 'DQS' ? 'EXTERNAL' : 'INTERNAL', name: row.responsibleRaw },
      ownerGroupName: row.responsibleRaw,
      ownerGroupId: null,
      defaultOwnerUserId: null,
      occurrences: row.occurrences,
    }));
    drafts.push({ ...drafts[1], row: 99 }); // duplicate code
    const codes = computeIssues(drafts, { fileCounts: r.fileCounts }).map((i) => `${i.defCode}:${i.code}`);
    expect(codes).toContain('1:REQUIRED_BY_GENERIC');
    expect(codes).toContain('1:OWNER_MISSING');
    expect(codes).toContain('1:GROUP_NOT_FOUND');
    expect(codes).toContain('4:REQUIRED_BY_EMPTY');
    expect(codes).toContain('2:DUPLICATE_CODE');
  });
});

// The real 2026 program, if available locally (read only; never copied into the repo).
const REAL_FILE = process.env.PROGRAM_XLSX || path.join(os.homedir(), 'Downloads', 'Programa General de Auditorías.xlsx');

describe.skipIf(!fs.existsSync(REAL_FILE))('excelParser with the real 2026 file', () => {
  it('reads 28 definitions with the monthly counts of the "Programadas" row', async () => {
    const r = await parseProgramWorkbook(fs.readFileSync(REAL_FILE));
    expect(r.detectedYear).toBe(2026);
    expect(r.rows).toHaveLength(28);
    const counts = Array(12).fill(0);
    for (const row of r.rows) for (const o of row.occurrences) counts[o.month - 1] += 1;
    expect(counts).toEqual([2, 5, 5, 2, 6, 6, 5, 5, 4, 6, 3, 2]);
    expect(counts).toEqual(Array.from({ length: 12 }, (_, i) => r.fileCounts[i + 1]));

    const byCode = Object.fromEntries(r.rows.map((x) => [x.code, x]));
    expect(byCode[9].requiredBy).toEqual(['GM', 'Ford', 'Stellantis']);
    expect(byCode[9].occurrences[0].status).toBe('REALIZADA_FUERA_DE_TIEMPO');
    expect(byCode[27].requiredBy).toHaveLength(8);
    expect(byCode[1].responsibleRaw).toBe('DQS');
    expect(byCode[21].responsibleRaw).toBe('SGS');
  });
});
