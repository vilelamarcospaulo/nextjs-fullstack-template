import { defineConfig } from "vitest/config";

// Two test projects so unit and integration runs can be selected independently
// (npm run test:unit / test:integration) while `vitest run` executes both.
//
// - unit: framework-free logic (pure utils, the domain validator, Prisma-mocked
//   use cases). No database, no global setup.
// - integration: the real HTTP route handlers exercised end to end against a
//   throwaway migrated Postgres DB. Only this project pays the DB setup cost.
//
// Each project uses `extends: true` to inherit the root resolve (the "@/*"
// alias via tsconfigPaths) and the shared node/globals test settings.
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
          include: ["src/utils/**/*.test.ts", "src/internal/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/app/**/*.test.ts"],
          // Provisions a fresh migrated Postgres DB for the route handlers.
          globalSetup: ["./test/global-setup.ts"],
          // Workers construct the Prisma client (@/lib/prisma) against the temp
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
    ],
  },
});
