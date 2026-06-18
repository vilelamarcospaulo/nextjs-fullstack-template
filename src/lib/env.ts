// Validated environment module.
//
// Reads required vars at import time and throws a single descriptive error if
// any are absent, so the app fails fast at startup rather than with a cryptic
// runtime error deep in a request handler.
//
// Usage:
//   import { env } from "@/lib/env";
//   env.DATABASE_URL  // typed string, guaranteed non-empty

const REQUIRED_VARS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

type EnvVarName = (typeof REQUIRED_VARS)[number];

function loadEnv(): Record<EnvVarName, string> {
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

export const env = loadEnv();
