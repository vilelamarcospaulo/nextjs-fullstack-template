import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server at .next/standalone (server.js + only the
  // traced node_modules) so the Docker runtime stage can drop devDependencies
  // and the build toolchain. See node_modules/next/dist/docs/.../config/output.md.
  output: "standalone",

  // Keep the OpenTelemetry SDK out of the server bundle. Two reasons:
  //   1. Auto-instrumentation patches modules at require() time; bundling
  //      collapses that indirection and the patches silently no-op.
  //   2. A single shared @opentelemetry/api instance must back both the SDK
  //      (instrumentation.node.ts) and request code (onRequestError), or the
  //      global trace context won't line up.
  // pg and pino are already in Next's default external list, so the
  // pg/Pino instrumentations attach without listing them here.
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
    "@opentelemetry/instrumentation-pg",
  ],
};

export default nextConfig;
