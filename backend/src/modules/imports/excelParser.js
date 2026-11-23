/**
 * Parser for the "Programa General de Auditorías" Excel template (spec section 16).
 *
 * Pure with respect to the database: it only reads the workbook and returns raw rows.
 * Matching against groups/users and issue detection happen in imports.service.
 */
import ExcelJS from 'exceljs';
import { CATEGORY } from '../../constants/auditCategories.js';
import { STATUS } from '../../constants/statuses.js';
import { MONTH_ABBR_ES } from '../../utils/dates.js';
import { normalizeText } from '../../utils/pagination.js';

const LEGEND = {
  'realizada fuera de tiempo': STATUS.REALIZADA_FUERA_DE_TIEMPO,
  'no realizada': STATUS.NO_REALIZADA,
  realizada: STATUS.REALIZADA,
  programada: STATUS.PROGRAMADA,
};

/** Wingdings-style markers used in the month cells. */
const SYMBOL_DONE = 'p';
const SYMBOL_PENDING = 'ñ';

// ---------------------------------------------------------------------------- cell helpers

export function cellText(cell) {
  const v = cell?.value;
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return String(v.text ?? '');
    if ('result' in v) return v.result == null ? '' : String(v.result);
    if ('formula' in v || 'sharedFormula' in v) return '';
    return '';
  }
  return String(v);
}

const cellNumber = (cell) => {
  const v = cell?.value;
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && typeof v.result === 'number') return v.result;
  const n = Number(String(cellText(cell)).trim());
  return Number.isFinite(n) && String(cellText(cell)).trim() !== '' ? n : null;
};

/** Stable key for a cell's solid fill color, e.g. 'argb:FF00FF00' or 'theme:0:-0.35'. */
export function fillKey(cell) {
  const fill = cell?.fill;
  if (!fill || fill.type !== 'pattern' || !fill.pattern || fill.pattern === 'none') return null;
  const c = fill.fgColor;
  if (!c) return null;
  if (c.argb) return `argb:${c.argb.toUpperCase()}`;
  if (c.theme !== undefined) return `theme:${c.theme}:${Number(c.tint ?? 0).toFixed(2)}`;
  if (c.indexed !== undefined) return `indexed:${c.indexed}`;
  return null;
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------- field mapping

export function mapCategory(raw) {
  const n = normalizeText(raw);
  if (!n) return null;
  if (n.includes('sistema de calidad')) return CATEGORY.SISTEMA_CALIDAD;
  if (n.includes('requerimientos especificos') || /\bcsr/.test(n)) return CATEGORY.CSR;
  if (n.includes('procesos')) return CATEGORY.PROCESOS;
  return null;
}

/** "CSR GM, Ford, Stellantis" → ['GM', 'Ford', 'Stellantis']; "VW/IATF" → ['VW', 'IATF']. */
export function parseRequiredBy(raw) {
  const text = clean(raw);
  if (!text) return [];
  if (/^csr'?s?$/i.test(text)) return ['CSR'];
  const stripped = text.replace(/^csr'?s?\s+/i, '');
  return [...new Set(stripped.split(/[,/]/).map((s) => clean(s)).filter(Boolean))];
}

export const cleanName = (raw) => clean(raw).replace(/\.\s*$/, '');

function monthFromHeader(cell) {
  const v = cell?.value;
  if (v instanceof Date) return { month: v.getUTCMonth() + 1, year: v.getUTCFullYear() };
  const m = normalizeText(cellText(cell)).match(/^([a-z]{3})[-\s/.]*(\d{2}|\d{4})$/);
  if (m) {
    const idx = MONTH_ABBR_ES.indexOf(m[1]);
    if (idx >= 0) return { month: idx + 1, year: m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]) };
  }
  return null;
}

// ---------------------------------------------------------------------------- main

function findHeader(ws) {
  for (let r = 1; r <= Math.min(ws.rowCount, 60); r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= ws.columnCount; c++) {
      if (normalizeText(cellText(row.getCell(c))) === 'nombre de la auditoria') return r;
    }
  }
  return null;
}

function mapColumns(ws, headerRow) {
  const cols = { months: [] };
  const row = ws.getRow(headerRow);
  for (let c = 1; c <= ws.columnCount; c++) {
    const cell = row.getCell(c);
    const n = normalizeText(cellText(cell));
    const month = monthFromHeader(cell);
    if (month) cols.months.push({ col: c, ...month });
    else if (n === 'tipo de auditoria') cols.category = c;
    else if (n === '#' || n === 'no.' || n === 'no') cols.code = c;
    else if (n === 'nombre de la auditoria') cols.name = c;
    else if (n.startsWith('norma')) cols.standard = c;
    else if (n === 'requerido por') cols.requiredBy = c;
    else if (n === 'responsable') cols.responsible = c;
    else if (n === 'nombre' || n === 'nombres') cols.ownerNames = c;
    else if (n === 'ruta') cols.folderPath = c;
  }
  return cols;
}

function findLegend(ws, fromRow) {
  const map = {};
  for (let r = fromRow; r <= ws.rowCount; r++) {
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
      const status = LEGEND[normalizeText(cellText(cell))];
      const key = fillKey(cell);
      if (status && key && !map[key]) map[key] = status;
    });
  }
  return map;
}

