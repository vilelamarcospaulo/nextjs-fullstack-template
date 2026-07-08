// Jobs use cases: orchestration between the HTTP/UI boundary (app/) or the
// worker process, and the queue (pg-boss via src/lib/queue.ts). No framework
// imports — mirrors use_case/profile.ts. Every import is relative with an
// explicit ".ts" extension so this file loads unmodified under both the Next
// bundler (app code importing it via "@/internal/use_case/jobs") and the
// worker process (run directly via `node src/worker/index.ts`, which relies
// on Node's native TS stripping and cannot resolve the "@/*" alias).
import {
  HELLO_QUEUE,
  parseHelloJobPayload,
  type HelloJobPayload,
} from "../domain/jobs.ts";
import { getQueue } from "../../lib/queue.ts";
import { logger } from "../../lib/logger.ts";

export type EnqueueHelloJobResult =
  | { ok: true; jobId: string }
  | { ok: false; errors: Partial<Record<"message", string>> };

// Validate raw input and enqueue it onto the hello queue. Returns the
// pg-boss job id on success. An optional idempotencyKey maps to pg-boss's
// singletonKey: sending the same key again while a prior job with that key is
// still pending/active is suppressed (send() resolves null), which this
// function surfaces as a clear {ok:false} result rather than a silent no-op.
export async function enqueueHelloJob(
  input: unknown,
  opts?: { idempotencyKey?: string },
): Promise<EnqueueHelloJobResult> {
  const parsed = parseHelloJobPayload(input);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const boss = await getQueue();
  const jobId = await boss.send(HELLO_QUEUE, parsed.value, {
    singletonKey: opts?.idempotencyKey,
  });

  if (!jobId) {
    return {
      ok: false,
      errors: { message: "duplicate job" },
    };
  }

  return { ok: true, jobId };
}

// The actual job body, called identically by the worker's `boss.work()`
// handler and by tests (no pg-boss Job wrapper, just the validated payload).
// Kept intentionally trivial — this is the extension point future real jobs
// (LLM calls, emails, etc.) will follow: validate/receive a typed payload,
// do the work, log start/completion. Business logic for a new job type plugs
// in here, not in the worker's dispatch loop.
export async function processHelloJob(payload: HelloJobPayload): Promise<void> {
  logger.info({ message: payload.message }, "hello_job_processing");

  // Simulated work standing in for a real async operation (LLM call, email
  // send, etc.). Short and bounded so the demo/tests stay fast.
  await new Promise((resolve) => setTimeout(resolve, 300));

  logger.info({ message: payload.message }, "hello_job_completed");
}
