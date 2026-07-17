// Producer client for Cloudflare Queues.
//
// This is the "send" half only: it pushes messages onto a Cloudflare Queue
// via the official `cloudflare` SDK (https://github.com/cloudflare/cloudflare-typescript,
// zero runtime dependencies of its own). The consumer half lives separately
// as a Cloudflare Worker (src/worker/, deployed independently via
// `wrangler deploy`) which does NOT import this file — it receives messages
// through Cloudflare's native queue consumer binding, not HTTP.
//
// `cloudflare` is listed in next.config.ts's serverExternalPackages (it's a
// large, Node-oriented package — no reason to make Next's bundler trace
// through it) — see the comment there.
//
// Unlike the pg-boss client this replaces, there is no persistent
// connection/client instance to construct or cache on globalThis: every
// `sendJob` call constructs a lightweight SDK client and makes one
// independent HTTP request, so there's nothing analogous to pg-boss's
// `.start()` or src/lib/db.ts's pooled connection.
//
// Deliberately does NOT import src/lib/env.ts — that module hard-requires
// Better Auth / Google OAuth vars that a standalone worker/producer context
// will never have set. The Cloudflare vars below are read directly from
// process.env instead, matching the style already used in drizzle/seed.ts.
//
// This file is imported both by Next.js app code (via the "@/lib/queue"
// alias, which the Next bundler resolves) and potentially other relative
// import contexts, so every import in THIS file is relative with an
// explicit ".ts" extension.
import Cloudflare from "cloudflare";
import type { JobEnvelope } from "../internal/domain/jobs.ts";

function readCloudflareAccountId(): string {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID is not set. Copy .env.example to .env and " +
        "fill it in with your Cloudflare account id (found on the " +
        'Cloudflare dashboard overview page, e.g. CLOUDFLARE_ACCOUNT_ID="a1b2c3...").',
    );
  }
  return accountId;
}

function readCloudflareApiToken(): string {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!apiToken) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN is not set. Copy .env.example to .env and " +
        "fill it in with an API token that has Queues edit permission " +
        "(create one at https://dash.cloudflare.com/profile/api-tokens, " +
        'e.g. CLOUDFLARE_API_TOKEN="your-token-here").',
    );
  }
  return apiToken;
}

// NOTE: this is the queue's ID (a UUID assigned by Cloudflare when the queue
// is created, e.g. via `wrangler queues create hello`), NOT the
// human-readable queue name ("hello"). The push-messages API addresses
// queues by id, not name — mixing these up is a common gotcha.
function readCloudflareHelloQueueId(): string {
  const queueId = process.env.CLOUDFLARE_HELLO_QUEUE_ID;
  if (!queueId) {
    throw new Error(
      "CLOUDFLARE_HELLO_QUEUE_ID is not set. Copy .env.example to .env and " +
        "fill it in with the hello queue's ID (NOT its name) — run " +
        "`wrangler queues create hello` and copy the id it prints, e.g. " +
        'CLOUDFLARE_HELLO_QUEUE_ID="9c1b2e3a-4d5f-6789-a0b1-c2d3e4f5a6b7".',
    );
  }
  return queueId;
}

// Local-dev escape hatch: when set (e.g. in .env.local, pointed at
// `wrangler dev`'s default http://localhost:8787), sendJob POSTs here with a
// plain `fetch` instead of going through the Cloudflare SDK — no
// CLOUDFLARE_ACCOUNT_ID/API_TOKEN/HELLO_QUEUE_ID, no real account, no
// network access needed at all. The receiving end is src/worker/index.ts's
// fetch() handler, which mirrors the real push API's request/response shape
// (`{ body: <envelope> }` in, `{success: true}` out) and forwards onto a
// real [[queues.producers]] binding that Miniflare simulates locally. This
// intentionally stays a raw fetch rather than pointing the SDK's `baseURL`
// at localhost: it's testing the actual wire contract our local Worker
// stands in for, not the SDK's abstraction over it. Leave unset for
// production — sendJob falls back to the real SDK-backed path below.
//
// `payload`/`traceId` are the same two arguments the real path wraps into a
// JobEnvelope (see below) — this function does that wrapping itself since
// it bypasses the SDK entirely.
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
// official Cloudflare SDK's `queues.messages.push` (or its local-dev
// stand-in — see sendJobToLocalPushUrl above). The SDK throws a
// `Cloudflare.APIError` subclass on a non-success response (and already
// retries transient failures — connection errors, 408/409/429, 5xx — twice
// by default), so there's no manual response-parsing needed on this path,
// unlike the local-dev branch.
//
// `queueName` is accepted (and still passed by callers like
// enqueueHelloJob) for API shape / future-proofing, but is NOT used to
// address the queue — Cloudflare's push endpoint addresses a queue by id
// (CLOUDFLARE_HELLO_QUEUE_ID), not by name. This is a known scope
// limitation of this single-queue demo: a real multi-queue setup would need
// a name -> queue-id lookup, which isn't built here since there's only one
// job type today.
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

  const accountId = readCloudflareAccountId();
  const apiToken = readCloudflareApiToken();
  const queueId = readCloudflareHelloQueueId();
  const envelope: JobEnvelope<T> = { payload, traceId };

  const client = new Cloudflare({ apiToken });
  try {
    await client.queues.messages.push(queueId, {
      account_id: accountId,
      body: envelope,
      content_type: "json",
    });
  } catch (error) {
    if (error instanceof Cloudflare.APIError) {
      throw new Error(
        `Failed to send job to Cloudflare Queue (${error.status ?? "?"} ${error.name}): ${error.message}`,
      );
    }
    throw error;
  }
}
