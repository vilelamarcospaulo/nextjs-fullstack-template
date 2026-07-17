// Cloudflare Worker that consumes the "hello" and "hello-dlq" queues,
// replacing the old Node pg-boss worker process (see git history for the
// previous `node src/worker/index.ts` long-running-process version). Wired
// up via the [[queues.consumers]] entries in wrangler.toml at the repo root.
//
// Ack/retry semantics are per-message, not per-batch: each message is
// ack()'d on success or retry()'d on failure individually, and a failure is
// caught and logged rather than rethrown across the whole batch — so one bad
// message doesn't block or force a retry of its batch-mates.
//
// OpenTelemetry / distributed tracing is out of scope here: doing it
// properly would need a third-party Workers OTel shim, which isn't a current
// dependency. `traceId` still flows through the envelope and every log line
// below, though, so grep-based correlation across the Next app and this
// Worker keeps working — just without span-level tracing.
//
// Imports stay relative with explicit ".ts" extensions, same convention the
// old Node worker used (previously justified by "runs via plain node, no
// bundler, no path-alias resolution"; now justified by "wrangler's esbuild
// bundling doesn't resolve the '@/*' path alias out of the box" — same
// practical outcome, different reason).
import type {
  ExecutionContext,
  MessageBatch,
  Queue,
} from "@cloudflare/workers-types";
import {
  HELLO_DLQ,
  HELLO_QUEUE,
  type HelloJobPayload,
  type JobEnvelope,
} from "../internal/domain/jobs.ts";
import { processHelloJob } from "../internal/use_case/jobs.ts";
import { createJobLogger } from "./logger.ts";

type Env = {
  // Producer binding onto the same "hello" queue this Worker also consumes
  // (see [[queues.producers]] in wrangler.toml). In production this binding
  // is never actually exercised — src/lib/queue.ts pushes via Cloudflare's
  // real HTTP API instead, bypassing this Worker entirely. It exists so
  // fetch() below can simulate that HTTP push locally through Miniflare.
  HELLO_QUEUE: Queue<JobEnvelope<HelloJobPayload>>;
  // Only ever set locally via the gitignored .dev.vars (see
  // .dev.vars.example) — `wrangler deploy` doesn't read .dev.vars, so this
  // is always undefined in a real deployment, keeping fetch() a 404 there.
  LOCAL_DEV_PUSH_ENABLED?: string;
};

const worker = {
  // Local-dev-only stand-in for Cloudflare's real "push message" HTTP API
  // (POST /accounts/{id}/queues/{id}/messages), so src/lib/queue.ts can be
  // pointed at this Worker instead of the real Cloudflare API when
  // QUEUE_LOCAL_PUSH_URL is set — letting the whole producer/consumer loop
  // run offline under `wrangler dev` with no Cloudflare account. Mirrors the
  // real API's request/response shape (`{ body: <envelope> }` in, `{success:
  // true}` out) so src/lib/queue.ts doesn't need separate parsing logic per
  // target. Gated behind LOCAL_DEV_PUSH_ENABLED (see the Env type above) —
  // without it, this always 404s, including in any real deployment.
  async fetch(request: Request, env: Env): Promise<Response> {
    if (env.LOCAL_DEV_PUSH_ENABLED !== "true") {
      return new Response("Not Found", { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const { body } = (await request.json()) as {
      body: JobEnvelope<HelloJobPayload>;
    };
    await env.HELLO_QUEUE.send(body);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  },

  async queue(
    batch: MessageBatch<JobEnvelope<HelloJobPayload>>,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    // Neither binding is used today — no producer binding (see above) and no
    // waitUntil()-scheduled work in this handler — but both stay in the
    // signature so it keeps matching Cloudflare's queue() handler shape (and
    // what the test file's direct call passes) rather than relying on TS's
    // fewer-params structural typing, which callers other than "cloudflare:test"'s
    // simulated invocation wouldn't get.
    void env;
    void ctx;

    if (batch.queue === HELLO_QUEUE) {
      for (const message of batch.messages) {
        const { payload, traceId } = message.body;
        const log = createJobLogger({
          traceId,
          jobId: message.id,
          queue: batch.queue,
        });

        log.info({}, "job_started");
        try {
          await processHelloJob(payload, { traceId, jobId: message.id, log });
          log.info({}, "job_completed");
          message.ack();
        } catch (error) {
          log.error(
            { err: error instanceof Error ? error.message : String(error) },
            "job_failed",
          );
          message.retry();
        }
      }
      return;
    }

    if (batch.queue === HELLO_DLQ) {
      // Pure visibility into terminally-failed jobs — no re-processing /
      // re-drive logic here, matching the old worker's DLQ subscription.
      // Re-driving dead-lettered jobs is an intentional scope boundary for
      // this scaffold.
      for (const message of batch.messages) {
        const { payload, traceId } = message.body;
        const log = createJobLogger({
          traceId,
          jobId: message.id,
          queue: batch.queue,
        });

        log.error({ payload }, "job_dead_lettered");
        message.ack();
      }
      return;
    }
  },
};

export default worker;
