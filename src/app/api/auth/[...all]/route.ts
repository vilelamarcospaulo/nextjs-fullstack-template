import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// Mounts every Better Auth endpoint under /api/auth/* — including the Google
// callback at /api/auth/callback/google and the session endpoint.
//
// getAuth() is called per-request (not once at module scope) — see the
// getAuth() doc comment in src/lib/auth.ts for why a cached instance is
// unsafe under Cloudflare Workers.
export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}
export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
