import { defineConfig } from "vitest/config";

// Unit-test config. The targets are framework-free logic (pure utils, the
// domain validator, and Prisma-mocked use cases), so we run in a plain Node
// environment with no Next.js harness. resolve.tsconfigPaths wires the "@/*"
// alias so test imports resolve the same way the app does.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/utils/**", "src/internal/**"],
    },
  },
});
