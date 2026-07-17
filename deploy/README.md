# Deployment Guide

This directory contains two independent deployment configurations:

- **`local/`** — local development telemetry stack (collector + Jaeger)
- **`production/`** — full VPS deployment (nginx + TLS + app + telemetry)

## Local Development

The local telemetry stack provides OpenTelemetry Collector and Jaeger UI for tracing your app running on the host machine via `npm run dev`.

### Setup

1. Start the local collector + Jaeger:

```bash
docker compose -f deploy/local/docker-compose.yaml up -d
```

2. Configure your app to export traces. In `.env.local` (or export inline), set:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=starter-kit
```

See `.env.example` for a commented template.

3. Run the app on the host:

```bash
npm run dev
```

4. (Optional) In a second terminal, run the queue consumer:

```bash
cp .dev.vars.example .dev.vars   # first time only
npm run worker:dev
```

This runs `wrangler dev`, which simulates the `hello`/`hello-dlq` Cloudflare Queues locally via Miniflare — no local Postgres is involved for the queue anymore (Postgres is still used for the app's own DB via `npm run dev`'s `DATABASE_URL`, just not for jobs). No real Cloudflare account is needed for local dev: with `.dev.vars` in place (gitignored, never read by `wrangler deploy`), the Worker exposes a local-only HTTP endpoint standing in for Cloudflare's real push API. Set `QUEUE_LOCAL_PUSH_URL=http://localhost:8787` in `.env.local` (see `.env.example`) so the app's producer (`src/lib/queue.ts`) targets it instead of the real Cloudflare API. A real account IS required for production (see below), or if you'd rather exercise the real API path locally too — see `.env.example`'s Option B.

5. View traces in Jaeger UI:

```
http://localhost:16686
```

Select service **`starter-kit`** to see your traces.

### Teardown

```bash
docker compose -f deploy/local/docker-compose.yaml down
```

## Production

The production stack is a self-contained VPS deployment that includes:

- **nginx** with Let's Encrypt TLS (via certbot)
- **app** (Next.js) — also the background-job _producer_, pushing to Cloudflare Queues over HTTP
- **OpenTelemetry Collector** + **Jaeger** (internal-only)

The background-job queue _consumer_ is **not** part of this Docker stack. It deploys independently as a Cloudflare Worker via `wrangler deploy`.

For full production setup, see `deploy/production/.env.example` and `deploy/production/init-letsencrypt.sh`.

### Quick reference

1. Copy and fill `deploy/production/.env.example` → `deploy/production/.env`
   - Set `DOMAIN`, `LETSENCRYPT_EMAIL`
   - Set `BETTER_AUTH_SECRET`, Google OAuth creds
   - Set `BETTER_AUTH_URL=https://<DOMAIN>`
   - Set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_HELLO_QUEUE_ID` — required by the `app` container to push jobs to Cloudflare Queues.

2. Point DNS A-record to the VPS IP.

3. One-time Cloudflare Queues setup, against your real Cloudflare account:

```bash
wrangler queues create hello
wrangler queues create hello-dlq
```

4. Deploy the queue consumer Worker. This is a separate deploy step from the Docker stack below — the Worker is not a Docker service:

```bash
wrangler deploy
```

5. Run Let's Encrypt setup (use `--staging` first to avoid rate limits):

```bash
cd deploy/production && ./init-letsencrypt.sh
```

6. Start the stack:

```bash
docker compose -f deploy/production/docker-compose.yaml up -d --build
```

7. Access the app at `https://<DOMAIN>`.

8. Access Jaeger UI internally via SSH tunnel:

```bash
ssh -L 16686:localhost:16686 user@<VPS_IP>
```

Then visit `http://localhost:16686`.

### Notes

- The root `Dockerfile` (shared by both stacks) uses a BuildKit secret for private registry access (`~/.npmrc` mounted as `npmrc`). The CodeArtifact token expires ~12h, so refresh before building if `npm ci` returns E401.
- The production compose includes its own app build, database migrations, and env file management.

---

For app-specific telemetry configuration, see `src/instrumentation.ts`.
