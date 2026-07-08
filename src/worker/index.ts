// Worker process entry point. Run via `node src/worker/index.ts` (Node's
// native TypeScript stripping — no bundler, no path-alias resolution), so
// every import in this file, and in every file it imports, must be relative
// with an explicit ".ts" extension. See src/lib/queue.ts for the same
// convention, and CLAUDE.md / the plan doc for why.

// OpenTelemetry must be started before anything that touches pino/Prisma at
// require time (its instrumentations patch those modules' internals when
// THEY are first required, not when the SDK is started). This mirrors the
// exact gating in src/instrumentation.ts: only start the Node SDK when an
// OTLP endpoint is configured, and do it as the very first thing, before the
// static imports below are evaluated.
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  await import("../instrumentation.node.ts");
}

import { loadWorkerEnv } from "./env.ts";
import { startHealthServer } from "./health-server.ts";
import { getQueue } from "../lib/queue.ts";
import { HELLO_DLQ, HELLO_QUEUE } from "../internal/domain/jobs.ts";
import { processHelloJob } from "../internal/use_case/jobs.ts";
import { logger } from "../lib/logger.ts";
import type { HelloJobPayload } from "../internal/domain/jobs.ts";

async function main() {
  const env = loadWorkerEnv();
  const boss = await getQueue();

  let ready = false;

  await boss.work(
    HELLO_QUEUE,
    { batchSize: env.WORKER_CONCURRENCY },
    async (jobs) => {
      for (const job of jobs) {
        logger.info({ jobId: job.id }, "job_started");
        try {
          await processHelloJob(job.data as HelloJobPayload);
          logger.info({ jobId: job.id }, "job_completed");
        } catch (error) {
          logger.error({ jobId: job.id, err: error }, "job_failed");
          // Re-throw: pg-boss's .work() handler must reject for the job to
          // be marked failed and retried (or dead-lettered once retries are
          // exhausted, per the retry/backoff/deadLetter config already
          // established in src/lib/queue.ts's createQueue calls). Swallowing
          // this would silently mark the job complete.
          throw error;
        }
      }
    },
  );

  // Pure visibility into terminally-failed jobs — no re-processing / re-drive
  // logic here. Re-driving dead-lettered jobs is an intentional scope
  // boundary for this scaffold; a future feature can add an operator-facing
  // re-drive flow on top of pg-boss's `redrive()` API.
  await boss.work(HELLO_DLQ, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      logger.error({ jobId: job.id, data: job.data }, "job_dead_lettered");
    }
  });

  ready = true;

  const healthServer = startHealthServer(env.WORKER_HEALTH_PORT, () => ready);

  logger.info({}, "worker_started");

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info({ signal }, "worker_shutting_down");
    ready = false;

    await boss.stop({ graceful: true });
    healthServer.close();

    // Deliberately no process.exit() call here: once .stop({ graceful: true
    // }) resolves and the health server is closed, there is nothing left
    // holding the event loop open, so Node exits naturally. Calling
    // process.exit() would risk cutting off any in-flight async work (e.g.
    // OTel's own SIGTERM/SIGINT flush handler registered in
    // instrumentation.node.ts) that hasn't finished yet.
  };

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }
}

main().catch((error) => {
  logger.error({ err: error }, "worker_startup_failed");
  process.exit(1);
});
