// Typed fetch helper for client components.
//
// Usage:
//   const data = await apiFetch<ProfileView>("/api/profile");
//
// On success (2xx) the parsed body is returned as T.
// On failure the function throws an ApiError with the structured errors map,
// or an AuthError (a subclass) when the server returns 401.
// Network-level rejections propagate as-is so callers can catch them separately.
import type { ApiErrorBody } from "@/types/api";

// Thrown for any non-ok response that carries an { errors } envelope.
export class ApiError extends Error {
  readonly status: number;
  readonly errors: Record<string, string>;

  constructor(status: number, errors: Record<string, string>) {
    // Build a compact message from the first error value for convenience.
    const first = Object.values(errors)[0] ?? "Request failed.";
    super(first);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

// Subclass so callers can distinguish 401 with a simple instanceof check
// without inspecting the status manually.
export class AuthError extends ApiError {
  constructor(errors: Record<string, string>) {
    super(401, errors);
    this.name = "AuthError";
  }
}

// Core helper. Mirrors the native fetch signature: same `input` + `init`, but
// parses JSON automatically and unwraps error envelopes into typed exceptions.
//
//   T — the expected shape of a successful (2xx) response body.
export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  // Let network rejections (TypeError: Failed to fetch, etc.) propagate raw;
  // callers handle them in their own catch branch.
  // Only forward `init` when the caller provided it; passing `undefined`
  // explicitly would change the argument count and break test spies that assert
  // the exact call signature (e.g. `toHaveBeenCalledWith("/api/hello")`).
  const res =
    init !== undefined ? await fetch(input, init) : await fetch(input);

  // Attempt to parse the body as JSON regardless of status, because both
  // success and error envelopes use JSON.
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    // Body wasn't parseable JSON — surface a generic error.
    const fallback: Record<string, string> = {
      _body: `Server returned ${res.status} with non-JSON body.`,
    };
    if (res.status === 401) throw new AuthError(fallback);
    throw new ApiError(res.status, fallback);
  }

  if (!res.ok) {
    // Try to pull the errors map out of the standard envelope.
    const envelope = json as Partial<ApiErrorBody>;
    const errors: Record<string, string> =
      envelope?.errors && typeof envelope.errors === "object"
        ? (envelope.errors as Record<string, string>)
        : { _body: `Request failed with status ${res.status}.` };

    if (res.status === 401) throw new AuthError(errors);
    throw new ApiError(res.status, errors);
  }

  return json as T;
}
