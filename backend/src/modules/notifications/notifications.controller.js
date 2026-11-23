import * as notifications from './notifications.service.js';

export async function listRules(_req, res) {
  res.json({ data: await notifications.listRules() });
}

export async function createRule(req, res) {
  res.status(201).json({ data: await notifications.createRule(req.body, req.user) });
}

export async function updateRule(req, res) {
  res.json({ data: await notifications.updateRule(req.params.id, req.body, req.user) });
}

export async function listLog(req, res) {
  const { items, meta } = await notifications.listLog(req.query);
  res.json({ data: items, meta });
}

export async function retry(req, res) {
  res.json({ data: await notifications.retry(req.params.id) });
}

export async function test(req, res) {
  res.json({ data: await notifications.sendTest(req.user, req.body) });
}
