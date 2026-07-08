// Jobs use cases: orchestration between the HTTP/UI boundary (app/) or the
// worker process, and the queue (pg-boss via src/lib/queue.ts). No framework
// imports — mirrors use_case/profile.ts. Every import is relative with an
// explicit ".ts" extension so this file loads unmodified under both the Next
// bundler (app code importing it via "@/internal/use_case/jobs") and the
// worker process (run directly via `node src/worker/index.ts`, which relies
// on Node's native TS stripping and cannot resolve the "@/*" alias).
import type { Logger } from "pino";
import {
  HELLO_QUEUE,
  parseHelloJobPayload,
  type HelloJobPayload,
} from "../domain/jobs.ts";
import { sendJob } from "../../lib/queue.ts";
import { newTraceId } from "../../lib/trace.ts";

export type EnqueueHelloJobResult =
  | { ok: true; jobId: string; traceId: string }
  | { ok: false; errors: Partial<Record<"message", string>> };

// Validate raw input and enqueue it onto the hello queue. Returns the
// pg-boss job id (plus the traceId it was sent with) on success. An optional
// idempotencyKey maps to pg-boss's singletonKey: sending the same key again
// while a prior job with that key is still pending/active is suppressed
// (send() resolves null), which this function surfaces as a clear
// {ok:false} result rather than a silent no-op.
//
// `opts.traceId`: pass this when enqueueing from inside a job handler that's
// itself already part of a chain (e.g. `ctx.traceId` from `workJob`), so the
// whole chain shares one id. Omit it when this is the root of a new chain
// (e.g. a fresh HTTP request) — a new traceId is generated automatically.
export async function enqueueHelloJob(
  input: unknown,
  opts?: { idempotencyKey?: string; traceId?: string },
): Promise<EnqueueHelloJobResult> {
  const parsed = parseHelloJobPayload(input);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const traceId = opts?.traceId ?? newTraceId();
  const jobId = await sendJob(HELLO_QUEUE, parsed.value, traceId, {
    singletonKey: opts?.idempotencyKey,
  });

  if (!jobId) {
    return {
      ok: false,
      errors: { message: "duplicate job" },
    };
  }

  return { ok: true, jobId, traceId };
}

// The actual job body, called identically by the worker's `workJob()`
// dispatch (src/lib/queue.ts) and by tests. `ctx.log` is a pino child logger
// already bound to this job's traceId/jobId — use it instead of the base
// logger so every line stays correlated. Kept intentionally trivial — this
// is the extension point future real jobs (LLM calls, emails, etc.) will
// follow: validate/receive a typed payload, do the work, log
// start/completion. Business logic for a new job type plugs in here, not in
// the worker's dispatch loop.
//
// If a job needs to enqueue a follow-up job (Message A -> Message B), pass
// `ctx.traceId` straight through as `enqueueHelloJob`'s `opts.traceId` so
// the follow-up stays part of the same chain.
export async function processHelloJob(
  payload: HelloJobPayload,
  ctx: { traceId: string; jobId: string; log: Logger },
): Promise<void> {
  ctx.log.info({ message: payload.message }, "hello_job_processing");

  // Simulated work standing in for a real async operation (LLM call, email
  // send, etc.). Short and bounded so the demo/tests stay fast.
  await new Promise((resolve) => setTimeout(resolve, 300));

  ctx.log.info({ message: payload.message }, "hello_job_completed");
}
