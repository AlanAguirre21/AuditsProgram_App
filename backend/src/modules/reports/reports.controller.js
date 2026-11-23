import * as reports from './reports.service.js';

export async function dashboard(req, res) {
  res.json({ data: await reports.dashboard(req.user) });
}
