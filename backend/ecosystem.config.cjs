// PM2: `pm2 start ecosystem.config.cjs` from the backend folder, then `pm2 save` + `pm2 startup`.
// Two processes: the API and the scheduler worker. Exactly ONE worker instance (spec 11.2).
module.exports = {
  apps: [
    { name: 'audit-api', script: 'src/server.js', cwd: __dirname, instances: 1, env: { NODE_ENV: 'production' } },
    { name: 'audit-worker', script: 'src/worker.js', cwd: __dirname, instances: 1, autorestart: true, env: { NODE_ENV: 'production' } },
  ],
};
