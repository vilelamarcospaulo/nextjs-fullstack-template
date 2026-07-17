// Jobs use cases: orchestration between the HTTP/UI boundary (app/) or the
// worker process, and the queue (Cloudflare Queues via src/lib/queue.ts for
// the producer side). No framework imports — mirrors use_case/profile.ts.
// Every import is relative with an explicit ".ts" extension so this file
// loads unmodified under both the Next bundler (app code importing it via
// "@/internal/use_case/jobs") and the Cloudflare Worker consumer under
// src/worker/ (wrangler-bundled, which does not resolve the "@/*" alias).
import {
  HELLO_QUEUE,
  parseHelloJobPayload,
  type HelloJobPayload,
} from "../domain/jobs.ts";
import { sendJob } from "../../lib/queue.ts";
import { newTraceId } from "../../lib/trace.ts";

export type EnqueueHelloJobResult =
  | { ok: true; traceId: string }
  | { ok: false; errors: Partial<Record<"message", string>> };

// Validate raw input and enqueue it onto the hello queue. Returns the
// traceId it was sent with on success — Cloudflare Queues' HTTP push API
// doesn't hand back a message id, so traceId is the only correlation id
// callers get (and the only one they need: every log line the job produces,
// in both the app and the worker, is keyed on it).
//
// `opts.traceId`: pass this when enqueueing from inside a job handler that's
// itself already part of a chain (e.g. `ctx.traceId` from the worker's queue
// handler), so the whole chain shares one id. Omit it when this is the root
// of a new chain (e.g. a fresh HTTP request) — a new traceId is generated
// automatically.
export async function enqueueHelloJob(
  input: unknown,
  opts?: { traceId?: string },
): Promise<EnqueueHelloJobResult> {
  const parsed = parseHelloJobPayload(input);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const traceId = opts?.traceId ?? newTraceId();
  await sendJob(HELLO_QUEUE, parsed.value, traceId);

  return { ok: true, traceId };
}

// Minimal structural logger interface — deliberately not pino's own `Logger`
// type (which pulls in a large surface this function doesn't need). Pino's
// child logger satisfies this shape already (used by the Next app side), and
// so does the Cloudflare Worker consumer's lightweight console-based logger
// (src/worker/logger.ts), which isn't pino at all — pino isn't reliably
// supported in the Workers runtime.
type JobLog = {
  info: (fields: Record<string, unknown>, msg: string) => void;
};

// The actual job body, called identically by the worker's queue handler
// (src/worker/index.ts) and by tests. `ctx.log` is a logger already bound to
// this job's traceId/jobId — use it instead of a bare logger so every line
// stays correlated. Kept intentionally trivial — this is the extension point
// future real jobs (LLM calls, emails, etc.) will follow: validate/receive a
// typed payload, do the work, log start/completion. Business logic for a new
// job type plugs in here, not in the worker's dispatch loop.
//
// If a job needs to enqueue a follow-up job (Message A -> Message B), pass
// `ctx.traceId` straight through as `enqueueHelloJob`'s `opts.traceId` so
// the follow-up stays part of the same chain.
export async function processHelloJob(
  payload: HelloJobPayload,
  ctx: { traceId: string; jobId: string; log: JobLog },
): Promise<void> {
  ctx.log.info({ message: payload.message }, "hello_job_processing");

  // Simulated work standing in for a real async operation (LLM call, email
  // send, etc.). Short and bounded so the demo/tests stay fast.
  await new Promise((resolve) => setTimeout(resolve, 300));

  ctx.log.info({ message: payload.message }, "hello_job_completed");
}
