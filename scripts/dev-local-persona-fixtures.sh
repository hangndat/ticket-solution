#!/usr/bin/env bash
# VCX-925 — idempotent persona OIDC + volume fixtures for UI869 local stack only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STATE_DIR="${UI869_DEV_STATE_DIR:-${ROOT}/.local-dev/ui869}"
ENV_FILE="${STATE_DIR}/env.sh"
API_PORT="${UI869_API_PORT:-3498}"

die() { echo "dev-local-persona-fixtures: $*" >&2; exit 1; }

if [[ ! -f "${ENV_FILE}" ]]; then
  die "missing ${ENV_FILE} — run ./scripts/dev-local-stack.sh up (or seed --reset) first"
fi
# shellcheck source=/dev/null
source "${ENV_FILE}"

export DATABASE_URL="${UI869_ADMIN_DATABASE_URL}"
export OIDC_ISSUER="${UI869_OIDC_ISSUER}"
export UI869_API_URL="http://127.0.0.1:${API_PORT}"
export CODE_HMAC_PEPPER="${UI869_CODE_HMAC_PEPPER}"
export CODE_HMAC_VERSION="${UI869_CODE_HMAC_VERSION}"

node -e "
  import('./scripts/lib/ui869-fixture-guard.mjs').then(m =>
    m.assertUi869FixtureTarget(process.env)
  );
" || die "fixture target guard failed — refused to run"

pnpm --filter @ticket/backend build >/dev/null

log() { echo "dev-local-persona-fixtures: $*"; }

log "ensuring Keycloak persona users (loopback realm only)"
node "${ROOT}/scripts/lib/ui869-keycloak-personas.mjs" || die "Keycloak persona upsert failed"

log "seeding persona memberships + volume data (idempotent)"
node "${ROOT}/scripts/dev-local-persona-seed.cjs" || die "persona DB seed failed"

if curl -sf "http://127.0.0.1:${API_PORT}/v1/health" >/dev/null 2>&1; then
  log "running API verification matrix"
  node "${ROOT}/scripts/dev-local-persona-verify.mjs" || die "persona verify failed"
else
  log "SKIP verify — API :${API_PORT} not reachable (seed still applied)"
fi

log "OK"
