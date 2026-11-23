import * as users from './users.service.js';

export async function list(req, res) {
  const { items, meta } = await users.list(req.query);
  res.json({ data: items, meta });
}

export async function lookup(req, res) {
  res.json({ data: await users.lookup(req.query.q) });
}

export async function getById(req, res) {
  res.json({ data: await users.getById(req.params.id) });
}

export async function create(req, res) {
  res.status(201).json({ data: await users.create(req.body, req.user) });
}

export async function update(req, res) {
  res.json({ data: await users.update(req.params.id, req.body, req.user) });
}

export async function updateMe(req, res) {
  res.json({ data: await users.updateMe(req.user._id, req.body) });
}

export async function reassign(req, res) {
  res.json({ data: await users.reassign(req.params.id, req.body, req.user) });
}
