# Arch View

A batteries-included Next.js 16 fullstack template: server actions, API routes, Google OAuth, a Postgres-backed job queue, and OpenTelemetry tracing, all wired up in one app so you can see how the pieces fit together before you build on top of them.

Open the homepage after starting the dev server and you'll find three live demos — a server action, an API route, and an async background job — each calling into the real backend, not mocked data.

## Stack

- **[Next.js 16](https://nextjs.org)** (App Router, Turbopack) + **React 19**
- **[better-auth](https://www.better-auth.com)** — Google OAuth sign-in
- **[Prisma 7](https://www.prisma.io)** + Postgres, via the `@prisma/adapter-pg` driver adapter
- **[pg-boss](https://github.com/timgit/pg-boss)** — Postgres-backed background job queue, run by a standalone worker process
- **[OpenTelemetry](https://opentelemetry.io)** + pino — structured logs and traces, opt-in
- **[shadcn/ui](https://ui.shadcn.com)** + Tailwind CSS
- **[Vitest](https://vitest.dev)** — unit, integration, and component tests

## Getting started

You'll need Node.js 20.9+ and a Postgres database.

**1. Install dependencies**

```bash
npm install
```

**2. Start Postgres**

The easiest way is the bundled Docker Compose file (also brings up an OpenTelemetry Collector and Jaeger, see [Tracing](#tracing-optional) below):

```bash
docker compose -f deploy/local/docker-compose.yaml up -d postgres
```

Or point `DATABASE_URL` at any Postgres instance you already have.

**3. Configure environment variables**

Copy the template and fill in the values — comments in the file explain where each one comes from:

```bash
cp .env.example .env
cp .env.example .env.local
```

At minimum you need `DATABASE_URL` (in `.env`) and `BETTER_AUTH_SECRET` + Google OAuth credentials (in `.env.local`) to sign in. Everything else is optional for local dev.

**4. Run migrations and seed data**

```bash
npx prisma migrate dev
```

This also generates the Prisma client and seeds a demo user/profile (see `prisma/seed.ts`).

**5. Start the dev server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**6. (Optional) Run the background worker**

The "Async Job" demo on the homepage enqueues a job that only completes if a worker is picking it up:

```bash
npm run worker:dev
```

## Project layout

```
src/
├── app/            # Routes: pages, layouts, API route handlers
├── components/     # UI components (shadcn/ui + app-specific)
├── internal/
│   ├── domain/     # Framework-free types and validation
│   └── use_case/   # Orchestration between domain and infra (Prisma, queue)
├── lib/            # Infra singletons: Prisma client, auth, queue, logger, env
├── utils/          # Small pure helper functions
└── worker/         # Standalone entrypoint for the background job worker
```

The core idea: `internal/domain` and `internal/use_case` don't know Next.js exists. `src/app` is a thin layer that wires HTTP/React onto that core, which is what lets the same use cases be called from a route handler, a server action, or (in principle) a CLI or worker.

## Scripts

| Command                           | Description                                           |
| --------------------------------- | ----------------------------------------------------- |
| `npm run dev`                     | Start the dev server (Turbopack)                      |
| `npm run build`                   | Production build                                      |
| `npm run start`                   | Run a production build                                |
| `npm run worker` / `worker:dev`   | Run the background job worker (`:dev` adds `--watch`) |
| `npm run lint`                    | ESLint                                                |
| `npm run format` / `format:check` | Prettier                                              |
| `npm run typecheck`               | `tsc --noEmit`                                        |
| `npm run test`                    | Run all tests                                         |
| `npm run test:unit`               | Fast tests, no database                               |
| `npm run test:integration`        | Tests against a real Postgres instance                |
| `npm run test:ui`                 | Component tests (jsdom)                               |

## Tracing (optional)

Telemetry is opt-in — the app runs fine without it, pino just logs plain JSON to stdout. To see traces:

1. Start the local stack (OpenTelemetry Collector + Jaeger), if you haven't already: `docker compose -f deploy/local/docker-compose.yaml up -d`
2. Set in `.env.local`:
   ```bash
   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   OTEL_SERVICE_NAME=arch-view
   ```
3. Restart `npm run dev`, then browse traces at [http://localhost:16686](http://localhost:16686) (service `arch-view`).

## Deployment

Two Docker Compose stacks live under `deploy/`:

- **`deploy/local/`** — the Postgres + telemetry stack used above for local dev.
- **`deploy/production/`** — a full VPS deployment: nginx with Let's Encrypt TLS, the app, the worker, and an internal telemetry stack.

See [`deploy/README.md`](deploy/README.md) for the full production setup walkthrough (DNS, TLS, environment variables).

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [better-auth Documentation](https://www.better-auth.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [pg-boss Documentation](https://github.com/timgit/pg-boss#readme)
