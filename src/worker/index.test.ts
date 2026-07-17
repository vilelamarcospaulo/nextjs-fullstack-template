// Runs under vitest's "worker" project (see vitest.config.ts), which uses
// @cloudflare/vitest-pool-workers to execute this file inside the actual
// Workers runtime (Miniflare), configured from the root wrangler.toml. That
// makes this file part of src/worker/index.ts's own runtime import graph in
// spirit (it imports the handler directly, unbundled), so — like every other
// file under src/worker/ — it uses relative imports with explicit ".ts"
// extensions rather than the "@/*" alias.
import {
  createExecutionContext,
  createMessageBatch,
  getQueueResult,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "./index.ts";
import {
  HELLO_DLQ,
  HELLO_QUEUE,
  type HelloJobPayload,
  type JobEnvelope,
} from "../internal/domain/jobs.ts";

// createMessageBatch()'s `messages` parameter is typed against the ambient
// `ServiceBindingQueueMessage<Body>` global from "@cloudflare/workers-types"
// (declared in its "experimental" entrypoint). This repo has one
// tsconfig.json shared by the whole program, and adding workers-types to its
// "types" array to get that global would redefine DOM globals (Response,
// Request, fetch, ...) that src/app's route tests rely on having their
// normal `dom` lib shape — so it's deliberately NOT added there (see
// tsconfig.json). Declaring the minimal message shape locally avoids that
// repo-wide collision while still matching what createMessageBatch expects
// structurally.
type QueueMessageInput = {
  id: string;
  timestamp: Date;
  attempts: number;
  body: JobEnvelope<HelloJobPayload>;
};

function messageBatchOf(queue: string, body: JobEnvelope<HelloJobPayload>) {
  const messages: QueueMessageInput[] = [
    {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      attempts: 1,
      body,
    },
  ];
  return {
    batch: createMessageBatch(queue, messages),
    messageId: messages[0].id,
  };
}

describe("worker queue handler", () => {
  it("acks a hello-queue message once processHelloJob completes", async () => {
    const { batch, messageId } = messageBatchOf(HELLO_QUEUE, {
      payload: { message: "integration test hello" },
      traceId: "trace-1",
    });
    const ctx = createExecutionContext();

    // queue() never reads `env` (see src/worker/index.ts) — only fetch()'s
    // local-dev push simulation does — so an empty object cast is fine here
    // rather than constructing a real HELLO_QUEUE producer binding.
    await worker.queue(batch, {} as Parameters<typeof worker.queue>[1], ctx);

    // getQueueResult() implicitly waits on the execution context too.
    const result = await getQueueResult(batch, ctx);
    expect(result.explicitAcks).toStrictEqual([messageId]);
    expect(result.retryMessages).toStrictEqual([]);
    expect(result.ackAll).toBe(false);
  });

  it("acks a hello-dlq message without ever retrying it", async () => {
    const { batch, messageId } = messageBatchOf(HELLO_DLQ, {
      payload: { message: "dead lettered hello" },
      traceId: "trace-2",
    });
    const ctx = createExecutionContext();

    await worker.queue(batch, {} as Parameters<typeof worker.queue>[1], ctx);

    const result = await getQueueResult(batch, ctx);
    expect(result.explicitAcks).toStrictEqual([messageId]);
    expect(result.retryMessages).toStrictEqual([]);
  });
});
