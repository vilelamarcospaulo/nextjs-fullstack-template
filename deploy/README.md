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
OTEL_SERVICE_NAME=content-generator
```

See `.env.example` for a commented template.

3. Run the app on the host:

```bash
npm run dev
```

4. View traces in Jaeger UI:

```
http://localhost:16686
```

Select service **`content-generator`** to see your traces.

### Teardown

```bash
docker compose -f deploy/local/docker-compose.yaml down
```

## Production

The production stack is a self-contained VPS deployment that includes:

- **nginx** with Let's Encrypt TLS (via certbot)
- **app** (Next.js)
- **OpenTelemetry Collector** + **Jaeger** (internal-only)

For full production setup, see `deploy/production/.env.example` and `deploy/production/init-letsencrypt.sh`.

### Quick reference

1. Copy and fill `deploy/production/.env.example` → `deploy/production/.env`
   - Set `DOMAIN`, `LETSENCRYPT_EMAIL`
   - Set `BETTER_AUTH_SECRET`, Google OAuth creds
   - Set `BETTER_AUTH_URL=https://<DOMAIN>`

2. Point DNS A-record to the VPS IP.

3. Run Let's Encrypt setup (use `--staging` first to avoid rate limits):

```bash
cd deploy/production && ./init-letsencrypt.sh
```

4. Start the stack:

```bash
docker compose -f deploy/production/docker-compose.yaml up -d --build
```

5. Access the app at `https://<DOMAIN>`.

6. Access Jaeger UI internally via SSH tunnel:

```bash
ssh -L 16686:localhost:16686 user@<VPS_IP>
```

Then visit `http://localhost:16686`.

### Notes

- The root `Dockerfile` (shared by both stacks) uses a BuildKit secret for private registry access (`~/.npmrc` mounted as `npmrc`). The CodeArtifact token expires ~12h, so refresh before building if `npm ci` returns E401.
- The production compose includes its own app build, database migrations, and env file management.

---

For app-specific telemetry configuration, see `src/instrumentation.ts`.
