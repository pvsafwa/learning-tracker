import { Router } from 'express';
import { config } from '../config';

export const meRouter = Router();

// Public: the SPA calls this on load to learn whether the visitor is signed in
// and which sign-in methods are available, so it can render the right screen.
meRouter.get('/me', (req, res) => {
  const authenticated = req.isAuthenticated() && Boolean(req.user);
  res.json({
    authenticated,
    user: authenticated ? req.user : null,
    googleConfigured: config.google.configured,
    devLoginEnabled: config.devLoginEnabled
  });
});
