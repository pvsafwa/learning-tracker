import path from 'node:path';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from './config';
import { logger } from './lib/logger';
import { pool } from './db/pool';
import { passport, configurePassport } from './auth/passport';
import { authRouter } from './auth/routes';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFound } from './middleware/error';
import { meRouter } from './routes/me';
import { libraryRouter } from './routes/library';
import { progressRouter } from './routes/progress';
import { notesRouter } from './routes/notes';
import { cardsRouter } from './routes/cards';
import { goalsRouter } from './routes/goals';
import { achievementsRouter } from './routes/achievements';
import { adminRouter } from './routes/admin';

const PUBLIC_DIR = path.resolve(__dirname, '../public');

export function createApp() {
  configurePassport();
  const app = express();
  app.disable('x-powered-by');
  // Behind a TLS-terminating proxy in production (so secure cookies work).
  if (config.isProd) app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' }
    })
  );

  // Security headers, incl. a Content-Security-Policy tuned for this app.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'], // https: for Google profile photos
          mediaSrc: ["'self'", 'blob:'],
          frameSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false
    })
  );

  app.use(express.json({ limit: '1mb' }));

  // Server-side sessions stored in PostgreSQL (the app tier stays stateless).
  const PgStore = connectPgSimple(session);
  app.use(
    session({
      store: new PgStore({ pool, tableName: 'session', createTableIfMissing: false }),
      name: 'lt.sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProd,
        maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
      }
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // ── Health & readiness (liveness has no dependencies; readiness checks DB) ────
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/readyz', (_req, res) => {
    pool
      .query('SELECT 1')
      .then(() => res.json({ ok: true }))
      .catch(() => res.status(503).json({ ok: false }));
  });

  // ── Auth flow ─────────────────────────────────────────────────────────────────
  app.use('/auth', authRouter);

  // ── REST API ──────────────────────────────────────────────────────────────────
  const api = express.Router();
  api.use(meRouter); // /api/me is reachable without a session
  api.use(requireAuth); // everything below requires one
  api.use(libraryRouter);
  api.use(progressRouter);
  api.use(notesRouter);
  api.use(cardsRouter);
  api.use(goalsRouter);
  api.use(achievementsRouter);
  api.use(adminRouter); // requireAdmin enforced inside
  api.use(notFound); // unknown /api/* → JSON 404
  app.use('/api', api);

  // ── Static SPA (presentation tier) ─────────────────────────────────────────────
  app.use(express.static(PUBLIC_DIR, { index: false, maxAge: 0 }));
  app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

  app.use(errorHandler);
  return app;
}
