#!/usr/bin/env bash
# Run PR #846 cutover UAT with local API + web + portal (fixture stack).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
STATE_DIR="${FE_UAT_STATE_DIR:-${ROOT}/.fe-uat-stack-pr846}"
# shellcheck source=/dev/null
source "${STATE_DIR}/env.sh"

export API_BASE_URL=http://127.0.0.1:3001
export PORTAL_ORIGIN=http://127.0.0.1:3013
export WEB_BASE_URL=http://127.0.0.1:3000

cleanup() {
  [[ -n "${API_PID:-}" ]] && kill "${API_PID}" 2>/dev/null || true
  [[ -n "${WEB_PID:-}" ]] && kill "${WEB_PID}" 2>/dev/null || true
  [[ -n "${PORTAL_PID:-}" ]] && kill "${PORTAL_PID}" 2>/dev/null || true
}
trap cleanup EXIT

(
  cd "${ROOT}"
  export DATABASE_URL="${FE_UAT_RUNTIME_DATABASE_URL}"
  export HOST=127.0.0.1 PORT=3001 NODE_ENV=production
  export OIDC_PROVIDER=keycloak OIDC_ISSUER="${FE_UAT_ISSUER}"
  export OIDC_AUDIENCE=ticket-api OIDC_JWKS_URL="${FE_UAT_ISSUER}/protocol/openid-connect/certs"
  export CODE_HMAC_PEPPER TICKET_CREDENTIAL_KEY EMAIL_ALLOW_NOOP=1 SINGLE_CODE_RESOLVE_GLOBAL=1
  exec node apps/api/dist/main.js
) &
API_PID=$!

(
  cd "${ROOT}/apps/web"
  export API_BASE_URL OIDC_ISSUER="${FE_UAT_ISSUER}"
  export OIDC_CLIENT_ID=ticket-web OIDC_CLIENT_SECRET=dev-web-secret-change-me
  export OIDC_REDIRECT_URI=http://127.0.0.1:3000/api/auth/callback
  export OIDC_AUDIENCE=ticket-api OIDC_JWKS_URL="${FE_UAT_ISSUER}/protocol/openid-connect/certs"
  export WEB_PUBLIC_ORIGIN=http://127.0.0.1:3000 PRODUCT_ORIGIN=http://127.0.0.1:3000
  export PORTAL_ORIGIN NEXT_PUBLIC_SINGLE_CODE_RESOLVE=1
  exec pnpm exec next start --hostname 127.0.0.1 --port 3000
) &
WEB_PID=$!

(
  cd "${ROOT}/apps/portal"
  export API_BASE_URL OIDC_ISSUER="${FE_UAT_ISSUER}"
  export OIDC_CLIENT_ID=ticket-admin-web OIDC_CLIENT_SECRET=dev-admin-web-secret-change-me
  export OIDC_REDIRECT_URI=http://127.0.0.1:3013/api/auth/callback
  export OIDC_AUDIENCE=ticket-api OIDC_JWKS_URL="${FE_UAT_ISSUER}/protocol/openid-connect/certs"
  export PORTAL_ORIGIN
  export PLATFORM_OIDC_CLIENT_ID=ticket-platform-web
  export PLATFORM_OIDC_CLIENT_SECRET=dev-platform-web-secret-change-me
  export PLATFORM_OIDC_REDIRECT_URI=http://127.0.0.1:3013/api/auth/platform/callback
  export PLATFORM_OIDC_AUDIENCE=ticket-platform-api PLATFORM_OIDC_REQUIRED_ACR=2
  export PLATFORM_OIDC_JWKS_URL="${FE_UAT_ISSUER}/protocol/openid-connect/certs"
  exec pnpm exec next start --hostname 127.0.0.1 --port 3013
) &
PORTAL_PID=$!

for _ in $(seq 1 60); do
  curl -sf http://127.0.0.1:3001/v1/health >/dev/null &&
    curl -sf http://127.0.0.1:3000/ >/dev/null &&
    curl -sf http://127.0.0.1:3013/ >/dev/null && break
  sleep 1
done

cd "${ROOT}"
WEB_UAT_CHANNEL="${WEB_UAT_CHANNEL:-chrome}" node apps/web/scripts/pr846-cutover-uat.mjs
