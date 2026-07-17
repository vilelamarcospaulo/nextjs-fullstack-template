// Next.js instrumentation entry point (App Router, src/ layout).
//
// Next calls the exported `register()` exactly once per runtime instance and
// AWAITS it before the server accepts any request. This is the only supported
// hook for process-wide startup, and the only point early enough to install
// OpenTelemetry's require-time patches before app code loads pg (Drizzle's
// driver) and pino. Starting the SDK anywhere else races those imports and
// silently yields no spans.
//
// The Node SDK is isolated in ./instrumentation.node and imported dynamically,
// guarded on NEXT_RUNTIME, so the Edge runtime (e.g. a future middleware.ts)
// never evaluates Node-only code. This template targets Node containers today;
// the guard is cheap insurance against that assumption changing.
//
// Telemetry is opt-in: the SDK is started only when an OTLP endpoint is set.
// With no collector configured, the app runs untouched (no export attempts, no
// connection-refused noise in dev). Setting OTEL_EXPORTER_OTLP_ENDPOINT turns it
// on. Application logging via pino (src/lib/logger.ts) is always on regardless —
// only trace export and the log bridge are gated here.

import { type Instrumentation } from "next";

export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ) {
    await import("./instrumentation.node");
  }
}

// Pipe server-side errors (RSC render, route handlers, server actions) into the
// log stream. Runs in whichever runtime threw, so the pino logger — Node only —
// is imported lazily on the Node path; the Edge path falls back to console so an
// edge error is never swallowed.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logger } = await import("./lib/logger");
    logger.error(
      {
        err,
        request: { path: request.path, method: request.method },
        context,
      },
      "request_error",
    );
  } else {
    console.error("request_error", err);
  }
};
