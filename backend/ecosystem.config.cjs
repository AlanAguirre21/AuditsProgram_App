// PM2: `pm2 start ecosystem.config.cjs` from the backend folder, then `pm2 save` + `pm2 startup`.
module.exports = {
  apps: [
    { name: 'audit-api', script: 'src/server.js', cwd: __dirname, instances: 1, env: { NODE_ENV: 'production' } },
    // Phase 2: scheduler (reminders, escalation, digest). Exactly one instance (spec 11.2).
    // { name: 'audit-worker', script: 'src/worker.js', cwd: __dirname, instances: 1, env: { NODE_ENV: 'production' } },
  ],
};
