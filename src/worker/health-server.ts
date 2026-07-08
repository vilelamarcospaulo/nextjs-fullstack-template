// Plain node:http healthcheck server for the worker process — no framework,
// no dependency. Matches the dependency-free healthcheck philosophy already
// used by the Dockerfile's `runner` stage.
//
// Imported by src/worker/index.ts via a relative path (the worker runs with
// `node src/worker/index.ts`, Node's native TS stripping, no bundler, no
// "@/*" alias resolution), so this file uses only Node builtins.
import { createServer, type Server } from "node:http";

const READY_BODY = JSON.stringify({ status: "ok" });
const NOT_READY_BODY = JSON.stringify({ status: "not_ready" });

// Starts a single-route health server on `port`. GET (any path) returns 200
// with a small JSON body once `isReady()` returns true, 503 otherwise.
// Returns the underlying Server so the caller can close it during graceful
// shutdown.
export function startHealthServer(port: number, isReady: () => boolean): Server {
  const server = createServer((_req, res) => {
    if (isReady()) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(READY_BODY);
      return;
    }

    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(NOT_READY_BODY);
  });

  server.listen(port);

  return server;
}
