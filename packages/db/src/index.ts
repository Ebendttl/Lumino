import { Pool } from 'pg';
import migrationRunner from 'node-pg-migrate';
import * as path from 'path';

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  // Limit connection pool size for production stability
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Runs pending migrations programmatically.
 * Useful for automated startup migrations.
 */
export async function runMigrations(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is required to run migrations.');
  }

  // Resolve directory of migrations relative to compiled index.js
  const migrationsDir = path.join(__dirname, 'migrations');

  console.log(`[Database] Starting migrations from: ${migrationsDir}`);

  await migrationRunner({
    databaseUrl: dbUrl,
    dir: migrationsDir,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    verbose: true,
  });

  console.log('[Database] Migrations finished successfully.');
}
