// Validated environment module.
//
// getEnv() validates required vars and throws a single descriptive error if
// any are absent. It's a function, not a module-load-time singleton, because
// under Cloudflare Workers (see src/lib/db.ts, wrangler.app.jsonc) bindings
// and vars are only populated per-request — a top-level `export const env =
// loadEnv()` would run at Worker cold start, before any request's vars exist,
// and crash unpredictably. Calling getEnv() from request-scoped code (a
// Route Handler, Server Action, or Server Component render) is safe in every
// environment this app runs in (Node/Docker, Vitest, and Workers), since
// OpenNext's runtime copies string-valued vars/bindings into `process.env`
// before request handling begins.
//
// DATABASE_URL is deliberately NOT in REQUIRED_VARS: in a deployed Workers
// environment it's not set at all (Hyperdrive supersedes it — see
// src/lib/db.ts's getDb()), and this module has no way to know which
// environment it's running in. src/lib/db.ts reads DATABASE_URL directly,
// narrowly, only on its Node/Docker/Vitest fallback path.
//
// Usage:
//   import { getEnv } from "@/lib/env";
//   getEnv().DATABASE_URL  // typed string, guaranteed non-empty
//   (call once per function and reuse the result, rather than calling
//   getEnv() repeatedly, to avoid redundant validation passes)

const REQUIRED_VARS = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

type EnvVarName = (typeof REQUIRED_VARS)[number];

export function getEnv(): Record<EnvVarName, string> {
  const missing: EnvVarName[] = [];

  for (const key of REQUIRED_VARS) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      [
        "Missing required environment variables:",
        ...missing.map((k) => `  - ${k}`),
        "",
        "Copy .env.example to .env / .env.local and fill in all values.",
      ].join("\n"),
    );
  }

  // Non-null assertion is safe: we verified all are present in the loop above.
  return Object.fromEntries(
    REQUIRED_VARS.map((k) => [k, process.env[k]!]),
  ) as Record<EnvVarName, string>;
}
