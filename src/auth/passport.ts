import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from '../config';
import { logger } from '../lib/logger';
import * as usersRepo from '../db/repositories/users.repo';
import { toSessionUser } from '../db/repositories/users.repo';
import type { SessionUser } from '../types';

export function configurePassport(): void {
  if (config.google.configured) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.google.clientId,
          clientSecret: config.google.clientSecret,
          callbackURL: config.google.callbackURL
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(null, false, { message: 'no-email' });
            // Allowlist enforcement lives in the repo: returns null if not allowed.
            const user = await usersRepo.loginWithGoogle({
              sub: profile.id,
              email,
              name: profile.displayName ?? null,
              picture: profile.photos?.[0]?.value ?? null
            });
            if (!user) return done(null, false, { message: 'not-allowed' });
            return done(null, toSessionUser(user));
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );
  } else {
    logger.warn(
      'Google OAuth not configured (GOOGLE_CLIENT_ID/SECRET missing) — Google sign-in disabled.'
    );
  }

  // Keep only the user id in the session; rehydrate from the DB each request so
  // role/status changes (and removals) take effect immediately.
  passport.serializeUser<number>((user, done) => done(null, (user as SessionUser).id));
  passport.deserializeUser<number>(async (id, done) => {
    try {
      const u = await usersRepo.findById(id);
      if (!u || u.status !== 'allowed') return done(null, false);
      done(null, toSessionUser(u));
    } catch (err) {
      done(err as Error);
    }
  });
}

export { passport };
