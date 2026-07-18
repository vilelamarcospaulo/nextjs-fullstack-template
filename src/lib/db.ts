import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@/lib/schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

// Hyperdrive-first, DATABASE_URL-fallback: a deployed Worker gets its
// connection string from the "HYPERDRIVE" binding (wrangler.app.jsonc);
// everything else (next dev/opennextjs-cloudflare preview without a live
// Cloudflare context, Docker/`next start`, Vitest, drizzle-kit) falls back to
// a direct DATABASE_URL read, mirroring the existing convention already used
// by drizzle.config.ts / drizzle/seed.ts.
function resolveConnectionString(): string {
  try {
    const { env } = getCloudflareContext();
    if (env.HYPERDRIVE?.connectionString) {
      return env.HYPERDRIVE.connectionString;
    }
  } catch {
    // No Cloudflare request context available — fall through to DATABASE_URL.
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "No database connection available: neither the HYPERDRIVE binding nor DATABASE_URL is set.",
    );
  }
  return databaseUrl;
}

// Builds a fresh client on every call — deliberately not cached on
// globalThis. A Workers TCP socket (which a pg.Pool holds open) is only
// valid for the request that opened it; caching the pool across requests in
// the same isolate causes later, unrelated requests to reuse a torn-down
// socket ("Network connection lost", or the runtime silently hanging until
// its watchdog cancels the request). Hyperdrive already keeps the expensive
// database-side connections warm, so paying for a new local Pool object per
// call is cheap — see Cloudflare's own Hyperdrive + node-postgres examples,
// which follow the same per-request-client pattern.
//
// Request-scoped accessor — call from within a Route Handler, Server Action,
// or Server Component render; never store its result at module top level
// (that's exactly the pattern this replaces — see the git history of this
// file for the old `export const db` singleton it used to be).
export function getDb(): DrizzleDb {
  const pool = new Pool({ connectionString: resolveConnectionString() });
  return drizzle({ client: pool, schema });
}
