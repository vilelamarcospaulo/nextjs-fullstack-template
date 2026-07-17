# Starter Kit

A batteries-included Next.js 16 fullstack template: server actions, API routes, Google OAuth, and a Cloudflare Queues-backed job queue, all wired up in one app so you can see how the pieces fit together before you build on top of them. Deploys entirely to Cloudflare Workers.

Open the homepage after starting the dev server and you'll find three live demos — a server action, an API route, and an async background job — each calling into the real backend, not mocked data.

## Stack

- **[Next.js 16](https://nextjs.org)** (App Router, Turbopack) + **React 19**
- **[better-auth](https://www.better-auth.com)** — Google OAuth sign-in
- **[Drizzle ORM](https://orm.drizzle.team)** + Postgres, via `drizzle-orm/node-postgres` and a [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) binding in production
- **[Cloudflare Queues](https://developers.cloudflare.com/queues/)** — background job queue, consumed by an independently deployed Cloudflare Worker
- **[OpenNext](https://opennext.js.org/cloudflare)** — deploys the app itself to Cloudflare Workers
- **[shadcn/ui](https://ui.shadcn.com)** + Tailwind CSS
- **[Vitest](https://vitest.dev)** — unit, integration, and component tests, including real Workers-runtime tests via `@cloudflare/vitest-pool-workers`

## Getting started

You'll need Node.js 20.9+ and a Postgres database.

**1. Install dependencies**

```bash
npm install
```

**2. Start Postgres**

The easiest way is the bundled Docker Compose file:

```bash
docker compose -f deploy/local/docker-compose.yaml up -d
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
npx drizzle-kit migrate
npm run db:seed
```

The first command applies the schema migrations from `drizzle/migrations/`, and the second seeds a demo user/profile (see `drizzle/seed.ts`). These are now two separate manual steps since Drizzle has no post-migrate seed hook like Prisma did.

**5. Start the dev server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**6. (Optional) Run the background worker**

The "Async Job" demo on the homepage enqueues a job that only completes if a worker is picking it up. No real Cloudflare account needed locally — this runs the queue consumer entirely via Miniflare:

```bash
cp .dev.vars.example .dev.vars   # first time only
npm run queue-worker:dev
```

## Project layout

```
src/
├── app/            # Routes: pages, layouts, API route handlers
├── components/     # UI components (shadcn/ui + app-specific)
├── internal/
│   ├── domain/     # Framework-free types and validation
│   └── use_case/   # Orchestration between domain and infra (Drizzle, queue)
├── lib/            # Infra singletons: Drizzle client, auth, queue, logger, env
├── utils/          # Small pure helper functions
└── worker/         # Cloudflare Worker entrypoint for the background job consumer
```

The core idea: `internal/domain` and `internal/use_case` don't know Next.js exists. `src/app` is a thin layer that wires HTTP/React onto that core, which is what lets the same use cases be called from a route handler, a server action, or (in principle) a CLI or worker.

## Scripts

| Command                           | Description                                         |
| --------------------------------- | --------------------------------------------------- |
| `npm run dev`                     | Start the dev server (Turbopack)                    |
| `npm run build`                   | Production build (`next build`)                     |
| `npm run start`                   | Run a production build                              |
| `npm run app:preview`             | Build via OpenNext and preview as a real Worker     |
| `npm run app:deploy`              | Deploy the app to Cloudflare Workers                |
| `npm run queue-worker:dev`        | Run the background job consumer locally (Miniflare) |
| `npm run queue-worker:deploy`     | Deploy the background job consumer to Cloudflare    |
| `npm run lint`                    | ESLint                                              |
| `npm run format` / `format:check` | Prettier                                            |
| `npm run typecheck`               | `tsc --noEmit`                                      |
| `npm run test`                    | Run all tests                                       |
| `npm run test:unit`               | Fast tests, no database                             |
| `npm run test:integration`        | Tests against a real Postgres instance              |
| `npm run test:ui`                 | Component tests (jsdom)                             |
| `npm run test:worker`             | Queue consumer tests, real Workers runtime          |
| `npm run test:app-worker`         | App tests, real Workers runtime                     |

## Logging

Structured JSON logs via a small `console.log`/`console.error`-based logger (`src/lib/logger.ts`) — no setup needed. Locally that's plain stdout; deployed, Cloudflare captures it as Workers Logs (`wrangler tail` or the dashboard).

## Deployment

The app deploys to Cloudflare Workers (via the [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare)), and the background-job consumer deploys as a second, independent Cloudflare Worker. There's no Docker/VPS path — `deploy/local/` is local-dev-only (just Postgres).

See [`deploy/README.md`](deploy/README.md) for the full production setup walkthrough (Hyperdrive provisioning, queues, secrets, deploying both Workers).

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [better-auth Documentation](https://www.better-auth.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [OpenNext Cloudflare Documentation](https://opennext.js.org/cloudflare)
- [Cloudflare Queues Documentation](https://developers.cloudflare.com/queues/)
