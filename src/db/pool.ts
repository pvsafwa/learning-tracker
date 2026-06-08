import { Pool, type QueryResultRow } from 'pg';
import { config } from '../config';
import { logger } from '../lib/logger';

// A single shared connection pool for the whole process. The app tier is
// stateless; all shared state lives here in PostgreSQL.
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected idle PostgreSQL client error');
});

// Small typed query helper so call sites stay terse.
export function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params as unknown[]);
}
