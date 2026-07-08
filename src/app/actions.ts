"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { enqueueHelloJob as enqueueHelloJobUseCase } from "@/internal/use_case/jobs";

// Discriminated-union result type used by all server actions in this file.
// Callers narrow on `ok` before accessing `data` or `error`.
export type GreetingResult =
  { ok: true; data: string } | { ok: false; error: string };

// Discriminated-union result type for the job-queue demo action. Same shape
// convention as GreetingResult, just carrying the pg-boss job id on success.
export type JobActionResult =
  | { ok: true; data: { jobId: string } }
  | { ok: false; error: string };

// Maximum characters accepted for the `name` argument. Anything longer is
// rejected before any further processing — keeps payloads small and prevents
// abuse when this pattern is extended to real LLM calls.
const MAX_NAME_LENGTH = 100;

// Server Action: runs only on the server, callable directly from Client
// Components without defining an HTTP endpoint. This is the path that future
// content-generation calls (e.g. invoking an LLM) would use.
//
// Auth gate: the session is verified server-side via better-auth using the
// incoming request headers forwarded by next/headers. Unauthenticated callers
// receive an { ok: false } result rather than an exception so the client can
// render a friendly prompt instead of an unhandled error boundary.
export async function generateGreeting(name: string): Promise<GreetingResult> {
  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: "unauthenticated" };
  }

  // ── 2. Input validation ────────────────────────────────────────────────────
  if (typeof name !== "string") {
    return { ok: false, error: "invalid_input" };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.`,
    };
  }

  // ── 3. Business logic ──────────────────────────────────────────────────────
  const trimmed = name.trim();
  const who = trimmed.length > 0 ? trimmed : "world";
  return {
    ok: true,
    data: `Hello, ${who} — generated on the server at ${new Date().toISOString()}.`,
  };
}

// Maximum characters accepted for the `message` argument. Mirrors
// MAX_NAME_LENGTH above — keeps payloads small before they're handed off to
// the queue.
const MAX_JOB_MESSAGE_LENGTH = 200;

// Server Action: enqueues a trivial "hello" job onto the Postgres-backed
// queue (pg-boss), processed asynchronously by a separate worker process.
// Named `submitHelloJob` (rather than `enqueueHelloJob`) to avoid colliding
// with the use-case function of the same name imported above.
//
// Auth gate: identical to generateGreeting — unauthenticated callers receive
// an { ok: false } result rather than an exception.
export async function submitHelloJob(message: string): Promise<JobActionResult> {
  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: "unauthenticated" };
  }

  // ── 2. Input validation ────────────────────────────────────────────────────
  if (typeof message !== "string" || message.trim().length === 0) {
    return { ok: false, error: "Message must not be empty." };
  }
  if (message.length > MAX_JOB_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `Message must be ${MAX_JOB_MESSAGE_LENGTH} characters or fewer.`,
    };
  }

  // ── 3. Enqueue via the use case ────────────────────────────────────────────
  const result = await enqueueHelloJobUseCase({ message });

  // ── 4. Map validation failures ─────────────────────────────────────────────
  if (!result.ok) {
    return { ok: false, error: result.errors.message ?? "invalid_input" };
  }

  // ── 5. Success ──────────────────────────────────────────────────────────────
  return { ok: true, data: { jobId: result.jobId } };
}
