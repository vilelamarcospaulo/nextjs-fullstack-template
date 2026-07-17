# Deployment Guide

This app deploys entirely to Cloudflare: the Next.js app itself as a Cloudflare Worker (via the OpenNext Cloudflare adapter), and the background-job consumer as a second, independent Worker. There is no Docker/VPS deployment path anymore — the `deploy/local/` compose stack here is only for local development.

## Local Development

`deploy/local/docker-compose.yaml` runs a local Postgres instance — the only thing the app needs from Docker locally.

### Setup

1. Start Postgres:

```bash
docker compose -f deploy/local/docker-compose.yaml up -d
```

2. Configure environment variables (see `.env.example` for the full template):

```bash
cp .env.example .env
cp .env.example .env.local
```

3. Run migrations and seed data:

```bash
npx drizzle-kit migrate
npm run db:seed
```

4. Run the app:

```bash
npm run dev
```

5. (Optional) Run the queue consumer locally, no real Cloudflare account needed:

```bash
cp .dev.vars.example .dev.vars   # first time only
npm run queue-worker:dev
```

This runs `wrangler dev`, which simulates the `hello`/`hello-dlq` Cloudflare Queues locally via Miniflare. Set `QUEUE_LOCAL_PUSH_URL=http://localhost:8787` in `.env.local` (see `.env.example`) so the app's producer (`src/lib/queue.ts`) targets it instead of the real Cloudflare API.

6. (Optional) Preview the app itself running as a Worker, instead of via `next dev`:

```bash
npm run app:preview
```

This builds via OpenNext and runs the real Worker locally under Miniflare (`wrangler dev` under the hood) — closer to production than `next dev`, useful for catching Workers-runtime-specific issues before deploying.

### Teardown

```bash
docker compose -f deploy/local/docker-compose.yaml down
```

## Production: Cloudflare Workers

Two independent Workers, two independent `wrangler` configs:

- **The app** — `wrangler.app.jsonc`, deployed via `npm run app:deploy` (OpenNext Cloudflare adapter).
- **The queue consumer** — `wrangler.toml`, deployed via `npm run queue-worker:deploy`.

### One-time setup

1. Provision a Hyperdrive connection to your production Postgres instance:

```bash
npx wrangler login
npx wrangler hyperdrive create <name> --connection-string="$DATABASE_URL"
```

Copy the resulting ID into `wrangler.app.jsonc`'s `hyperdrive[0].id` (currently a placeholder — `REPLACE_WITH_REAL_HYPERDRIVE_ID`).

2. Create the Cloudflare Queues used by the background-job demo:

```bash
npx wrangler queues create hello
npx wrangler queues create hello-dlq
```

3. Set the app's production vars/secrets — either in `wrangler.app.jsonc`'s `vars` block for non-secret values, or via `wrangler secret put <NAME> --config wrangler.app.jsonc` for `BETTER_AUTH_SECRET`/Google OAuth credentials. At minimum: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (your production URL), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. See `.env.example` for what each one does.

4. Apply database migrations against production Postgres from your own machine or CI (there's no in-Worker migration step — Drizzle's CLI is a plain Node process):

```bash
DATABASE_URL="<production-connection-string>" npx drizzle-kit migrate
```

### Deploy

```bash
npm run queue-worker:deploy   # background-job consumer
npm run app:deploy            # the app itself
```

### Notes

- Rate limiting is currently disabled in `src/lib/auth.ts` (`rateLimit: { enabled: false }`) — better-auth's built-in "memory" storage doesn't work across Cloudflare's concurrent, ephemeral isolates. Put a durable store (Workers KV or D1) behind it before relying on rate limiting in production.
- Logging goes to Cloudflare's built-in Workers Logs (`console.log`/`console.error`, see `src/lib/logger.ts`) — view it with `wrangler tail --config wrangler.app.jsonc` or in the Cloudflare dashboard. There's no separate tracing/telemetry stack to run.
