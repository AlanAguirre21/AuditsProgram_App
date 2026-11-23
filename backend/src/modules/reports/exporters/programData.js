/** Shared data for the Excel and PDF exports of the annual program. */
import { CATEGORIES } from '../../../constants/auditCategories.js';
import { monthLabel } from '../../../utils/dates.js';
import * as changelog from '../../changelog/changelog.service.js';
import { getProgram } from '../../program/program.service.js';

export const CATEGORY_TITLE = {
  SISTEMA_CALIDAD: 'AUDITORIAS AL SISTEMA DE CALIDAD',
  CSR: "AUDITORIAS DE REQUERIMIENTOS ESPECÍFICOS DE CLIENTES (CSR's)",
  PROCESOS: 'AUDITORÍAS DE PROCESOS',
};

/** Colors of the original Excel legend (ARGB) + the app's extra states. */
export const STATUS_EXPORT = {
  PROGRAMADA: { argb: 'FFA6A6A6', hex: '#a6a6a6', mark: '○', abbr: 'P', label: 'PROGRAMADA' },
  EN_VALIDACION: { argb: 'FFFFE699', hex: '#ffe699', mark: '…', abbr: 'V', label: 'EN VALIDACIÓN' },
  REALIZADA: { argb: 'FF00FF00', hex: '#00d000', mark: '✓', abbr: 'R', label: 'REALIZADA' },
  REALIZADA_FUERA_DE_TIEMPO: { argb: 'FFFFFF00', hex: '#ffd800', mark: '✓', abbr: 'RF', label: 'REALIZADA FUERA DE TIEMPO' },
  NO_REALIZADA: { argb: 'FFFF0000', hex: '#ff0000', mark: '✗', abbr: 'NR', label: 'NO REALIZADA' },
  CANCELADA: { argb: 'FFF2F2F2', hex: '#f2f2f2', mark: '—', abbr: 'C', label: 'CANCELADA' },
};

export async function loadProgramExport(year) {
  const program = await getProgram(year);
  const pctKey = program.headline === 'total' ? 'total' : 'onTime';
  const groups = CATEGORIES.map((c) => ({ category: c, title: CATEGORY_TITLE[c], rows: program.rows.filter((r) => r.category === c) })).filter((g) => g.rows.length);
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, label: monthLabel(year, i + 1), summary: program.summary[String(i + 1)] }));
  const changes = (await changelog.list({ from: `${year}-01-01`, limit: 100, sort: 'at' })).items.filter((c) =>
    ['RESCHEDULE', 'RESCHEDULE_APPROVE', 'CANCEL', 'CLOSE_NOT_DONE', 'REOPEN', 'REASSIGN', 'IMPORT', 'ROLLOVER', 'VALIDATE', 'REJECT'].includes(c.action),
  );
  return { ...program, pctKey, groups, months, changes };
}
