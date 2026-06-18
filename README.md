This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Docker

The repo includes two deployment setups (see `deploy/README.md` for details):

### Local Development

Run a telemetry stack (OpenTelemetry Collector + Jaeger) locally alongside the app on your host:

```bash
docker compose -f deploy/local/docker-compose.yaml up -d
```

Then set in `.env.local` (or export):

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=content-generator
```

Start the app:

```bash
npm run dev
```

View traces at <http://localhost:16686> (service `content-generator`).

### Production

A full VPS stack with nginx (Let's Encrypt TLS), certbot, migrations, app, and telemetry. See `deploy/production/.env.example` and `deploy/production/init-letsencrypt.sh` for setup.

### Shared

- `Dockerfile` — multi-stage build with targets `runner` (app) and `migrator` (migrations).
- Private registry (`~/.npmrc`) — passed as a BuildKit secret at build time (token expires ~12h; refresh before building if `npm ci` fails with E401).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
