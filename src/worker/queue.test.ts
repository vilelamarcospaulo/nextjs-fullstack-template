// Integration test for the worker's job processing round-trip, run under
// vitest's "integration" project against the real throwaway `app_test`
// Postgres (see test/global-setup.ts + vitest.config.ts). This file itself
// runs under vitest (not plain `node`), so — unlike everything under
// src/worker/ that's reachable from src/worker/index.ts's runtime import
// graph — it's free to use the "@/*" alias like the rest of the test suite.
import { getQueue, workJob } from "@/lib/queue";
import { enqueueHelloJob, processHelloJob } from "@/internal/use_case/jobs";
import { HELLO_QUEUE, type HelloJobPayload } from "@/internal/domain/jobs";

describe("worker queue integration", () => {
  test("an enqueued hello job is picked up and completes", async () => {
    const boss = await getQueue();

    const enqueued = await enqueueHelloJob({
      message: "integration test hello",
    });
    expect(enqueued.ok).toBe(true);
    if (!enqueued.ok) {
      return;
    }
    expect(enqueued.traceId).toBeTruthy();

    // Mirrors the worker's own dispatch loop (src/worker/index.ts) at a
    // smaller scale: subscribe via workJob (so the envelope is unwrapped the
    // same way production does), process the one job we just enqueued, and
    // resolve a promise from inside the handler instead of sleep-based
    // polling. `pollingIntervalSeconds` is dropped to pg-boss's minimum
    // (0.5s) so the test doesn't wait on the 2s default idle poll.
    let seenTraceId: string | undefined;
    const completed = await new Promise<boolean>((resolve, reject) => {
      workJob<HelloJobPayload>(
        HELLO_QUEUE,
        { batchSize: 1, pollingIntervalSeconds: 0.5 },
        async (payload, ctx) => {
          if (ctx.jobId !== enqueued.jobId) {
            // Ignore unrelated jobs that might be on this shared queue (e.g.
            // left over from another test in this project). Not completing
            // them here is fine — they either belong to another test's own
            // subscription or stay queued.
            return;
          }
          seenTraceId = ctx.traceId;
          await processHelloJob(payload, ctx);
          resolve(true);
        },
      ).catch(reject);
    });

    expect(completed).toBe(true);
    expect(seenTraceId).toBe(enqueued.traceId);

    await boss.offWork(HELLO_QUEUE);
  }, 15_000);

  test("a job's traceId propagates to a follow-up job it enqueues (Message A -> Message B)", async () => {
    const boss = await getQueue();

    const jobA = await enqueueHelloJob({ message: "message A" });
    expect(jobA.ok).toBe(true);
    if (!jobA.ok) {
      return;
    }

    // Process job A; from inside its handler, enqueue job B reusing job A's
    // traceId (exactly the pattern documented on processHelloJob/
    // enqueueHelloJob). workJob's handler receives job B's traceId directly
    // once it's picked up — no need to re-fetch the job to inspect it.
    const FOLLOWUP_MESSAGE = "message B, caused by A";
    let jobBTraceId: string | undefined;
    const jobBSeen = new Promise<void>((resolve, reject) => {
      workJob<HelloJobPayload>(
        HELLO_QUEUE,
        { batchSize: 1, pollingIntervalSeconds: 0.5 },
        async (payload, ctx) => {
          if (ctx.jobId === jobA.jobId) {
            await processHelloJob(payload, ctx);
            const jobB = await enqueueHelloJob(
              { message: FOLLOWUP_MESSAGE },
              { traceId: ctx.traceId },
            );
            if (!jobB.ok) {
              reject(new Error("failed to enqueue job B"));
            }
            return;
          }

          if (payload.message === FOLLOWUP_MESSAGE) {
            jobBTraceId = ctx.traceId;
            resolve();
          }
        },
      ).catch(reject);
    });

    await jobBSeen;

    expect(jobBTraceId).toBe(jobA.traceId);

    await boss.offWork(HELLO_QUEUE);
  }, 15_000);

  test("a job whose handler throws exhausts retries and lands on the dead-letter queue", async () => {
    const boss = await getQueue();

    // Throwaway, test-only queue pair (NOT the production hello/hello-dlq
    // pair configured in src/lib/queue.ts) with a short retryLimit and no
    // backoff delay, so exhausting retries is fast and deterministic instead
    // of waiting through the production queue's 5-retry exponential backoff.
    const TEST_QUEUE = "test-hello-fail";
    const TEST_DLQ = "test-hello-fail-dlq";

    await boss.createQueue(TEST_DLQ, { retryLimit: 0 });
    await boss.createQueue(TEST_QUEUE, {
      retryLimit: 1,
      retryDelay: 0,
      retryBackoff: false,
      deadLetter: TEST_DLQ,
    });

    const jobId = await boss.send(TEST_QUEUE, { message: "boom" });
    expect(jobId).toBeTruthy();

    // Always-throwing handler drives the queue's retry/dead-letter behavior,
    // matching how the worker re-throws from a failed processHelloJob call.
    await boss.work(
      TEST_QUEUE,
      { batchSize: 1, pollingIntervalSeconds: 0.5 },
      async () => {
        throw new Error("simulated job failure");
      },
    );

    const deadLettered = await new Promise<boolean>((resolve, reject) => {
      boss
        .work<{ message: string }>(
          TEST_DLQ,
          { batchSize: 1, pollingIntervalSeconds: 0.5 },
          async (jobs) => {
            for (const job of jobs) {
              if (job.data.message === "boom") {
                resolve(true);
              }
            }
          },
        )
        .catch(reject);
    });

    expect(deadLettered).toBe(true);

    await boss.offWork(TEST_QUEUE);
    await boss.offWork(TEST_DLQ);
  }, 20_000);
});
