// Next.js instrumentation entry point (App Router, src/ layout).
//
// No OpenTelemetry SDK is registered here anymore: the Node SDK worked by
// monkey-patching modules at require() time, which has no equivalent in
// Cloudflare's `workerd` runtime that this app is migrating to — it could
// only be removed, not ported. There's nothing left to `register()`, but the
// file still exists to host `onRequestError` below, which Next only picks up
// from this exact path.
//
// Pipe server-side errors (RSC render, route handlers, server actions) into
// the log stream via the console-based logger (src/lib/logger.ts) — no more
// Node-vs-Edge branching, since there's no Node-only concern left now that
// pino/OTel are gone.
import { type Instrumentation } from "next";
import { logger } from "./lib/logger";

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  logger.error(
    {
      err,
      request: { path: request.path, method: request.method },
      context,
    },
    "request_error",
  );
};
