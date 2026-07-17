<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

Running **Next.js 16.2.9** with **React 19.2**. If your instincts say `middleware.ts`, `next lint`, sync `params`, or `--turbopack` flags, they're wrong here — that's Next.js 15-and-earlier muscle memory. Full docs are vendored at `node_modules/next/dist/docs/`; read the relevant page there before touching an API you're not sure about. The breaking changes that actually bite in this codebase:

- **All Request APIs are async, no exceptions.** `cookies()`, `headers()`, `draftMode()`, and `params`/`searchParams` in pages, layouts, and route handlers must be `await`ed. There is no sync fallback left (removed in 16; 15 only warned). Same for `params`/`id` in `opengraph-image`/`twitter-image`/`icon`/`apple-icon`/`sitemap` generators.
- **`middleware.ts` → `proxy.ts`.** The file and the exported function are both renamed; `edge` runtime is not supported under the new name (stays `nodejs`, not configurable). This repo currently has no middleware/proxy file — if you add one, name it `proxy.ts` from the start.
- **`next lint` is gone.** Lint via `eslint` directly (already wired as `npm run lint`, flat config in `eslint.config.mjs`). `next build` does not lint.
- **Turbopack is the default**, for both `dev` and `build` — no `--turbopack` flag needed (`package.json` scripts are already flag-free). A custom `webpack` config in `next.config.ts` would make `next build` fail by default; there isn't one here.
- **`revalidateTag` needs a `cacheLife` profile as its second argument** now (`revalidateTag('posts', 'max')`); the one-arg form is a type error. For read-your-writes semantics use `updateTag` instead. Neither is used in this repo yet — check `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` before introducing either.
- **Parallel route slots require an explicit `default.js`/`default.tsx`.** Not applicable today (no `@slot` folders under `src/app`), but if you add one, it needs a default file or the build fails.
- **`serverRuntimeConfig`/`publicRuntimeConfig` are removed.** Use `process.env.*` (server) / `NEXT_PUBLIC_*` (client) — see `src/lib/env.ts` for this repo's validated-env pattern.

If you hit an API that behaves unexpectedly, assume a 16 change before assuming a bug — grep `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` first.
<!-- END:nextjs-agent-rules -->

# Architecture

Loosely clean-architecture, framework-agnostic core wrapped by a thin Next.js boundary:

