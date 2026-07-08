import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

// Single PrismaClient instance, cached on globalThis in dev so Next.js HMR
// doesn't spawn a new client (and a new connection) on every reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7 requires a driver adapter (the datasource URL is no longer read
// from the schema). @prisma/adapter-pg pools connections to Postgres via `pg`.
//
// DATABASE_URL is sourced from the validated env module — no silent fallback.
const adapter = new PrismaPg(env.DATABASE_URL);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
