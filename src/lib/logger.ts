// Canonical application logger.
//
// Plain pino writing structured JSON to stdout — no transport, no pretty-print.
// In a container, stdout IS the log pipeline: the runtime/collector scrapes it,
// so the app must not own formatting or shipping. pino-pretty is intentionally
// avoided (it spawns a worker thread and does not bundle cleanly under Next).
//
// Trace correlation is automatic when telemetry is enabled: the Pino
// instrumentation registered in instrumentation.node.ts injects `trace_id` /
// `span_id` into every record and mirrors logs onto the OTel Logs bridge, so the
// same lines reach your OTLP collector already tied to the active span. That
// only works if the instrumentation starts BEFORE pino is first required, which
// is why nothing at module top level should import this file before `register()`
// has run (see instrumentation.ts). When telemetry is disabled, pino still logs
// to stdout — just without the trace ids. Correct, quiet degradation.
//
// Usage:
//   import { logger } from "@/lib/logger";
//   logger.info({ userId }, "profile_updated");

import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});
