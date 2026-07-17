import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/schema";
import { env } from "@/lib/env";

// Single Drizzle instance (over a pg Pool), cached on globalThis in dev so
// Next.js HMR doesn't spawn a new pool (and a new set of connections) on
// every reload. Mirrors the pattern formerly used for the Prisma client.
const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

function createDb() {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  return drizzle({ client: pool, schema });
}

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
