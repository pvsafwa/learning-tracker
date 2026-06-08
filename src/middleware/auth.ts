import type { RequestHandler } from 'express';

// Gate: a valid session is required.
export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated() && req.user) return next();
  res.status(401).json({ error: 'unauthenticated' });
};

// Gate: the session user must be an admin.
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ error: 'forbidden' });
};
