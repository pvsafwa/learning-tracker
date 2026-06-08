// Minimal forward-only SQL migration runner.
//
// Why hand-rolled: it's transparent and dependency-free, which is great for
// learning. Each *.sql file in /migrations runs once, in filename order, inside
// a transaction, and is recorded in schema_migrations. Real teams often use
// Flyway / Liquibase / node-pg-migrate — same idea, more features.
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pool } from './pool';
import { logger } from '../lib/logger';

const MIGRATIONS_DIR = resolve(__dirname, '../../migrations');

// Arbitrary constant so concurrent app instances serialize on the same lock.
const MIGRATION_LOCK_KEY = 727274;

export async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    // Session-level advisory lock: only one instance migrates at a time; others
    // wait, then find the DB already up to date. (Important for K8s replicas.)
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    const applied = new Set(
      (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map(
        (r) => r.name
      )
    );

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      logger.info({ file }, 'Applying migration');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        ran++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    logger.info({ ran, total: files.length }, ran ? 'Migrations applied' : 'Database up to date');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => {});
    client.release();
  }
}

// Allow running directly: `node dist/db/migrate.js` / `tsx src/db/migrate.ts`.
if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'Migration failed');
      process.exit(1);
    });
}
