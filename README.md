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

A production-style container setup ships with the repo:

- `Dockerfile` — multi-stage build producing Next's [`standalone`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) server. Targets: `runner` (the slim app image) and `migrator` (one-shot `prisma migrate deploy`).
- `docker-compose.yml` — runs migrations, then the app, wired to an OpenTelemetry Collector and Jaeger for traces.
- `otel-collector-config.yaml` — OTLP in → Jaeger (traces) + debug (traces/logs).

### Run the stack

```bash
cp .env.docker.example .env.docker   # then fill in BETTER_AUTH_SECRET and the Google OAuth creds
docker compose up --build
```

- App: <http://localhost:3000>
- Jaeger UI: <http://localhost:16686> (service `content-generator`)
- Collector OTLP: `4318` (HTTP) / `4317` (gRPC)

`migrate` runs `prisma migrate deploy` against the shared `appdata` volume and exits; `app` starts only after it succeeds. Telemetry is opt-in and enabled here by compose setting `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318`.

> **Private registry:** `package-lock.json` resolves from Nubank CodeArtifact, so the build needs an authenticated `~/.npmrc`, passed as a BuildKit secret (never baked into a layer). Compose wires this automatically via the top-level `npmrc` secret. For a bare `docker build`, pass it yourself and make sure your token is fresh (CodeArtifact tokens expire ~12h):
>
> ```bash
> docker build --secret id=npmrc,src=$HOME/.npmrc --target runner -t content-generator .
> ```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
