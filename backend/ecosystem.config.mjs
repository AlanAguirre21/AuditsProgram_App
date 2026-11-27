// PM2: `pm2 start ecosystem.config.mjs` from the backend folder, then `pm2 save` + `pm2 startup`.
// Three processes:
//   audit-api    → REST API on PORT (3045)
//   audit-worker → scheduler. Exactly ONE instance (spec 11.2), or notifications are sent twice.
//   audit-web    → serves the built frontend (frontend/dist, run `npm run build` first) with
//                  `vite preview` on 5190; it proxies /api to the API (vite.config.js).
// PM2 reads the named `apps` export (it does not unwrap `export default`).
// exec_mode 'fork' is explicit: with `instances` set and no exec_mode, PM2 silently uses cluster mode.
import path from 'node:path';

const backend = import.meta.dirname;
const frontend = path.join(backend, '..', 'frontend');

export const apps = [
  { name: 'audit-api', script: 'src/server.js', cwd: backend, exec_mode: 'fork', instances: 1, env: { NODE_ENV: 'production' } },
  { name: 'audit-worker', script: 'src/worker.js', cwd: backend, exec_mode: 'fork', instances: 1, autorestart: true, env: { NODE_ENV: 'production' } },
  { name: 'audit-web', script: 'node_modules/vite/bin/vite.js', args: 'preview', cwd: frontend, exec_mode: 'fork', instances: 1, env: { NODE_ENV: 'production' } },
];
