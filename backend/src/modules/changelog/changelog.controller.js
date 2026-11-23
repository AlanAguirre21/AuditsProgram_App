import * as changelog from './changelog.service.js';

export async function list(req, res) {
  const { items, meta } = await changelog.list(req.query);
  res.json({ data: items, meta });
}
