#!/usr/bin/env bash
# =============================================================================
# init-letsencrypt.sh — Bootstrap Let's Encrypt certificates for the
# production VPS stack.
#
# Prerequisites:
#   1. DNS: an A record for ${DOMAIN} (and optionally www.${DOMAIN}) must
#      already point at the VPS public IP. The ACME http-01 challenge requires
#      Let's Encrypt to reach http://${DOMAIN}/.well-known/acme-challenge/.
#   2. Ports 80 and 443 must be open on the VPS firewall.
#   3. A .env file must exist alongside this script (deploy/production/.env)
#      with at least DOMAIN= and LETSENCRYPT_EMAIL= set.
#   4. Docker and Docker Compose (v2, i.e. `docker compose`) must be installed.
#
# Usage:
#   ./init-letsencrypt.sh           # real certificate (hits LE production)
#   ./init-letsencrypt.sh --staging # staging certificate (no rate-limit risk)
#
# Run this script ONCE before the first `docker compose up`. After it
# completes, start the full stack with:
#   docker compose -f docker-compose.yaml up -d
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve script directory so this always works regardless of $CWD.
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# ---------------------------------------------------------------------------
# Flags
# ---------------------------------------------------------------------------
STAGING=0
for arg in "$@"; do
  case "$arg" in
    --staging) STAGING=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Load .env
# ---------------------------------------------------------------------------
ENV_FILE="${SCRIPT_DIR}/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: .env file not found at ${ENV_FILE}" >&2
  echo "       Copy .env.example to .env and fill in all values." >&2
  exit 1
fi

# Source the .env file — export each KEY=VALUE line, skip comments/blanks.
set -o allexport
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +o allexport

# ---------------------------------------------------------------------------
# Validate required variables
# ---------------------------------------------------------------------------
if [[ -z "${DOMAIN:-}" ]]; then
  echo "ERROR: DOMAIN is not set in ${ENV_FILE}." >&2
  exit 1
fi
if [[ -z "${LETSENCRYPT_EMAIL:-}" ]]; then
  echo "ERROR: LETSENCRYPT_EMAIL is not set in ${ENV_FILE}." >&2
  exit 1
fi

echo "==> Domain:            ${DOMAIN}"
echo "==> Email:             ${LETSENCRYPT_EMAIL}"
echo "==> Staging mode:      ${STAGING}"

# ---------------------------------------------------------------------------
# Confirm options-ssl-nginx.conf is present (we ship it; no download needed)
# ---------------------------------------------------------------------------
SSL_OPTS="${SCRIPT_DIR}/nginx/options-ssl-nginx.conf"
if [[ ! -f "${SSL_OPTS}" ]]; then
  echo "ERROR: ${SSL_OPTS} not found. Re-clone the repo or restore the file." >&2
  exit 1
fi
echo "==> TLS options file:  ${SSL_OPTS} (present)"

# ---------------------------------------------------------------------------
# Create a temporary self-signed dummy certificate so nginx can start before
# the real cert exists (nginx refuses to start if ssl_certificate paths are
# missing). We use a one-shot Alpine/openssl container so there is no host
# dependency on openssl being installed.
# ---------------------------------------------------------------------------
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
echo ""
echo "==> Creating dummy self-signed certificate for ${DOMAIN} ..."
echo "    (nginx needs the cert paths to exist before it will start)"

docker compose -f docker-compose.yaml run --rm --no-deps \
  --volume "certbot-etc:/etc/letsencrypt" \
  --entrypoint "/bin/sh" \
  certbot -c "
    mkdir -p /etc/letsencrypt/live/${DOMAIN} && \
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout /etc/letsencrypt/live/${DOMAIN}/privkey.pem \
      -out    /etc/letsencrypt/live/${DOMAIN}/fullchain.pem \
      -subj   '/CN=${DOMAIN}'
  "

echo "==> Dummy certificate created."

# ---------------------------------------------------------------------------
# Start nginx (and its dependency chain: app → migrate, otel-collector, jaeger)
# so that the ACME http-01 challenge on port 80 can be served.
# ---------------------------------------------------------------------------
echo ""
echo "==> Starting nginx (and dependency stack) ..."
docker compose -f docker-compose.yaml up -d nginx

echo "==> Waiting 5 seconds for nginx to finish starting ..."
sleep 5

# ---------------------------------------------------------------------------
# Delete the dummy certificate so certbot can write the real one.
# ---------------------------------------------------------------------------
echo ""
echo "==> Removing dummy certificate ..."
docker compose -f docker-compose.yaml run --rm --no-deps \
  --volume "certbot-etc:/etc/letsencrypt" \
  --entrypoint "/bin/sh" \
  certbot -c "rm -rf /etc/letsencrypt/live/${DOMAIN} \
                      /etc/letsencrypt/archive/${DOMAIN} \
                      /etc/letsencrypt/renewal/${DOMAIN}.conf"

# ---------------------------------------------------------------------------
# Build certbot arguments
# ---------------------------------------------------------------------------
CERTBOT_ARGS=(
  certonly
  --webroot
  -w /var/www/certbot
  --email "${LETSENCRYPT_EMAIL}"
  --agree-tos
  --no-eff-email
  --force-renewal
  -d "${DOMAIN}"
)

if [[ "${STAGING}" -eq 1 ]]; then
  echo "==> Staging mode: adding --staging flag to certbot call."
  CERTBOT_ARGS+=(--staging)
fi

# ---------------------------------------------------------------------------
# Obtain the real certificate.
# The certbot service's entrypoint is the long-running renewal loop, so we
# MUST override it back to `certbot` here — otherwise CERTBOT_ARGS would be
# passed as ignored positional args to the loop shell and no cert is issued.
# ---------------------------------------------------------------------------
echo ""
echo "==> Requesting certificate from Let's Encrypt ..."
docker compose -f docker-compose.yaml run --rm --no-deps \
  --entrypoint certbot certbot "${CERTBOT_ARGS[@]}"

# ---------------------------------------------------------------------------
# Reload nginx to pick up the real certificate
# ---------------------------------------------------------------------------
echo ""
echo "==> Reloading nginx with the new certificate ..."
docker compose -f docker-compose.yaml exec nginx nginx -s reload

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo " Let's Encrypt certificate successfully obtained!"
echo " Domain:  ${DOMAIN}"
if [[ "${STAGING}" -eq 1 ]]; then
  echo " NOTE: This is a STAGING certificate — browsers will show"
  echo "       an untrusted cert warning. Re-run without --staging"
  echo "       when you are ready to go live."
fi
echo ""
echo " Start the full stack with:"
echo "   docker compose -f docker-compose.yaml up -d"
echo ""
echo " Certbot will auto-renew every 12 hours (if within 30 days"
echo " of expiry). nginx reloads every 6 hours to pick up new certs."
echo "============================================================"
