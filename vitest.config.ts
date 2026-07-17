import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Four test projects so unit/integration/ui/worker runs can be selected
// independently (npm run test:unit / test:integration / test:ui /
// test:worker) while `vitest run` executes all of them.
//
// - unit: framework-free logic (pure utils, the domain validator, Drizzle-mocked
//   use cases). No database, no global setup.
// - integration: the real HTTP route handlers exercised end to end against a
//   throwaway migrated Postgres DB. Only this project pays the DB setup cost.
// - worker: the Cloudflare Worker queue consumer (src/worker/index.ts), run
//   inside the actual Workers runtime via Miniflare (see below).
//
// unit/integration/ui use `extends: true` to inherit the root resolve (the
// "@/*" alias via tsconfigPaths) and the shared node/globals test settings.
// worker does NOT extend the root config — the Workers runtime pool set up
// by `cloudflareTest()` below rejects a non-default `test.environment`
// (which the root config sets to "node" for the other projects; see
// node_modules/@cloudflare/vitest-pool-workers's own pool-plugin check), and
// it manages its own module resolution/pool wiring internally. Its test
// files import src/worker/index.ts by relative path (matching that file's
// own no-"@/*"-alias convention, since wrangler's bundler doesn't resolve
// that alias either), so it doesn't need resolve.tsconfigPaths.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  // JSX/TSX is transformed by Vitest 4's built-in oxc (automatic runtime, from
  // tsconfig `jsx: react-jsx`) — no @vitejs/plugin-react, which would pull a
  // Babel 8 dep that conflicts with the shadcn CLI's Babel 7 dep.
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/utils/**",
        "src/internal/**",
        "src/app/api/profile/**",
        "src/app/api/hello/**",
        "src/app/actions.ts",
        "src/components/**",
        "src/app/auth-buttons.tsx",
        "src/app/greeter.tsx",
        "src/app/api-hello-demo.tsx",
        "src/app/profile/profile-form.tsx",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: [
            "src/utils/**/*.test.ts",
            "src/internal/**/*.test.ts",
            "src/lib/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/app/**/*.test.ts"],
          exclude: ["src/app/**/*.app-worker.test.ts"],
          // Every test file's beforeEach calls resetDb(), a full-table wipe
          // against the ONE shared `app_test` database (see
          // test/global-setup.ts) — there's no per-file DB isolation. Running
          // test files in parallel (Vitest's default) lets one file's
          // resetDb()/seed race another file's in-flight assertions, causing
          // intermittent FK-violation / unique-constraint / record-not-found
          // failures that move around between runs. Force this project's test
          // files to run one at a time; unit/ui don't touch a DB and stay
          // parallel.
          fileParallelism: false,
          // Provisions a fresh migrated Postgres DB for the route handlers.
          globalSetup: ["./test/global-setup.ts"],
          // Workers construct the Drizzle client (@/lib/db) against the temp
          // DB. Must match the URL migrated in test/global-setup.ts.
          env: {
            DATABASE_URL:
              "postgresql://postgres:postgres@localhost:5432/app_test",
            BETTER_AUTH_SECRET: "auth_secret",
            BETTER_AUTH_URL: "http://localhost:3000",
            GOOGLE_CLIENT_ID: "google_client_id",
            GOOGLE_CLIENT_SECRET: "google_client_secret",
          },
        },
      },
      {
        // User-perspective component tests: render a client component in jsdom,
        // simulate clicks/typing, assert what the user sees. Matches *.test.tsx
        // so it never overlaps the .test.ts unit/integration projects.
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./test/setup-ui.ts"],
        },
      },
      {
        // No `extends: true` — see the comment at the top of this file for
        // why. `cloudflareTest()` is a Vite plugin (not a `test.pool`/
        // `test.poolOptions` value) that wires up the Miniflare-backed
        // Workers pool itself; it reads wrangler.toml's `main` and
        // `[[queues.consumers]]` entries so `createMessageBatch()` in test
        // files can simulate the "hello"/"hello-dlq" queues declared there.
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.toml" },
          }),
        ],
        test: {
          name: "worker",
          globals: true,
          include: ["src/worker/**/*.test.ts"],
        },
      },
      {
        // app-worker tests the OpenNext-built Next.js app Worker (src/app =>
        // OpenNext => .open-next/worker.js). Like the queue-consumer worker
        // above, it uses cloudflareTest() with the app-specific wrangler config
        // (wrangler.app.jsonc). The app Worker's fetch handler is the main
        // entry point; tests run inside Miniflare to confirm the built app
        // actually boots and handles requests.
        //
        // NOTE: .open-next/worker.js is a BUILD ARTIFACT generated by
        // `npm run app:build` (runs opennextjs-cloudflare build). The test
        // requires a fresh build to exist. Re-run `npm run app:build` if the
        // artifact becomes stale or the test fails with "Cannot find module".
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.app.jsonc" },
          }),
        ],
        test: {
          name: "app-worker",
          globals: true,
          include: ["src/app/**/*.app-worker.test.ts"],
        },
      },
    ],
  },
});
