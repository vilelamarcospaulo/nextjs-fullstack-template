// Cloudflare Workers-runtime equivalent of src/lib/logger.ts.
//
// pino is NOT used here: it isn't reliably supported in the Workers runtime
// (no Node stream internals, no worker-thread-based transports — the same
// constraints that keep pino-pretty out of src/lib/logger.ts, just more
// severe in a V8-isolate sandbox with no Node APIs at all). Instead this is a
// tiny, dependency-free logger that writes one JSON line per call via
// console.log/console.error — Cloudflare's Workers Logs and `wrangler tail`
// both capture console output, making it the Workers-runtime analogue of the
// old worker process's "stdout is the log pipeline" story.
//
// createJobLogger(bindings) plays the same role pino's `.child(bindings)`
// plays on the Next app side: call it once per job/message with fields that
// should appear on every subsequent log line (traceId, jobId, queue), then
// call .info()/.error() per event without repeating those fields.

export type JobLog = {
  info: (fields: Record<string, unknown>, msg: string) => void;
  error: (fields: Record<string, unknown>, msg: string) => void;
};

function write(
  level: "info" | "error",
  bindings: Record<string, unknown>,
  fields: Record<string, unknown>,
  msg: string,
): void {
  const record = {
    level,
    time: new Date().toISOString(),
    ...bindings,
    ...fields,
    msg,
  };

  const line = JSON.stringify(record);
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

// Creates a logger bound to `bindings` (e.g. { traceId, jobId, queue}) so
// every log line emitted through the returned object carries them without
// the caller having to repeat them at each call site.
export function createJobLogger(bindings: Record<string, unknown>): JobLog {
  return {
    info: (fields, msg) => write("info", bindings, fields, msg),
    error: (fields, msg) => write("error", bindings, fields, msg),
  };
}