- `src/internal/domain/` — pure types + validators, no framework/IO imports (e.g. `domain/profile.ts`'s `inputToProfile()` returns `{ok:true,value}|{ok:false,errors}`; also used client-side, so validation logic has one source of truth).
- `src/internal/use_case/` — orchestrates domain + infra (Drizzle, queue); still no Next.js imports.
- `src/app/` — App Router boundary only: route handlers and pages parse the request/session and delegate to use cases. Keep business logic out of `src/app`.
- `src/lib/` — infra singletons: `db.ts`, `queue.ts`, `auth.ts`/`auth-client.ts`/`session.ts`, `logger.ts`, `trace.ts`, `env.ts`.
- `src/utils/` — small pure helpers with no dependencies on the layers above.
- `src/components/` — UI (shadcn/ui-based `components/ui`, plus `navbar.tsx`, `theme-toggle.tsx`, `providers.tsx`).

**Import-alias rule**: `src/worker/index.ts` is a Cloudflare Worker, bundled by `wrangler`/esbuild rather than run via plain `node` — but the same constraint applies for a different reason: wrangler's esbuild bundling doesn't resolve the `@/*` path alias out of the box. So `src/worker/index.ts` and anything it imports transitively — `internal/domain`, `internal/use_case`, and now nothing from `lib/queue.ts`, since the Worker doesn't import the producer client at all — must still use **relative imports with explicit `.ts` extensions**, never the `@/*` alias. `src/app/**` code can use `@/*` freely.

# Auth

`src/lib/auth.ts` builds the server `betterAuth()` instance (`drizzleAdapter`, Google as sole social provider). Mounted at `src/app/api/auth/[...all]/route.ts` via `toNextJsHandler(auth)`. Rate limiting is explicitly disabled (`rateLimit: { enabled: false }`) — better-auth's built-in "memory" storage is a per-process counter, which doesn't work across Cloudflare Workers' many concurrent, ephemeral isolates. Placeholder until a durable store (KV/D1) backs it.

- In **Server Components / RSC render**: use `src/lib/session.ts`'s `getSession` (wrapped in React `cache()`, deduped per render pass).
- In **Route Handlers**: don't use the cached `getSession` — call `auth.api.getSession({ headers: await headers() })` directly (see `src/app/api/profile/route.ts`), since Route Handlers fall outside the RSC render pass the cache is scoped to.

# Database

Drizzle ORM with `drizzle-orm/node-postgres` — uses the `pg` driver to connect to Postgres. `src/lib/db.ts` exports `getDb()` (not a plain `db` singleton): in a deployed Cloudflare Worker it resolves the connection string from the `HYPERDRIVE` binding (`wrangler.app.jsonc`) via `getCloudflareContext()`; everywhere else (Docker/`next start`, Vitest, `drizzle-kit`) it falls back to a direct `DATABASE_URL` read. The resulting client is cached on `globalThis` either way. Always call `getDb()` from request-scoped code — never cache its result at module top level (see `src/lib/auth.ts`'s residual-risk comment on why that one exception exists).

- Schema: `src/lib/schema.ts` (pgTable definitions for all models; relations use Drizzle's relations() helpers). Plain TypeScript, no code generation step needed.
- Config: `drizzle.config.ts` (schema path, migrations `out` directory, dbCredentials).
- Seed: `drizzle/seed.ts`, run via `npm run db:seed` (Node's native TS stripping — no `ts-node`), idempotent upsert of a fixed-id demo user/profile. NOT automatically hooked into migrations, must be run manually after `drizzle-kit migrate`.
- Migrations: `drizzle/migrations/` (SQL files generated via `npx drizzle-kit generate` after schema changes, applied via `npx drizzle-kit migrate`).

# Background jobs

The Next app is the job **producer**: `src/lib/queue.ts` pushes messages to Cloudflare Queues via the official `cloudflare` SDK (`queues.messages.push`, listed in `next.config.ts`'s `serverExternalPackages`), reading `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_HELLO_QUEUE_ID` from `process.env`. When `QUEUE_LOCAL_PUSH_URL` is set instead (local dev only — see `.env.example`), it bypasses the SDK with a plain `fetch` against the Worker's own local-only push simulation, so the whole producer/consumer loop runs offline with no Cloudflare account.

The **consumer** is a separate Cloudflare Worker, `src/worker/index.ts`, deployed independently via `wrangler deploy` (config in the root `wrangler.toml`) — it is no longer a Node process run alongside the app. `wrangler deploy --dry-run` bundles cleanly (esbuild tree-shakes the producer's `cloudflare` SDK import out, since the Worker only reaches `processHelloJob`, never `sendJob`).

Every job is still wrapped in a `JobEnvelope<T> = { payload, traceId }`, now defined in `src/internal/domain/jobs.ts` and shared by both the producer (`src/lib/queue.ts`) and the consumer (`src/worker/index.ts`). `src/lib/trace.ts`'s `newTraceId()` starts a chain (`crypto.randomUUID()`); pass an existing `ctx.traceId` through `enqueueHelloJob(input, { traceId })` to continue a chain across job A → job B. The consumer binds the traceId into `src/worker/logger.ts`'s `createJobLogger({ traceId, jobId, queue })`, so an HTTP request and every job it triggers are grepable by one traceId across processes. Follow this for any new job type, don't invent a separate correlation-id scheme. Retry/backoff/DLQ behavior is configured natively in `wrangler.toml`'s `queues.consumers` block (`max_retries`, `dead_letter_queue`) instead of in application code.

# Observability

The app deploys to Cloudflare Workers (see "Deployment" below), which rules out the OpenTelemetry Node SDK (its auto-instrumentation patches modules at `require()` time — no equivalent exists in `workerd`) and pino's Node build (doesn't run under `workerd` at all — no Node stream internals, no worker-thread transports). Both were removed rather than ported.

`src/lib/logger.ts` is a small, dependency-free logger: one JSON line per call via `console.log`/`console.warn`/`console.error`, mirroring the pattern `src/worker/logger.ts` already used for the queue consumer. Locally that's plain stdout; deployed, Cloudflare captures it as Workers Logs (`wrangler tail --config wrangler.app.jsonc`, or the dashboard). `src/instrumentation.ts` still exists only to host `onRequestError` (Next requires this exact file/path for that hook), which calls the logger unconditionally — no Node-vs-Edge branching needed anymore.

There is currently no distributed tracing story (no OTel replacement) — a known gap, not yet addressed.

# Testing

`vitest.config.ts` defines five projects — use the matching npm script, not bare `vitest run`, when you only need one:

- **unit** (`npm run test:unit`) — `src/utils/**`, `src/internal/**`, `src/lib/**` `*.test.ts`. No database.
- **integration** (`npm run test:integration`) — `src/app/**/*.test.ts` (excluding `*.app-worker.test.ts`). `test/global-setup.ts` recreates a throwaway `app_test` Postgres DB and applies migrations using Drizzle's programmatic migrator — needs a running Postgres.
- **ui** (`npm run test:ui`) — jsdom, `*.test.tsx`. `test/setup-ui.ts` polyfills `ResizeObserver`/`PointerEvent`/pointer-capture/`matchMedia` for base-ui components — don't hand-roll these polyfills per test file.
- **worker** (`npm run test:worker`) — `src/worker/**/*.test.ts`, the queue consumer exercised inside the real Workers runtime via `@cloudflare/vitest-pool-workers` (`wrangler.toml`).
- **app-worker** (`npm run test:app-worker`) — `src/app/**/*.app-worker.test.ts`, the OpenNext-built app Worker exercised the same way (`wrangler.app.jsonc`). Needs a fresh `npm run app:build` first — `.open-next/worker.js` is a build artifact, not source.

**Mocking convention**: partial mocks that don't implement a hook's full return type (e.g. a router mock with only `push`/`refresh`) must be cast as `as unknown as ReturnType<typeof useRouter>`, not a direct cast — TypeScript's strict mode rejects a direct cast when the mock only partially overlaps the real type. Same rule for `getDb()`'s mock in `profile.test.ts`: cast as `as unknown as ReturnType<typeof getDb>`.

# Deployment

Two independent Cloudflare Workers, two independent `wrangler` configs — there is no Docker/VPS path:

- **The app** itself: `wrangler.app.jsonc`, built/deployed via the OpenNext Cloudflare adapter (`npm run app:build` / `app:preview` / `app:deploy`). Postgres access goes through a Hyperdrive binding (`HYPERDRIVE`, see `src/lib/db.ts`), not a direct `DATABASE_URL` connection.
- **The background-job consumer**: `wrangler.toml`, `npm run queue-worker:dev` / `queue-worker:deploy`.

`deploy/local/docker-compose.yaml` is local-dev-only now (just Postgres). See `deploy/README.md` for the full production setup (Hyperdrive provisioning, queues, secrets).

# Conventions

- Commit messages follow Conventional Commits (`feat(scope): ...`, `fix(scope): ...`, `chore: ...`).
- CI (`.github/workflows/ci.yaml`) runs `lint`, `format:check`, `typecheck`, `test`, `build` as a matrix against a real Postgres service container, and builds the OpenNext app Worker artifact before the `test` task (needed by the `app-worker` Vitest project). Drizzle requires no code-generation step before these tasks (the schema is plain TypeScript).
