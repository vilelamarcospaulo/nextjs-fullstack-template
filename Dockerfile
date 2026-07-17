# syntax=docker/dockerfile:1.7
# =============================================================================
# Stage 1 — deps
# Install all dependencies (including devDeps). The `pg` driver used by
# Drizzle ORM is pure JS (speaks the Postgres wire protocol over TCP), so no
# native build toolchain is required here. NODE_ENV is intentionally NOT set
# to "production" here — setting it would cause npm ci to skip devDependencies,
# which breaks `next build` (needs TypeScript, next, etc).
# =============================================================================
FROM node:24-bookworm-slim AS deps

WORKDIR /app

# Copy manifests first for optimal layer caching.
# npm ci requires both files; fall back to npm install only if the lockfile is
# out of sync (the || guard handles a stale lockfile without breaking the build).
COPY package.json package-lock.json ./

# Install with an optional private-registry credential.
#   This repo's package-lock.json resolves every package from a private registry
#   (Nubank CodeArtifact), so the install needs an authenticated .npmrc. It is
#   provided as a BuildKit secret mounted only for this layer — the token never
#   lands in an image layer or the build cache. Build with:
#     docker build --secret id=npmrc,src=$HOME/.npmrc ...
#   required=false keeps the template portable: if the lockfile points at the
#   public npm registry instead, omit the secret and this still works.
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    npm ci --include=dev || npm install --no-audit --no-fund

# =============================================================================
# Stage 2 — builder
# Run next build. The Drizzle ORM schema is plain TypeScript (no code
# generation step needed). It uses the pg driver to connect to Postgres.
# =============================================================================
FROM deps AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Build-time-only placeholder env. src/lib/env.ts validates these five vars at
# import time and throws if any is empty; `next build` imports them while
# collecting page data for the auth route (/api/auth/[...all]), so the build
# fails without them. These are throwaway non-secrets that exist ONLY in this
# builder stage (discarded in the final image) — the runner receives the real
# values at runtime from docker-compose / the container env. Mirrors the dummy
# values used by the CI build job.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build_placeholder" \
    BETTER_AUTH_SECRET="build-time-dummy-secret-not-used-at-runtime" \
    BETTER_AUTH_URL="http://localhost:3000" \
    GOOGLE_CLIENT_ID="build-time-dummy-client-id" \
    GOOGLE_CLIENT_SECRET="build-time-dummy-client-secret"

# Copy the full source tree. node_modules is already present from the deps
# stage. The .dockerignore ensures node_modules, .next, secrets, and test
# artefacts are excluded from the build context.
COPY . .

# Build the Next.js application. output: "standalone" is already configured in
# next.config.ts, so this produces:
#   .next/standalone  — server.js + traced node_modules
#   .next/static      — hashed static assets
RUN npm run build

# =============================================================================
# Stage 3 — migrator  (target: migrator)
# Lightweight one-shot stage used by a Compose service to run
# `drizzle-kit migrate` before the app starts. It needs:
#   - drizzle-kit CLI (present in node_modules from the deps stage)
#   - drizzle/migrations/, drizzle.config.ts
#   - DATABASE_URL supplied at runtime via environment / Compose
# =============================================================================
FROM node:24-bookworm-slim AS migrator

WORKDIR /app

# Copy node_modules (with drizzle-kit CLI) and Drizzle config/migrations.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

CMD ["npx", "drizzle-kit", "migrate"]

# =============================================================================
# Stage 4 — runner  (target: runner)
# Minimal production runtime. No build tooling, no devDependencies — the
# standalone output already contains only the traced runtime node_modules
# needed to serve the app (the `pg` driver connects to Postgres over TCP, no
# native binary involved). Runs as the unprivileged `node` user that ships in
# the official image.
# =============================================================================
FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Bind to all interfaces (not to the container hostname Docker injects) and
# expose the canonical port. Next standalone server.js reads both env vars.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

# Copy standalone output (includes server.js + traced node_modules), static
# assets, and public directory.
COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static
COPY --chown=node:node --from=builder /app/public ./public

USER node

# Simple Node-based health check — avoids a curl/wget dependency in slim.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/', (r) => process.exit(r.statusCode >= 200 && r.statusCode < 400 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
