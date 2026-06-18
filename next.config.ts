import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
