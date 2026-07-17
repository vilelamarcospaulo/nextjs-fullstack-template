import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";

// Vitest global setup (runs once, in the main process). Provisions a throwaway
// Postgres database for the integration tests: a fresh `app_test` database
// with all Drizzle migrations applied.
//
// Workers receive DATABASE_URL via `test.env` in vitest.config.ts so the Drizzle
// client they construct points at this same database. Keep the two URLs in sync.
const TEST_DB_NAME = "app_test";
const MAINTENANCE_DB_URL =
  "postgresql://postgres:postgres@localhost:5432/postgres";
const TEST_DB_URL = `postgresql://postgres:postgres@localhost:5432/${TEST_DB_NAME}`;

async function recreateDatabase() {
  // Connect to the `postgres` maintenance database — you can't drop/create the
  // database you're currently connected to.
  const client = new Client({ connectionString: MAINTENANCE_DB_URL });
  await client.connect();
  try {
    // Terminate any lingering connections (e.g. from a previous interrupted
    // run) so DROP DATABASE doesn't fail with "database is being accessed".
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [TEST_DB_NAME],
    );
    await client.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
    await client.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  } finally {
    await client.end();
  }
}

export default async function setup() {
  // Start from a clean slate so the migrator recreates the full schema.
  await recreateDatabase();

  const pool = new Pool({ connectionString: TEST_DB_URL });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "drizzle/migrations" });
  } catch (err: unknown) {
    throw new Error(
      `drizzle migrate failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    await pool.end();
  }

  // No teardown: setup always drops and recreates `app_test` at the start of
  // the next run, so leaving the database in place here is simpler and lets
  // it double as a scratch DB for local inspection between runs.
}
