import * as evidence from './evidence.service.js';

export async function download(req, res, next) {
  const { doc, stream } = await evidence.getForDownload(req.params.id);
  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Length', doc.size);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  stream.on('error', next);
  stream.pipe(res);
}

export async function remove(req, res) {
  await evidence.remove(req.params.id, req.user);
  res.status(204).end();
}
