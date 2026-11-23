import { buildProgramWorkbook } from './exporters/programExcel.js';
import { buildProgramPdf } from './exporters/programPdf.js';
import { compliance as complianceReport } from './reports.compliance.js';
import * as reports from './reports.service.js';

export async function dashboard(req, res) {
  res.json({ data: await reports.dashboard(req.user) });
}

export async function compliance(req, res) {
  res.json({ data: await complianceReport(req.query.year, req.query.groupBy) });
}

const disposition = (name) => `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`;

export async function exportXlsx(req, res) {
  const buffer = await buildProgramWorkbook(req.query.year);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', disposition(`Programa General de Auditorias ${req.query.year}.xlsx`));
  res.send(Buffer.from(buffer));
}

export async function exportPdf(req, res) {
  const buffer = await buildProgramPdf(req.query.year);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', disposition(`Programa General de Auditorias ${req.query.year}.pdf`));
  res.send(buffer);
}
