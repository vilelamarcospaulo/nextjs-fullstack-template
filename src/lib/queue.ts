// Producer client for Cloudflare Queues.
//
// This is the "send" half only: it pushes messages onto the "hello" queue
// via the native HELLO_QUEUE producer binding declared in
// wrangler.app.jsonc — the same getCloudflareContext() pattern src/lib/db.ts
// uses for the HYPERDRIVE binding. The consumer half lives separately as a
// Cloudflare Worker (src/worker/, deployed independently via
// `wrangler deploy`) which does NOT import this file — it receives messages
// through its own native queue consumer binding, unrelated to this one.
//
// Unlike the pg-boss client this replaces, there is no persistent
// connection/client instance to construct or cache on globalThis: every
// `sendJob` call resolves the binding fresh from the current request's
// Cloudflare context.
//
// This file is imported both by Next.js app code (via the "@/lib/queue"
// alias, which the Next bundler resolves) and potentially other relative
// import contexts, so every import in THIS file is relative with an
// explicit ".ts" extension.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { JobEnvelope } from "../internal/domain/jobs.ts";

// Local-dev escape hatch: when set (e.g. in .env.local, pointed at
// `wrangler dev`'s default http://localhost:8787), sendJob POSTs here with a
// plain `fetch` instead of using the HELLO_QUEUE binding below. This exists
// because `next dev` and the consumer Worker's `wrangler dev` (see
// queue-worker:dev in package.json) run as two separate Miniflare processes
// with no shared queue state — there's no way for a binding resolved inside
// `next dev` to deliver a message to the consumer running in a different
// process. Routing through this HTTP bridge instead lets the whole
// producer/consumer loop run offline with no real Cloudflare account. The
// receiving end is src/worker/index.ts's fetch() handler, which mirrors the
// real push API's request/response shape (`{ body: <envelope> }` in,
// `{success: true}` out) and forwards onto its own local [[queues.producers]]
// binding that Miniflare simulates within that same process. Leave unset for
// production and for `opennextjs-cloudflare preview`/the "app-worker" Vitest
// project — both of those run inside a single Miniflare instance that
// resolves wrangler.app.jsonc's own HELLO_QUEUE binding directly, so
// sendJob falls through to the real path below.
//
// `payload`/`traceId` are the same two arguments the real path wraps into a
// JobEnvelope (see below) — this function does that wrapping itself since
// it bypasses the binding entirely.
async function sendJobToLocalPushUrl<T extends object>(
  localPushUrl: string,
  payload: T,
  traceId: string,
): Promise<void> {
  const envelope: JobEnvelope<T> = { payload, traceId };

  const response = await fetch(localPushUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: envelope }),
  });

  const responseText = await response.text();
  let parsedBody: { success?: boolean } | undefined;
  try {
    parsedBody = responseText
      ? (JSON.parse(responseText) as { success?: boolean })
      : undefined;
  } catch {
    // Non-JSON response body — fall through and report the raw text.
    parsedBody = undefined;
  }

  if (!response.ok || parsedBody?.success !== true) {
    throw new Error(
      `Failed to send job to local queue push endpoint (HTTP ${response.status} ${response.statusText}): ${responseText || "no response body"}`,
    );
  }
}

// The one way any use_case enqueues a job. Wraps `payload` in the same
// envelope shape the worker expects (see JobEnvelope in
// src/internal/domain/jobs.ts) and pushes it onto the hello queue via the
// HELLO_QUEUE producer binding (wrangler.app.jsonc), or its local-dev
// stand-in — see sendJobToLocalPushUrl above.
//
// `queueName` is accepted (and still passed by callers like
// enqueueHelloJob) for API shape / future-proofing, but is NOT used to
// address the queue — the binding above always addresses the "hello" queue.
// This is a known scope limitation of this single-queue demo: a real
// multi-queue setup would need a name -> binding lookup, which isn't built
// here since there's only one job type today.
export async function sendJob<T extends object>(
  queueName: string,
  payload: T,
  traceId: string,
): Promise<void> {
  void queueName;

  const localPushUrl = process.env.QUEUE_LOCAL_PUSH_URL;
  if (localPushUrl) {
    await sendJobToLocalPushUrl(localPushUrl, payload, traceId);
    return;
  }

  const envelope: JobEnvelope<T> = { payload, traceId };

  let context;
  try {
    context = getCloudflareContext();
  } catch {
    // No live Cloudflare context (e.g. a plain Node/Vitest process that
    // isn't running under `next dev`'s initOpenNextCloudflareForDev(),
    // `opennextjs-cloudflare preview`, or a deployed Worker) — fall through
    // to the "no binding" error below rather than letting this throw
    // propagate with a confusing message.
  }

  // `next dev` (via initOpenNextCloudflareForDev()) simulates HELLO_QUEUE
  // too, but that simulated queue has no consumer attached: it's an
  // isolated Miniflare instance separate from the actual consumer Worker's
  // own `wrangler dev` process (queue-worker:dev), so sending through it
  // here would silently "succeed" while the job is never processed.
  // env.NEXTJS_ENV is set to "development" only in that dev-proxy context
  // (confirmed empirically — unset under both a real deployment and
  // `opennextjs-cloudflare preview`), so route it to the same explicit error
  // developers got before this binding existed, rather than a silent no-op.
  if (context?.env.NEXTJS_ENV === "development") {
    throw new Error(
      "No queue transport configured for `next dev`. Set " +
        "QUEUE_LOCAL_PUSH_URL in .env.local (see .env.example) so sendJob " +
        "uses the local push bridge above instead of the HELLO_QUEUE " +
        "binding, which has no consumer attached under `next dev`.",
    );
  }

  const queue = context?.env.HELLO_QUEUE;
  if (!queue) {
    throw new Error(
      "No HELLO_QUEUE binding available. Deployed Workers and " +
        '`opennextjs-cloudflare preview` get it from the "queues.producers" ' +
        "entry in wrangler.app.jsonc — if this error is unexpected there, " +
        "check that binding is present.",
    );
  }

  await queue.send(envelope);
}
