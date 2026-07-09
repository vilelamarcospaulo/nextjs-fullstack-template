// A single traceId per causal chain: generated once at the root (an HTTP
// request/server action) and carried unchanged through every job it spawns,
// however many hops deep (request -> job A -> job B -> ...). Lets every log
// line in that chain be grepped together regardless of which process (the
// Next app or the worker) emitted it.
//
// No repo imports (just the global WebCrypto `crypto`), so this file is
// trivially safe to import via a relative path from the worker process,
// which runs with `node src/worker/index.ts` (no bundler, no "@/*" alias
// resolution) — see src/lib/queue.ts for the full explanation of that
// constraint.
export function newTraceId(): string {
  return crypto.randomUUID();
}
