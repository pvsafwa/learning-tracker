import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Wrap async route handlers so rejected promises reach Express' error handler
// instead of becoming unhandled rejections.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
