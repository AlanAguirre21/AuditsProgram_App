import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import routes from './routes/index.js';

// Built frontend (`npm run build` in frontend/). When it exists the API also serves the web app,
// so production is a single port; in development Vite serves it on 5190 instead.
const frontendDist = fileURLToPath(new URL('../../frontend/dist', import.meta.url));

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  // The plant server is plain HTTP: without this, browsers would rewrite every asset to https.
  app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  if (!env.isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url.endsWith('/health') },
        serializers: { req: (req) => ({ method: req.method, url: req.url }), res: (res) => ({ statusCode: res.statusCode }) },
      }),
    );
  }

  app.use('/api/v1', routes);
  if (!env.isTest && fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist));
    // SPA fallback: any other GET outside /api returns index.html (React Router handles it).
    app.get(/^(?!\/api(\/|$)).*/, (req, res) => res.sendFile('index.html', { root: frontendDist }));
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
