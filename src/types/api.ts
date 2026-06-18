// Shared API contract types used by both the server (route handlers) and the
// client (components, api-client). Keeping them here avoids duplication and
// makes the envelope shape easy to find.

// The error envelope returned by every non-2xx JSON response.
//
// Key conventions:
//   _auth   — authentication/session failure (not a form field)
//   _body   — request body parse failure (malformed JSON, wrong Content-Type)
//   <field> — a per-field validation error whose key matches the form field name
//
// Underscore-prefixed keys are non-field errors; consumers should surface them
// as toasts or banners rather than attaching them to a specific input element.
export type ApiErrorBody = {
  errors: Record<string, string>;
};

// Re-export the canonical response view so clients and server code can import
// from one place. The source of truth is the use-case layer — we just bridge it.
export type { ProfileView } from "@/internal/use_case/profile";
