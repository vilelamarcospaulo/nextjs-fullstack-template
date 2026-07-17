// Canonical application logger.
//
// pino is NOT used here: its Node build doesn't run under Cloudflare's
// `workerd` runtime (no Node stream internals, no worker-thread-based
// transports) — the same constraint src/worker/logger.ts already solved for
// the queue-consumer Worker. This is that same tiny, dependency-free pattern
// applied to the Next app side: one JSON line per call via
// console.log/console.warn/console.error, captured by Cloudflare Workers Logs
// (and `wrangler tail`) the same way stdout used to be scraped in the old
// container.
//
// The call shape — logger.error({ ...fields }, "message") — matches the old
// pino logger so call sites didn't need to change. Error instances anywhere
// in `fields` are serialized to { name, message, stack } before JSON encoding
// (plain JSON.stringify(new Error(...)) yields "{}", since Error's own
// properties aren't enumerable) — this replaces pino's default `err`
// serializer, which onRequestError's request_error log relies on.
//
// Usage:
//   import { logger } from "@/lib/logger";
//   logger.info({ userId }, "profile_updated");

const LEVELS = ["debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

function resolveLevel(): Level {
  const configured = process.env.LOG_LEVEL;
  return (LEVELS as readonly string[]).includes(configured ?? "")
    ? (configured as Level)
    : "info";
}

const activeLevel = resolveLevel();

function isEnabled(level: Level): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(activeLevel);
}

function errorReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function write(
  level: Level,
  fields: Record<string, unknown>,
  msg: string,
): void {
  if (!isEnabled(level)) return;

  const record = {
    level,
    time: new Date().toISOString(),
    ...fields,
    msg,
  };

  const line = JSON.stringify(record, errorReplacer);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (fields: Record<string, unknown>, msg: string) =>
    write("debug", fields, msg),
  info: (fields: Record<string, unknown>, msg: string) =>
    write("info", fields, msg),
  warn: (fields: Record<string, unknown>, msg: string) =>
    write("warn", fields, msg),
  error: (fields: Record<string, unknown>, msg: string) =>
    write("error", fields, msg),
};
