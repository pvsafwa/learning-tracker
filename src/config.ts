import 'dotenv/config';
import { z } from 'zod';

// 12-factor config: everything comes from the environment, validated once at boot.
// Invalid/missing required config fails fast with a clear message instead of
// surfacing as a confusing runtime error later.
const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null ? def : v === 'true' || v === '1'));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4173),
  APP_BASE_URL: z.string().url().default('http://localhost:4173'),
  SESSION_SECRET: z.string().min(32).optional(),
  DATABASE_URL: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  ADMIN_EMAILS: z.string().optional().default(''),
  DEV_LOGIN_ENABLED: bool(false),
  // Set true once the site is served over HTTPS. Defaults to NODE_ENV==='production'
  // so prod stays safe by default, but lets a local prod-mode stack run over plain HTTP.
  COOKIE_SECURE: z.string().optional()
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;
const isProd = env.NODE_ENV === 'production';

// Secrets get no defaults in production — fail fast instead of running insecure.
const sessionSecret = env.SESSION_SECRET ?? (isProd ? null : 'dev-insecure-secret-change-me');
if (!sessionSecret) {
  console.error(
    'SESSION_SECRET is required in production (>= 32 chars). Generate: openssl rand -hex 32'
  );
  process.exit(1);
}

export const config = {
  env: env.NODE_ENV,
  isProd,
  port: env.PORT,
  appBaseUrl: env.APP_BASE_URL.replace(/\/$/, ''),
  sessionSecret,
  cookieSecure:
    env.COOKIE_SECURE == null ? isProd : env.COOKIE_SECURE === 'true' || env.COOKIE_SECURE === '1',
  databaseUrl: env.DATABASE_URL,
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    get configured() {
      return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
    },
    get callbackURL() {
      return `${env.APP_BASE_URL.replace(/\/$/, '')}/auth/google/callback`;
    }
  },
  adminEmails: env.ADMIN_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  // Dev login is only ever honoured outside production.
  devLoginEnabled: env.DEV_LOGIN_ENABLED && !isProd
};

export type AppConfig = typeof config;
