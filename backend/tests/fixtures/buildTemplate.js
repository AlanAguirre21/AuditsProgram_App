import ExcelJS from 'exceljs';

/** Builds a small workbook with the template layout. */
export async function buildTemplate({ mixedRow = false } = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('F.O.3.3.0-03');
  ws.getCell('C3').value = 'PROGRAMA GENERAL DE AUDITORIAS';
  ws.getCell('D6').value = 'Enero - Diciembre 2026';
  const header = ['TIPO DE AUDITORIA', '#', 'NOMBRE DE LA AUDITORIA', 'NORMA / REQUERIMIENTO', 'REQUERIDO POR', 'RESPONSABLE', 'Nombre'];
  header.forEach((h, i) => (ws.getRow(9).getCell(2 + i).value = h));
  for (let m = 0; m < 12; m++) ws.getRow(9).getCell(9 + m).value = new Date(Date.UTC(2026, m, 1));

  const green = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
  const yellow = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  const red = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
  const gray = { type: 'pattern', pattern: 'solid', fgColor: { theme: 0, tint: -0.3499862666707358 } };

  const rows = [
    ['AUDITORIAS AL SISTEMA DE CALIDAD', 1, 'Auditoría Externa de Re-Certificación', 'IATF 16949:2016', 'CSR', 'DQS', 'PENDIENTE'],
    [null, 2, 'Special Process: Welding System Assessment.', 'CQI-15', 'CSR GM, Ford, Stellantis', 'Equipo Soldadura', 'Nelson Lara'],
    ['AUDITORÍAS DE PROCESOS', 3, 'VDA 6.3', 'VDA 6.3', 'VW, Audi, BMW', 'Calidad N1, N2', ''],
    mixedRow
      ? [null, 4, 'MMOG/LE Assessment Requirement', 'MMOG/LE', '', 'Ford, Stellantis, Volvo Logística-Customer Services', '']
      : [null, 4, 'MMOG/LE Assessment Requirement', 'MMOG/LE', 'Ford', 'Logística-Customer Services', ''],
  ];
  rows.forEach((values, i) => values.forEach((v, j) => (ws.getRow(10 + i).getCell(2 + j).value = v)));

  // Month cells: row 10 Oct done (p), row 11 Feb late (yellow p), row 12 Nov pending (ñ) + Mar red, row 13 Jul gray only.
  const set = (r, month, value, fill) => {
    const c = ws.getRow(r).getCell(8 + month);
    if (value) c.value = value;
    if (fill) c.fill = fill;
  };
  set(10, 10, 'p', green);
  set(11, 2, 'p', yellow);
  set(12, 11, 'ñ');
  set(12, 3, null, red);
  set(13, 7, null, gray);

  ws.getRow(15).getCell(7).value = 'Programadas';
  [0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0].forEach((n, m) => (ws.getRow(15).getCell(9 + m).value = n));
  ws.getCell('J18').value = 'REALIZADA';
  ws.getCell('J18').fill = green;
  ws.getCell('N18').value = 'REALIZADA FUERA DE TIEMPO';
  ws.getCell('N18').fill = yellow;
  ws.getCell('J19').value = 'PROGRAMADA';
  ws.getCell('J19').fill = gray;
  ws.getCell('N19').value = 'NO REALIZADA';
  ws.getCell('N19').fill = red;

  ws.getCell('Y22').value = 'REVISIÓN No.';
  ws.getCell('Z22').value = 'FECHA';
  ws.getCell('AA22').value = 'CONTENIDO DEL CAMBIO';
  ws.getCell('Y23').value = 0;
  ws.getCell('Z23').value = new Date(Date.UTC(2026, 0, 6));
  ws.getCell('AA23').value = 'Emisión del programa de auditorias 2026';
  return Buffer.from(await wb.xlsx.writeBuffer());
}

