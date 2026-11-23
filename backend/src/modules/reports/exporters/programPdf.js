/** Annual program → PDF, A3 landscape (spec 9.2). Each status cell has color AND a code. */
import PDFDocument from 'pdfkit';
import { formatDateMx } from '../../../utils/dates.js';
import { STATUS_EXPORT, loadProgramExport } from './programData.js';

const BLUE = '#0057b7';
const GRID = '#c8c8c8';

export async function buildProgramPdf(year) {
  const data = await loadProgramExport(year);
  const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 28, info: { Title: `Programa General de Auditorías ${year}` } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const cols = [
    { key: 'code', label: '#', w: 26 },
    { key: 'name', label: 'Nombre de la auditoría', w: 300 },
    { key: 'standard', label: 'Norma / requerimiento', w: 140 },
    { key: 'requiredBy', label: 'Requerido por', w: 150 },
    { key: 'group', label: 'Responsable', w: 160 },
  ];
  const fixedW = cols.reduce((s, c) => s + c.w, 0);
  const monthW = (width - fixedW) / 12;
  const rowH = 19;
  const bottom = () => doc.page.height - doc.page.margins.bottom - 20;

  const header = () => {
    doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(18).text('PROGRAMA GENERAL DE AUDITORÍAS', left, 28);
    doc.fillColor('#333').font('Helvetica').fontSize(10).text(`Período: Enero - Diciembre ${year}    ·    Generado ${formatDateMx(data.today)}`, left, 52);
    let x = left;
    const y = 72;
    doc.rect(left, y, width, rowH).fill('#ddebf7');
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(8.5);
    for (const c of cols) {
      doc.text(c.label, x + 3, y + 7, { width: c.w - 6, ellipsis: true });
      x += c.w;
    }
    for (const m of data.months) {
      doc.text(m.label, x, y + 7, { width: monthW, align: 'center' });
      x += monthW;
    }
    return y + rowH;
  };

  let y = header();
  const ensure = (h) => {
    if (y + h > bottom()) {
      doc.addPage();
      y = header();
    }
  };

  for (const group of data.groups) {
    ensure(rowH * 2);
    doc.rect(left, y, width, 16).fill('#f2f2f2');
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(8.5).text(group.title, left + 4, y + 3);
    y += 16;
    for (const row of group.rows) {
      ensure(rowH);
      let x = left;
      doc.font('Helvetica').fontSize(8).fillColor('#000');
      const values = { code: String(row.code), name: row.name, standard: row.standard, requiredBy: row.requiredBy.join(', '), group: row.ownerGroup ?? '' };
      for (const c of cols) {
        doc.text(values[c.key], x + 3, y + 3, { width: c.w - 6, height: rowH - 4, ellipsis: true });
        x += c.w;
      }
      for (const m of data.months) {
        const cell = row.months[String(m.month)];
        if (cell) {
          const st = STATUS_EXPORT[cell.status];
          doc.rect(x + 2, y + 2, monthW - 4, rowH - 4).fill(st.hex);
          if (cell.derived === 'VENCIDA') doc.rect(x + 2, y + 2, monthW - 4, rowH - 4).lineWidth(1.5).stroke('#c00000');
          doc.fillColor('#000').font('Helvetica-Bold').fontSize(8).text(`${st.abbr}${cell.rescheduled ? "*" : ""}`, x, y + 5.5, { width: monthW, align: 'center' });
        }
        x += monthW;
      }
      doc.moveTo(left, y + rowH).lineTo(left + width, y + rowH).lineWidth(0.5).stroke(GRID);
      y += rowH;
    }
  }

  ensure(rowH * 3 + 60);
  y += 6;
  const summaryRows = [
    ['Programadas', (s) => String(s.programadas)],
    ['Realizadas', (s) => String(s.realizadas)],
    [`% Cumplimiento (${data.pctKey === 'total' ? 'total' : 'a tiempo'})`, (s) => (s[data.pctKey] == null ? 'N/A' : `${s[data.pctKey]}%`)],
  ];
  for (const [label, fn] of summaryRows) {
    doc.rect(left, y, width, rowH - 4).fill('#f7f9fc');
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(9).text(label, left, y + 5, { width: fixedW - 8, align: 'right' });
    let x = left + fixedW;
    for (const m of data.months) {
      doc.text(fn(m.summary), x, y + 5, { width: monthW, align: 'center' });
      x += monthW;
    }
    y += rowH;
  }

  y += 8;
  let x = left;
  doc.font('Helvetica').fontSize(8);
  for (const st of Object.values(STATUS_EXPORT)) {
    doc.rect(x, y, 22, 12).fill(st.hex);
    doc.fillColor('#000').font('Helvetica-Bold').text(st.abbr, x, y + 3, { width: 22, align: 'center' });
    doc.font('Helvetica').text(st.label, x + 26, y + 3);
    x += 26 + doc.widthOfString(st.label) + 18;
  }
  doc.text('Borde rojo = vencida    * = reprogramada', x, y + 3);

  doc.end();
  return done;
}
