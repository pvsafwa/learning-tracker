import { Router } from 'express';
import { passport } from './passport';
import { config } from '../config';
import { asyncHandler } from '../middleware/asyncHandler';
import * as usersRepo from '../db/repositories/users.repo';
import { toSessionUser } from '../db/repositories/users.repo';
import type { SessionUser } from '../types';

export const authRouter = Router();

// Kick off the Google OAuth flow.
authRouter.get('/google', (req, res, next) => {
  if (!config.google.configured) return res.redirect('/?auth=unconfigured');
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// OAuth callback: success → session + redirect home; denied → /?auth=denied.
authRouter.get('/google/callback', (req, res, next) => {
  passport.authenticate(
    'google',
    (err: unknown, user: SessionUser | false) => {
      if (err) return next(err);
      if (!user) return res.redirect('/?auth=denied');
      req.logIn(user, (e) => (e ? next(e) : res.redirect('/')));
    }
  )(req, res, next);
});

authRouter.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('lt.sid');
      res.status(204).end();
    });
  });
});

// ── Local/CI testing only ─────────────────────────────────────────────────────
// Logs in an already-allowlisted email WITHOUT Google. Hard-gated by
// DEV_LOGIN_ENABLED and never active in production (see config).
if (config.devLoginEnabled) {
  authRouter.post(
    '/dev',
    asyncHandler(async (req, res, next) => {
      const email = String(req.body?.email ?? '').toLowerCase();
      if (!email) return res.status(400).json({ error: 'email required' });
      const user = await usersRepo.findByEmail(email);
      if (!user || user.status !== 'allowed') return res.status(403).json({ error: 'not_allowed' });
      req.logIn(toSessionUser(user), (e) =>
        e ? next(e) : res.json({ ok: true, user: toSessionUser(user) })
      );
    })
  );
}
