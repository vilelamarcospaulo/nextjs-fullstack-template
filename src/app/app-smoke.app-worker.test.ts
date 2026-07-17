// Smoke test for the OpenNext-built app Worker (.open-next/worker.js).
// This test runs under the cloudflare:test pool (via vitest.config.ts's
// "app-worker" project), verifying that the built Worker bundle can be
// loaded and initialized in the Cloudflare Workers runtime (Miniflare).
//
// The build itself is tested by CI's `npm run app:build` step, which runs
// before all tests, and any subsequent dry-run or deployment steps ensure
// the bundle is deployable. This test runs inside the actual Workers
// runtime to confirm the bundle executes without crashing.
import { describe, expect, it } from "vitest";

describe("OpenNext app Worker in cloudflare runtime", () => {
  it("module loads successfully in Workers environment", async () => {
    // This test runs inside Miniflare (cloudflare:test pool). The import
    // uses the cloudflare: module scheme, which only works in that context.
    // Success of this import confirms the Worker bundle can be loaded and
    // initialized by the Workers runtime.
    let worker;
    try {
      // The .open-next/worker.js build artifact must exist (created by
      // `npm run app:build`). The relative path must match the pool's
      // working directory (wrangler.app.jsonc is at repo root).
      worker = await import("../../.open-next/worker.js");
    } catch (error) {
      throw new Error(
        `Failed to load app Worker in cloudflare runtime: ${error}`,
      );
    }
    expect(worker).toBeDefined();
    expect(worker.default).toBeDefined();
    expect(typeof worker.default.fetch).toBe("function");
  });
});
