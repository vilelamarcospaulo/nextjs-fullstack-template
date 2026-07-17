import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server at .next/standalone (server.js + only the
  // traced node_modules) so the Docker runtime stage can drop devDependencies
  // and the build toolchain. See node_modules/next/dist/docs/.../config/output.md.
  output: "standalone",

  // "cloudflare" (src/lib/queue.ts's producer client, see that file) is a
  // large, Node-oriented, zero-runtime-dependency SDK covering the entire
  // Cloudflare API surface — no reason to make Next's bundler trace through
  // all of it for the one `queues.messages.push` call this app uses.
  //
  // "pg" and "pg-cloudflare" are explicitly externalized for Cloudflare
  // Workers deployment (OpenNext). Postgres access goes through a Hyperdrive
  // binding (see wrangler.app.jsonc and src/lib/db.ts) — pg's own Workers
  // TCP-socket shim (pg-cloudflare) talks to Hyperdrive under the hood.
  serverExternalPackages: ["cloudflare", "pg", "pg-cloudflare"],
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
