import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';

// 404 for unmatched API routes (the SPA fallback handles everything else).
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'not_found' });
};

// Central error handler: validation errors → 400, everything else → 500.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'invalid_request', details: err.flatten() });
    return;
  }
  logger.error({ err }, 'Unhandled request error');
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal_error' });
};
