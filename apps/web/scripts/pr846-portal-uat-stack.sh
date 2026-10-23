#!/usr/bin/env bash
# API + portal only — run portal Notify/Operator UAT (PR #846 section d).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
STATE_DIR="${FE_UAT_STATE_DIR:-${ROOT}/.fe-uat-stack-pr846}"
# shellcheck source=/dev/null
source "${STATE_DIR}/env.sh"

cleanup() {
  [[ -n "${API_PID:-}" ]] && kill "${API_PID}" 2>/dev/null || true
  [[ -n "${PORTAL_PID:-}" ]] && kill "${PORTAL_PID}" 2>/dev/null || true
}
trap cleanup EXIT

(
  cd "${ROOT}"
  export DATABASE_URL="${FE_UAT_RUNTIME_DATABASE_URL}"
  export HOST=127.0.0.1 PORT=3001 NODE_ENV=production
  export OIDC_PROVIDER=keycloak OIDC_ISSUER="${FE_UAT_ISSUER}"
  export OIDC_AUDIENCE=ticket-api OIDC_JWKS_URL="${FE_UAT_ISSUER}/protocol/openid-connect/certs"
  export CODE_HMAC_PEPPER TICKET_CREDENTIAL_KEY EMAIL_ALLOW_NOOP=1
  exec node apps/api/dist/main.js
) &
API_PID=$!

for _ in $(seq 1 120); do
  curl -sf http://127.0.0.1:3001/v1/health | grep -q '"status":"ok"' && break
  sleep 1
done

(
  cd "${ROOT}/apps/portal"
  export API_BASE_URL=http://127.0.0.1:3001 OIDC_ISSUER="${FE_UAT_ISSUER}"
  export OIDC_CLIENT_ID=ticket-admin-web OIDC_CLIENT_SECRET=dev-admin-web-secret-change-me
  export OIDC_REDIRECT_URI=http://127.0.0.1:3013/api/auth/callback
  export OIDC_AUDIENCE=ticket-api OIDC_JWKS_URL="${FE_UAT_ISSUER}/protocol/openid-connect/certs"
  export PORTAL_ORIGIN=http://127.0.0.1:3013
  export PLATFORM_OIDC_CLIENT_ID=ticket-platform-web
  export PLATFORM_OIDC_CLIENT_SECRET=dev-platform-web-secret-change-me
  export PLATFORM_OIDC_REDIRECT_URI=http://127.0.0.1:3013/api/auth/platform/callback
  export PLATFORM_OIDC_AUDIENCE=ticket-platform-api PLATFORM_OIDC_REQUIRED_ACR=2
  export PLATFORM_OIDC_JWKS_URL="${FE_UAT_ISSUER}/protocol/openid-connect/certs"
  exec pnpm exec next start --hostname 127.0.0.1 --port 3013
) &
PORTAL_PID=$!

for _ in $(seq 1 120); do
  if curl -sf http://127.0.0.1:3013/ >/dev/null &&
    curl -sf -o /dev/null -w "%{http_code}" http://127.0.0.1:3013/api/auth/platform/login 2>/dev/null | grep -qE '30[27]'; then
    sleep 5
    break
  fi
  sleep 1
done

node "${ROOT}/apps/web/scripts/pr846-keycloak-staff-reset.mjs"
node "${ROOT}/apps/portal/scripts/pr844-platform-uat.mjs"
node "${ROOT}/apps/portal/scripts/portal-843-notify-uat.mjs"
