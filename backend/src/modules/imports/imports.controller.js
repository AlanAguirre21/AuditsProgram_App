import { AppError } from '../../utils/AppError.js';
import * as imports from './imports.service.js';

export async function preview(req, res) {
  if (!req.file) throw AppError.badRequest('Adjunta el archivo .xlsx (campo "file")');
  const year = Number(req.body.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw AppError.badRequest('Año inválido');
  const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  res.status(201).json({ data: await imports.preview({ buffer: req.file.buffer, fileName, year }, req.user) });
}

export async function get(req, res) {
  res.json({ data: await imports.get(req.params.id) });
}

export async function patch(req, res) {
  res.json({ data: await imports.patch(req.params.id, req.body) });
}

export async function createGroups(req, res) {
  res.json({ data: await imports.createMissingGroups(req.params.id, req.user) });
}

export async function confirm(req, res) {
  res.json({ data: await imports.confirm(req.params.id, req.user) });
}

export async function discard(req, res) {
  await imports.discard(req.params.id);
  res.status(204).end();
}
