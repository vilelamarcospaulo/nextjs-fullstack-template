"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// Discriminated-union result type used by all server actions in this file.
// Callers narrow on `ok` before accessing `data` or `error`.
export type GreetingResult =
  | { ok: true; data: string }
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
export async function generateGreeting(
  name: string,
): Promise<GreetingResult> {
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
