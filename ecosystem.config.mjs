// PM2, from the project root:  pm2 start ecosystem.config.mjs && pm2 save
// Build the frontend first (cd frontend && npm run build): audit-api also serves frontend/dist,
// so the whole app is on one port (PORT in backend/.env, 3045).
//   audit-api    → web app + REST API
//   audit-worker → scheduler. Exactly ONE instance (spec 11.2), or notifications are sent twice.
// PM2 reads the named `apps` export (it does not unwrap `export default`).
// exec_mode 'fork' is explicit: with `instances` set and no exec_mode, PM2 silently uses cluster mode.
import path from 'node:path';

const backend = path.join(import.meta.dirname, 'backend');

export const apps = [
  {
    name: 'audit-api',
    cwd: backend,
    script: 'src/server.js',
    exec_mode: 'fork',
    instances: 1,
    env: { NODE_ENV: 'production' },
    max_memory_restart: '500M', // headroom for Excel/PDF exports and imports
    time: true,
  },
  {
    name: 'audit-worker',
    cwd: backend,
    script: 'src/worker.js',
    exec_mode: 'fork',
    instances: 1,
    env: { NODE_ENV: 'production' },
    max_memory_restart: '300M',
    time: true,
  },
];
