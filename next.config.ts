import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server at .next/standalone (server.js + only the
  // traced node_modules) so the Docker runtime stage can drop devDependencies
  // and the build toolchain. See node_modules/next/dist/docs/.../config/output.md.
  output: "standalone",

  // Next traces runtime files with @vercel/nft, but better-sqlite3 loads its
  // compiled addon through the `bindings` package via a runtime fs lookup that
  // static tracing cannot follow. Pin the prebuilt .node binary into every
  // server trace so the Prisma driver adapter can open SQLite inside the
  // standalone image. (The generated Prisma client under src/generated/prisma is
  // a normal import and is traced automatically.)
  outputFileTracingIncludes: {
    "/**": ["./node_modules/better-sqlite3/build/Release/*.node"],
  },

  // Keep the OpenTelemetry SDK out of the server bundle. Two reasons:
  //   1. Auto-instrumentation patches modules at require() time; bundling
  //      collapses that indirection and the patches silently no-op.
  //   2. A single shared @opentelemetry/api instance must back both the SDK
  //      (instrumentation.node.ts) and request code (onRequestError), or the
  //      global trace context won't line up.
  // @prisma/client and pino are already in Next's default external list, so the
  // Prisma/Pino instrumentations attach without listing them here.
  serverExternalPackages: [
    "@opentelemetry/api",
    "@opentelemetry/sdk-node",
    "@opentelemetry/resources",
    "@opentelemetry/sdk-logs",
    "@opentelemetry/sdk-trace-node",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/exporter-logs-otlp-http",
    "@opentelemetry/semantic-conventions",
    "@opentelemetry/instrumentation-pino",
    "@prisma/instrumentation",
  ],
};

export default nextConfig;
