import { config } from './config';
import { logger } from './lib/logger';
import { createApp } from './app';
import { migrate } from './db/migrate';
import { pool } from './db/pool';
import * as usersRepo from './db/repositories/users.repo';

async function main(): Promise<void> {
  // Apply DB migrations (idempotent + advisory-locked, so it's safe even if
  // multiple instances boot at once).
  await migrate();

  // Seed admin accounts from ADMIN_EMAILS so the first owner can sign in.
  for (const email of config.adminEmails) {
    await usersRepo
      .seedAdmin(email)
      .catch((err) => logger.error({ err, email }, 'Failed to seed admin'));
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, env: config.env, baseUrl: config.appBaseUrl },
      'Learning Tracker API listening'
    );
  });

  // Graceful shutdown so in-flight requests finish and the DB pool closes.
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      pool.end().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
