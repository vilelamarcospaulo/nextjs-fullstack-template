// Node-only OpenTelemetry bootstrap.
//
// Imported dynamically from instrumentation.ts ONLY when NEXT_RUNTIME === "nodejs"
// AND an OTLP endpoint is configured (see that file). The OTel Node SDK pulls in
// Node core modules and must never be evaluated in the Edge runtime — keeping it
// in a separate, lazily imported module is what guarantees that.
//
// Exporters are configured purely through the standard OTEL_* environment
// variables (OTEL_EXPORTER_OTLP_ENDPOINT, _HEADERS, _PROTOCOL, ...). Passing no
// constructor arguments is deliberate: every app/container derived from this
// template points itself at a collector via env, with zero code changes.

import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "template",
    [ATTR_SERVICE_VERSION]:
      process.env.OTEL_SERVICE_VERSION ??
      process.env.npm_package_version ??
      "0.0.0",
  }),
  // Batch (not Simple) processors: spans/logs are buffered and flushed on an
  // interval to amortize network cost — the right default for production. Tune
  // batch sizing/timeouts via the standard OTEL_BSP_* / OTEL_BLRP_* env vars.
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
  logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
  instrumentations: [
    // Spans for Prisma queries. Prisma 7's driver-adapter client emits the
    // prisma:client:* span family, which this instrumentation attaches to.
    new PrismaInstrumentation(),
    // Injects trace_id/span_id into pino logs and bridges them to the OTel Logs
    // exporter configured above.
    new PinoInstrumentation(),
  ],
});

sdk.start();

// Flush batched telemetry on shutdown. Orchestrated containers receive SIGTERM
// before being killed; without an explicit flush the final batch of spans/logs
// is lost. We do NOT call process.exit() — Next.js owns the process lifecycle and
// exits once its own graceful shutdown completes.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void sdk.shutdown();
  });
}
