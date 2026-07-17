// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  // For best results consider enabling R2 caching
  // See https://opennext.js.org/cloudflare/caching for more details
  // incrementalCache: r2IncrementalCache
  // Postgres access goes through a Hyperdrive binding (see wrangler.app.jsonc's
  // "hyperdrive" block and src/lib/db.ts) — no OpenNext-level config needed here.
});
