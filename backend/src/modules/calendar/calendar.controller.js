import * as calendar from './calendar.service.js';

export async function list(req, res) {
  res.json({ data: await calendar.list(req.query.year) });
}

export async function create(req, res) {
  res.status(201).json({ data: await calendar.create(req.body, req.user) });
}

export async function remove(req, res) {
  await calendar.remove(req.params.id, req.user);
  res.status(204).end();
}
