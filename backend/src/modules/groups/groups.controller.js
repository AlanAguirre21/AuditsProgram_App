import * as groups from './groups.service.js';

export async function list(req, res) {
  res.json({ data: await groups.list(req.query) });
}

export async function getById(req, res) {
  res.json({ data: await groups.getById(req.params.id) });
}

export async function create(req, res) {
  res.status(201).json({ data: await groups.create(req.body, req.user) });
}

export async function update(req, res) {
  res.json({ data: await groups.update(req.params.id, req.body, req.user) });
}

export async function addMembers(req, res) {
  res.json({ data: await groups.addMembers(req.params.id, req.body.userIds, req.user) });
}

export async function removeMember(req, res) {
  res.json({ data: await groups.removeMember(req.params.id, req.params.userId, req.user) });
}

export async function remove(req, res) {
  await groups.remove(req.params.id, req.user);
  res.status(204).end();
}
