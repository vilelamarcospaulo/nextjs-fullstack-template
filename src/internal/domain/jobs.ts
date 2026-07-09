// Jobs domain: queue name constants, the payload schema, and pure validation.
// No framework or infrastructure imports — safe to use from the queue
// singleton, the use_case orchestration layer, AND the worker process (all of
// which may load this file via a relative import, hence no "@/*" alias here).
import { z } from "zod";

// The demo "hello" queue proves the producer/consumer wiring end to end; real
// job queues follow the same naming convention (`<name>` + `<name>-dlq`).
export const HELLO_QUEUE = "hello";
export const HELLO_DLQ = "hello-dlq";

export const helloJobPayloadSchema = z.object({
  message: z.string().trim().min(1).max(500),
});

export type HelloJobPayload = z.infer<typeof helloJobPayloadSchema>;

export type ParseHelloJobPayloadResult =
  | { ok: true; value: HelloJobPayload }
  | { ok: false; errors: Partial<Record<"message", string>> };

// Validate raw input (from a server action or the worker's fetched job data)
// into a clean HelloJobPayload, or a map of per-field errors. Same
// discriminated-result shape as inputToProfile in domain/profile.ts.
export function parseHelloJobPayload(
  input: unknown,
): ParseHelloJobPayloadResult {
  const result = helloJobPayloadSchema.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data };
  }

  const fieldError = result.error.issues.find(
    (issue) => issue.path[0] === "message",
  );

  return {
    ok: false,
    errors: {
      message: fieldError
        ? "Message is required and must be 500 characters or fewer."
        : "Invalid job payload.",
    },
  };
}
