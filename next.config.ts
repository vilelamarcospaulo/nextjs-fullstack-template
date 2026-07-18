import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "pg" and "pg-cloudflare" are explicitly externalized for Cloudflare
  // Workers deployment (OpenNext). Postgres access goes through a Hyperdrive
  // binding (see wrangler.app.jsonc and src/lib/db.ts) — pg's own Workers
  // TCP-socket shim (pg-cloudflare) talks to Hyperdrive under the hood.
  serverExternalPackages: ["pg", "pg-cloudflare"],
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
