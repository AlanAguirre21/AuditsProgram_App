/**
 * Annual program → .xlsx with the same layout as the current Excel (title, period, header row,
 * merged category column, month cells colored with the legend, Programadas / Realizadas /
 * % Cumplimiento rows, legend) plus a "Cambios" sheet with the year's relevant changes.
 */
import ExcelJS from 'exceljs';
import { formatDateMx } from '../../../utils/dates.js';
import { STATUS_EXPORT, loadProgramExport } from './programData.js';

const ACTION_ES = {
  RESCHEDULE: 'Reprogramación',
  RESCHEDULE_APPROVE: 'Reprogramación aprobada',
  CANCEL: 'Cancelación',
  CLOSE_NOT_DONE: 'Cerrada como no realizada',
  REOPEN: 'Reapertura',
  REASSIGN: 'Reasignación',
  IMPORT: 'Importación',
  ROLLOVER: 'Cambio de año',
  VALIDATE: 'Validación',
  REJECT: 'Rechazo',
};

const thin = { style: 'thin', color: { argb: 'FFBFBFBF' } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
const solid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

export async function buildProgramWorkbook(year) {
  const data = await loadProgramExport(year);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Programa General de Auditorías';
  wb.created = new Date();
  const ws = wb.addWorksheet('Programa', { views: [{ state: 'frozen', xSplit: 4, ySplit: 9 }], pageSetup: { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });

  // Columns: B tipo, C #, D nombre, E norma, F requerido por, G responsable (grupo), H nombre, I ruta, J..U meses
  ws.columns = [
    { width: 2 }, { width: 24 }, { width: 5 }, { width: 44 }, { width: 22 }, { width: 24 }, { width: 26 }, { width: 22 }, { width: 18 },
    ...Array.from({ length: 12 }, () => ({ width: 7.5 })),
  ];
  const lastCol = 9 + 12;

  ws.mergeCells(3, 3, 3, lastCol);
  Object.assign(ws.getCell(3, 3), { value: 'PROGRAMA GENERAL DE AUDITORIAS', font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }, fill: solid('FF0070C0'), alignment: { horizontal: 'center' } });
  ws.getCell(6, 2).value = 'PERÍODO:';
  ws.getCell(6, 2).font = { bold: true };
  ws.getCell(6, 4).value = `Enero - Diciembre ${year}`;
  ws.getCell(7, 2).value = `Generado: ${formatDateMx(data.today)} · % Cumplimiento ${data.pctKey === 'total' ? 'total' : 'a tiempo'} (N/A = nada exigible aún)`;
  ws.getCell(7, 2).font = { italic: true, size: 9, color: { argb: 'FF6E6E73' } };

  const headers = ['TIPO DE AUDITORIA', '#', 'NOMBRE DE LA AUDITORIA', 'NORMA / REQUERIMIENTO', 'REQUERIDO POR', 'RESPONSABLE', 'Nombre', 'Ruta', ...data.months.map((m) => m.label)];
  headers.forEach((h, i) => {
    const c = ws.getCell(9, 2 + i);
    Object.assign(c, { value: h, font: { bold: true, size: 10 }, fill: headerFill, border, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
  });
  ws.getRow(9).height = 30;

  let r = 10;
  for (const group of data.groups) {
    const start = r;
    for (const row of group.rows) {
      const values = [null, row.code, row.name, row.standard, row.requiredBy.join(', '), row.ownerGroup ?? '', row.defaultOwner ?? '', ''];
      values.forEach((v, i) => {
        const c = ws.getCell(r, 2 + i);
        c.value = v;
        c.border = border;
        c.alignment = { vertical: 'middle', wrapText: true, horizontal: i === 1 ? 'center' : 'left' };
        c.font = { size: 10 };
      });
      data.months.forEach((m, i) => {
        const c = ws.getCell(r, 10 + i);
        const cell = row.months[String(m.month)];
        c.border = border;
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        if (cell) {
          const st = STATUS_EXPORT[cell.status];
          c.value = `${st.mark}${cell.others?.length ? ` +${cell.others.length}` : ''}`;
          c.fill = solid(st.argb);
          c.font = { bold: true, size: 11, strike: cell.status === 'CANCELADA', color: { argb: cell.derived === 'VENCIDA' ? 'FFC00000' : 'FF000000' } };
          c.note = `${st.label}${cell.derived === 'VENCIDA' ? ' (VENCIDA)' : ''} · vence ${formatDateMx(cell.dueDate)}${cell.rescheduled ? ' · reprogramada' : ''}`;
        }
      });
      r += 1;
    }
    ws.mergeCells(start, 2, r - 1, 2);
    Object.assign(ws.getCell(start, 2), { value: group.title, font: { bold: true, size: 10 }, alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }, fill: solid('FFF2F2F2'), border });
  }

  r += 1;
  const summary = [
    ['Programadas', (s) => s.programadas, 'FFD9D9D9'],
    ['Realizadas', (s) => s.realizadas, 'FF00FF00'],
    ['% Cumplimiento', (s) => (s[data.pctKey] == null ? 'N/A' : s[data.pctKey] / 100), 'FFBDD7EE'],
  ];
  for (const [label, fn, argb] of summary) {
    Object.assign(ws.getCell(r, 7), { value: label, font: { bold: true }, fill: solid(argb), border, alignment: { horizontal: 'right' } });
    data.months.forEach((m, i) => {
      const c = ws.getCell(r, 10 + i);
      c.value = fn(m.summary);
      c.border = border;
      c.alignment = { horizontal: 'center' };
      c.font = { bold: true };
      if (label === '% Cumplimiento' && typeof c.value === 'number') c.numFmt = '0%';
    });
    r += 1;
  }

  r += 1;
  const legend = Object.values(STATUS_EXPORT);
  legend.forEach((st, i) => {
    const row = r + Math.floor(i / 3);
    const col = 10 + (i % 3) * 4;
    ws.mergeCells(row, col, row, col + 2);
    Object.assign(ws.getCell(row, col), { value: `${st.mark} ${st.label}`, fill: solid(st.argb), font: { bold: true, size: 9 }, border, alignment: { horizontal: 'center' } });
  });

  // Second sheet: change history (replaces the manual FECHA / CONTENIDO DEL CAMBIO table).
  const cs = wb.addWorksheet('Cambios');
  cs.columns = [
    { header: 'FECHA', key: 'at', width: 14 },
    { header: 'TIPO', key: 'action', width: 26 },
    { header: 'CONTENIDO DEL CAMBIO', key: 'reason', width: 80 },
    { header: 'USUARIO', key: 'user', width: 28 },
  ];
  cs.getRow(1).font = { bold: true };
  cs.getRow(1).fill = headerFill;
  for (const c of data.changes) {
    cs.addRow({ at: formatDateMx(c.at), action: ACTION_ES[c.action] ?? c.action, reason: c.reason ?? '', user: c.system ? 'Sistema' : c.userId?.name ?? '' });
  }
  cs.getColumn('reason').alignment = { wrapText: true, vertical: 'top' };

  return wb.xlsx.writeBuffer();
}
