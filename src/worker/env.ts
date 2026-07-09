// Worker-specific env validation.
//
// Deliberately separate from src/lib/env.ts, which hard-requires Better
// Auth / Google OAuth vars that a standalone worker container will never
// have set. DATABASE_URL itself is NOT re-validated here — src/lib/queue.ts
// (via getQueue()) already reads it directly from process.env and throws a
// descriptive error if it's missing, matching the style in prisma/seed.ts.
// This module's only job is the worker's own optional tuning knobs.
//
// Imported by src/worker/index.ts via a relative path (the worker runs with
// `node src/worker/index.ts`, Node's native TS stripping, no bundler, no
// "@/*" alias resolution) so every import in this file must stay relative
// with an explicit ".ts" extension. This file has no imports of its own, but
// keep that convention in mind if it ever gains one.

const DEFAULT_WORKER_CONCURRENCY = 5;
const DEFAULT_WORKER_HEALTH_PORT = 3100;

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  varName: string,
): number {
  if (raw === undefined) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `${varName} is set to "${raw}", which is not a positive integer. ` +
        `Unset it to use the default (${fallback}) or provide a valid value.`,
    );
  }

  return parsed;
}

export interface WorkerEnv {
  WORKER_CONCURRENCY: number;
  WORKER_HEALTH_PORT: number;
}

// Reads and validates the worker's optional tuning env vars. Called once at
// startup (see src/worker/index.ts) so a misconfigured value fails fast with
// a clear error instead of surfacing as confusing behavior later.
export function loadWorkerEnv(): WorkerEnv {
  return {
    WORKER_CONCURRENCY: parsePositiveInt(
      process.env.WORKER_CONCURRENCY,
      DEFAULT_WORKER_CONCURRENCY,
      "WORKER_CONCURRENCY",
    ),
    WORKER_HEALTH_PORT: parsePositiveInt(
      process.env.WORKER_HEALTH_PORT,
      DEFAULT_WORKER_HEALTH_PORT,
      "WORKER_HEALTH_PORT",
    ),
  };
}
