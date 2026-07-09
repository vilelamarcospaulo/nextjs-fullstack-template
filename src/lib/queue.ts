// pg-boss client singleton.
//
// Mirrors the caching pattern in src/lib/prisma.ts (globalThis-cached
// instance, dev-HMR-safe), but async: pg-boss needs `.start()` (which runs
// its internal migrations) before it can be used, so this module exposes
// `getQueue(): Promise<PgBoss>` instead of a plain exported value.
//
// Deliberately does NOT import src/lib/env.ts — that module hard-requires
// Better Auth / Google OAuth vars that a standalone worker container will
// never have set. DATABASE_URL is read directly from process.env instead,
// matching the style already used in prisma/seed.ts.
//
// This file is imported both by Next.js app code (via the "@/lib/queue"
// alias, which the Next bundler resolves) and by the worker process (via a
// relative import, since the worker runs with `node src/worker/index.ts`
// using Node's native TypeScript stripping — no bundler, no path-alias
// resolution). That's why every import in THIS file is relative with an
// explicit ".ts" extension.
import { PgBoss } from "pg-boss";
import type { Job, SendOptions, WorkOptions } from "pg-boss";
import type { Logger } from "pino";
import { HELLO_DLQ, HELLO_QUEUE } from "../internal/domain/jobs.ts";
import { logger } from "./logger.ts";

const RETRY_LIMIT = 5;
// Base delay (seconds) for the hello queue's exponential backoff. pg-boss
// computes actual delay as ~retryDelay * 2^retryCount (with jitter), capped
// at retryDelayMax.
const RETRY_DELAY_SECONDS = 1;
const RETRY_DELAY_MAX_SECONDS = 60;

// Caches on globalThis (not a plain module-level variable) for the same
// reason src/lib/prisma.ts does: in dev, Next.js HMR re-evaluates modules on
// every reload, which would otherwise spawn a new PgBoss instance (and a new
// DB connection/maintenance loop) per reload. Also caches the in-flight
// start/init PROMISE (not just the resolved instance) so concurrent
// first-callers await the same startup instead of racing to construct two
// instances.
const globalForQueue = globalThis as unknown as {
  pgBoss: PgBoss | undefined;
  pgBossInit: Promise<PgBoss> | undefined;
};

function readDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in " +
        '(e.g. DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app").',
    );
  }
  return databaseUrl;
}

async function initQueue(): Promise<PgBoss> {
  const boss = new PgBoss(readDatabaseUrl());

  boss.on("error", (error) => {
    logger.error({ err: error }, "pg_boss_error");
  });

  await boss.start();

  // createQueue is idempotent in pg-boss (safe to call every time a process
  // starts, from both the app and the worker) so this doubles as the queue's
  // declaration/migration step — no separate provisioning script needed.
  //
  // Terminal dead-letter queue first: no retry, this is where jobs land once
  // hello's own retries are exhausted.
  await boss.createQueue(HELLO_DLQ, { retryLimit: 0 });

  await boss.createQueue(HELLO_QUEUE, {
    retryLimit: RETRY_LIMIT,
    retryBackoff: true,
    retryDelay: RETRY_DELAY_SECONDS,
    retryDelayMax: RETRY_DELAY_MAX_SECONDS,
    deadLetter: HELLO_DLQ,
  });

  return boss;
}

// Returns the shared, started PgBoss instance, lazily constructing it (and
// ensuring the hello/hello-dlq queues exist) on first call.
export async function getQueue(): Promise<PgBoss> {
  if (globalForQueue.pgBoss) {
    return globalForQueue.pgBoss;
  }

  if (!globalForQueue.pgBossInit) {
    globalForQueue.pgBossInit = initQueue()
      .then((boss) => {
        globalForQueue.pgBoss = boss;
        return boss;
      })
      .catch((error) => {
        // Startup failed — clear the in-flight promise so a later call can
        // retry instead of forever resolving to the same rejection.
        globalForQueue.pgBossInit = undefined;
        throw error;
      });
  }

  return globalForQueue.pgBossInit;
}

// Every job is sent/received wrapped in this envelope so a traceId travels
// with it automatically — no job type has to remember to thread it through
// its own payload schema. See src/lib/trace.ts for what traceId means.
export type JobEnvelope<T> = {
  payload: T;
  traceId: string;
};

// The one way any use_case enqueues a job. Wraps `payload` in the envelope
// and delegates to pg-boss's own `send`.
export async function sendJob<T extends object>(
  queueName: string,
  payload: T,
  traceId: string,
  options?: SendOptions,
): Promise<string | null> {
  const boss = await getQueue();
  const envelope: JobEnvelope<T> = { payload, traceId };
  return boss.send(queueName, envelope, options);
}

// The one way the worker subscribes to a queue. Unwraps the envelope, binds
// a pino child logger to `traceId`/`jobId`/`queue` (so every log line the
// handler emits via `ctx.log` carries them without repeating them), and logs
// job_started/job_completed/job_failed around the handler call. On a thrown
// error, logs job_failed and RE-THROWS — pg-boss's `.work()` handler must
// reject for the job to be marked failed and retried (or dead-lettered once
// retries are exhausted, per the retry/backoff/deadLetter config in
// initQueue above). This centralizes logging that used to live inline in
// src/worker/index.ts, so future job types don't have to re-implement it.
export async function workJob<T>(
  queueName: string,
  options: WorkOptions,
  handler: (
    payload: T,
    ctx: { traceId: string; jobId: string; log: Logger },
  ) => Promise<void>,
): Promise<string> {
  const boss = await getQueue();
  return boss.work<JobEnvelope<T>>(
    queueName,
    options,
    async (jobs: Job<JobEnvelope<T>>[]) => {
      for (const job of jobs) {
        const { payload, traceId } = job.data;
        const log = logger.child({ traceId, jobId: job.id, queue: queueName });

        log.info({}, "job_started");
        try {
          await handler(payload, { traceId, jobId: job.id, log });
          log.info({}, "job_completed");
        } catch (error) {
          log.error({ err: error }, "job_failed");
          throw error;
        }
      }
    },
  );
}
