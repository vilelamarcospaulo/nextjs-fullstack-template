import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getProfile, updateProfile } from "@/internal/use_case/profile";
import type { ApiErrorBody } from "@/types/api";

// All error helpers return Response.json with explicit ApiErrorBody typing so
// TypeScript enforces the envelope shape at every call site.

function unauthorized(): Response {
  return Response.json(
    { errors: { _auth: "Authentication required." } } satisfies ApiErrorBody,
    { status: 401 },
  );
}

// GET /api/profile — the signed-in user's own profile (incl. email for display).
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return unauthorized();

  const view = await getProfile(session.user.id);
  if (!view) return unauthorized();

  return Response.json(view);
}

// PUT /api/profile — validate (never trust the client) and persist. The user id
// comes only from the session, so any id in the body is ignored.
export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return unauthorized();

  // Guard: reject requests that aren't application/json before attempting to
  // parse the body. application/json is the only content type we accept.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return Response.json(
      {
        errors: {
          _body: "Content-Type must be application/json.",
        },
      } satisfies ApiErrorBody,
      { status: 415 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        errors: { _body: "Request body must be valid JSON." },
      } satisfies ApiErrorBody,
      { status: 400 },
    );
  }

  const result = await updateProfile(session.user.id, body);
  if (!result.ok) {
    return Response.json(
      { errors: result.errors } satisfies ApiErrorBody,
      { status: 400 },
    );
  }
  return Response.json(result.value);
}
