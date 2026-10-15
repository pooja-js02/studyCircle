import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimits.js';
import { errorHandler, notFoundRoute } from './middleware/errorHandler.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind Render's proxy, so rate limits see the real IP

  // NFR-SEC-06: security headers and a CORS allow-list of the frontend origin(s)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.clientOrigins, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', apiLimiter, routes);

  app.use(notFoundRoute);
  app.use(errorHandler);
  return app;
}
