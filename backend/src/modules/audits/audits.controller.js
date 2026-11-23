import * as audits from './audits.service.js';

export async function list(req, res) {
  res.json({ data: await audits.list(req.query) });
}

export async function meta(req, res) {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const [customers, years] = await Promise.all([audits.distinctCustomers(year), audits.distinctYears()]);
  res.json({ data: { customers, years } });
}

export async function getById(req, res) {
  res.json({ data: await audits.getById(req.params.id) });
}

export async function create(req, res) {
  res.status(201).json({ data: await audits.create(req.body, req.user) });
}

export async function update(req, res) {
  res.json({ data: await audits.update(req.params.id, req.body, req.user) });
}

export async function remove(req, res) {
  await audits.remove(req.params.id, req.user);
  res.status(204).end();
}

export async function addOccurrences(req, res) {
  res.status(201).json({ data: await audits.addOccurrences(req.params.id, req.body, req.user) });
}
