import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

// Single PrismaClient instance, cached on globalThis in dev so Next.js HMR
// doesn't spawn a new client (and a new connection) on every reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7 requires a driver adapter (the datasource URL is no longer read
// from the schema). better-sqlite3 backs the local SQLite file.
//
// DATABASE_URL is sourced from the validated env module — no silent fallback.
const adapter = new PrismaBetterSqlite3({
  url: env.DATABASE_URL,
});

// ── Alternative: Postgres via @prisma/adapter-pg ─────────────────────────────
// Switching from SQLite to Postgres requires both a new adapter AND schema /
// migration changes (update the provider in prisma/schema.prisma and regenerate
// the client — see README for the full data-layer checklist).
//
// import { PgAdapter } from "@prisma/adapter-pg";
// import pg from "pg";
// const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
// const adapter = new PgAdapter(pool);
// ─────────────────────────────────────────────────────────────────────────────

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