function findChangeHistory(ws) {
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    let contentCol = null;
    let dateCol = null;
    let revCol = null;
    let byCol = null;
    let reviewedCol = null;
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      const n = normalizeText(cellText(cell));
      if (n === 'contenido del cambio') contentCol = c;
      else if (n === 'fecha') dateCol = c;
      else if (n.startsWith('revision')) revCol = c;
      else if (n === 'elaboro') byCol = c;
      else if (n === 'reviso') reviewedCol = c;
    });
    if (!contentCol) continue;

    const entries = [];
    for (let rr = r + 1; rr <= ws.rowCount; rr++) {
      const data = ws.getRow(rr);
      const content = clean(cellText(data.getCell(contentCol)));
      if (!content) {
        if (entries.length) break;
        continue;
      }
      const dateVal = dateCol ? data.getCell(dateCol).value : null;
      entries.push({
        revision: revCol ? cellNumber(data.getCell(revCol)) : null,
        date: dateVal instanceof Date ? dateVal.toISOString().slice(0, 10) : null,
        content,
        preparedBy: byCol ? clean(cellText(data.getCell(byCol))) : null,
        reviewedBy: reviewedCol ? clean(cellText(data.getCell(reviewedCol))) : null,
      });
    }
    return entries;
  }
  return [];
}

function resolveCellStatus(text, legendStatus) {
  const t = text.trim().toLowerCase();
  const warnings = [];
  if (!t && !legendStatus) return null;

  let status;
  if (legendStatus === STATUS.NO_REALIZADA) status = STATUS.NO_REALIZADA;
  else if (t === SYMBOL_DONE) {
    status = legendStatus === STATUS.REALIZADA_FUERA_DE_TIEMPO ? STATUS.REALIZADA_FUERA_DE_TIEMPO : STATUS.REALIZADA;
    if (legendStatus === STATUS.PROGRAMADA) warnings.push('marcada como realizada (✓) con color de PROGRAMADA');
  } else if (t) {
    // 'ñ' (pending) or any other mark: the symbol wins, as in the Excel "Realizadas" formula.
    status = STATUS.PROGRAMADA;
    if (legendStatus === STATUS.REALIZADA || legendStatus === STATUS.REALIZADA_FUERA_DE_TIEMPO) {
      warnings.push(`color de ${legendStatus.replace(/_/g, ' ')} pero sin marca de realizada`);
    }
    if (t !== SYMBOL_PENDING) warnings.push(`marca desconocida "${text.trim()}"`);
  } else {
    status = legendStatus;
  }
  return { status, warnings };
}

/**
 * @returns {{ detectedYear, sheetName, rows, fileCounts, changeHistory }}
 */
export async function parseProgramWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  let ws = null;
  let headerRow = null;
  for (const sheet of wb.worksheets) {
    const r = findHeader(sheet);
    if (r) {
      ws = sheet;
      headerRow = r;
      break;
    }
  }
  if (!ws) throw new Error('No se encontró la fila de encabezados ("NOMBRE DE LA AUDITORIA")');

  const cols = mapColumns(ws, headerRow);
  const missing = ['code', 'name', 'standard', 'requiredBy', 'responsible'].filter((k) => !cols[k]);
  if (missing.length) throw new Error(`Faltan columnas en el encabezado: ${missing.join(', ')}`);
  if (cols.months.length === 0) throw new Error('No se encontraron columnas de meses (ene-26 … dic-26)');

  // Year: month headers first, then any "20xx" in the title rows.
  let detectedYear = cols.months[0].year;
  if (!detectedYear) {
    for (let r = 1; r < headerRow && !detectedYear; r++) {
      ws.getRow(r).eachCell((cell) => {
        const m = cellText(cell).match(/\b(20\d{2})\b/);
        if (m && !detectedYear) detectedYear = Number(m[1]);
      });
    }
  }

  const legend = findLegend(ws, headerRow + 1);
  const rows = [];
  const fileCounts = {};
  let lastCategory = '';

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const rowTexts = [];
    row.eachCell({ includeEmpty: false }, (cell) => rowTexts.push(normalizeText(cellText(cell))));

    if (rowTexts.includes('programadas')) {
      for (const m of cols.months) fileCounts[m.month] = cellNumber(row.getCell(m.col)) ?? 0;
      break; // summary rows reached: data is over
    }

    const categoryRaw = cols.category ? clean(cellText(row.getCell(cols.category))) : '';
    if (categoryRaw) lastCategory = categoryRaw;

    const code = cellNumber(row.getCell(cols.code));
    if (code == null || !Number.isInteger(code)) continue;

    const occurrences = [];
    for (const m of cols.months) {
      const cell = row.getCell(m.col);
      const text = cellText(cell);
      const color = fillKey(cell);
      const resolved = resolveCellStatus(text, color ? legend[color] : undefined);
      if (resolved) occurrences.push({ month: m.month, status: resolved.status, mark: text.trim(), color, warnings: resolved.warnings });
    }

    const folderCell = cols.folderPath ? row.getCell(cols.folderPath) : null;
    rows.push({
      row: r,
      code,
      categoryRaw: lastCategory,
      category: mapCategory(lastCategory),
      name: cleanName(cellText(row.getCell(cols.name))),
      standard: clean(cellText(row.getCell(cols.standard))),
      requiredByRaw: clean(cellText(row.getCell(cols.requiredBy))),
      requiredBy: parseRequiredBy(cellText(row.getCell(cols.requiredBy))),
      responsibleRaw: clean(cellText(row.getCell(cols.responsible))),
      ownerNamesRaw: cols.ownerNames ? clean(cellText(row.getCell(cols.ownerNames))) : '',
      folderPath: folderCell ? clean(cellText(folderCell)) : '',
      occurrences,
    });
  }

  return { detectedYear, sheetName: ws.name, rows, fileCounts, changeHistory: findChangeHistory(ws), legend };
}
