#!/usr/bin/env bash
# Actual HTTP scrape of BE GET /metrics (Bearer) — not config grep.
# If this branch lacks apps/api/src/metrics.ts, isolate runtime from D5_METRICS_REF
# (default 1f5fc31) via throwaway worktree — does NOT commit apps into this PR.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REF="${D5_METRICS_REF:-1f5fc31}"
PORT="${D5_METRICS_API_PORT:-13121}"
PG_PORT="${D5_METRICS_PG_PORT:-55471}"
TOKEN="local-metrics-e2e-token"
ARTIFACT="${D5_DRILL_ARTIFACT_DIR:-${TMPDIR:-/tmp}/d5-issue25}"
mkdir -p "${ARTIFACT}"
SUFFIX="$(openssl rand -hex 4)"
PG_NAME="d5-metrics-pg-${SUFFIX}"
DB_NAME="metrics_e2e"
WT=""
API_PID=""
cleanup() {
  [[ -n "${API_PID:-}" ]] && kill "${API_PID}" 2>/dev/null || true
  docker rm -f "${PG_NAME}" >/dev/null 2>&1 || true
  [[ -n "${WT}" && -d "${WT}" ]] && git -C "${ROOT}" worktree remove --force "${WT}" 2>/dev/null || true
}
trap cleanup EXIT

ensure_ref() {
  if git -C "${ROOT}" cat-file -e "${REF}^{commit}" 2>/dev/null; then
    return 0
  fi
  echo "fetching metrics ref ${REF}…"
  git -C "${ROOT}" fetch --depth 1 origin "${REF}" \
    || git -C "${ROOT}" fetch --depth 1 origin hangndat/d4-backend-cs-export \
    || git -C "${ROOT}" fetch --depth 1 origin hangndat/d4-backend-platform-m01
  git -C "${ROOT}" cat-file -e "${REF}^{commit}" 2>/dev/null \
    || { echo "cannot resolve metrics ref ${REF}" >&2; exit 1; }
}

psql_exec() {
  local db="$1"
  shift
  docker exec -i -e PGPASSWORD="${PW}" "${PG_NAME}" \
    psql -h 127.0.0.1 -U postgres -d "${db}" -v ON_ERROR_STOP=1 "$@"
}

wait_pg() {
  for _ in $(seq 1 60); do
    if docker exec "${PG_NAME}" pg_isready -h 127.0.0.1 -U postgres -d "${DB_NAME}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  echo "postgres ${PG_NAME} did not become ready for ${DB_NAME}" >&2
  docker logs "${PG_NAME}" 2>&1 | tail -40 >&2 || true
  return 1
}

SRC="${ROOT}"
if [[ ! -f "${ROOT}/apps/api/src/metrics.ts" ]]; then
  ensure_ref
  WT="$(mktemp -d "${TMPDIR:-/tmp}/d5-metrics-wt.XXXXXX")"
  git -C "${ROOT}" worktree add --detach "${WT}" "${REF}"
  SRC="${WT}"
  (cd "${SRC}" && pnpm install --frozen-lockfile \
    && pnpm --filter @ticket/contracts build \
    && pnpm --filter @ticket/backend build \
    && pnpm --filter @ticket/api build)
elif [[ ! -f "${ROOT}/apps/api/dist/main.js" ]]; then
  (cd "${ROOT}" && pnpm --filter @ticket/contracts build \
    && pnpm --filter @ticket/backend build \
    && pnpm --filter @ticket/api build)
fi

PW="$(openssl rand -hex 12)"
docker run -d --name "${PG_NAME}" --label ticket.task=d5-metrics \
  -e POSTGRES_PASSWORD="${PW}" -e POSTGRES_DB="${DB_NAME}" \
  -p "127.0.0.1:${PG_PORT}:5432" postgres:18.1-alpine >/dev/null
wait_pg

MIGRATION_DIR="${SRC}/packages/backend/prisma/migrations"
MIG_SQL="${ARTIFACT}/metrics-migrate-${SUFFIX}.sql"
{
  echo "CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;"
  echo "CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;"
  echo "GRANT CREATE, USAGE ON SCHEMA public TO migration_owner; SET ROLE migration_owner;"
  find "${MIGRATION_DIR}" -mindepth 2 -maxdepth 2 -name migration.sql | sort | while read -r f; do
    cat "$f"
    echo
  done
  echo "RESET ROLE;"
  echo "CREATE ROLE metrics_rt LOGIN PASSWORD '${PW}' NOSUPERUSER NOBYPASSRLS INHERIT; GRANT ticket_runtime TO metrics_rt;"
} >"${MIG_SQL}"
psql_exec "${DB_NAME}" -q <"${MIG_SQL}" >/dev/null

LOG="${ARTIFACT}/metrics-api-${SUFFIX}.log"
DATABASE_URL="postgresql://metrics_rt:${PW}@127.0.0.1:${PG_PORT}/${DB_NAME}" \
PORT="${PORT}" HOST=127.0.0.1 \
OIDC_ISSUER="${OIDC_ISSUER:-http://127.0.0.1:8080/realms/ticket}" \
OIDC_AUDIENCE=ticket-api \
OIDC_JWKS_URL="${OIDC_JWKS_URL:-http://127.0.0.1:8080/realms/ticket/protocol/openid-connect/certs}" \
CODE_HMAC_PEPPER=local-dev-code-pepper-change-me CODE_HMAC_VERSION=1 \
TICKET_CREDENTIAL_KEY=local-dev-credential-key \
METRICS_TOKEN="${TOKEN}" NODE_ENV=development \
  node "${SRC}/apps/api/dist/main.js" >"${LOG}" 2>&1 &
API_PID=$!

for _ in $(seq 1 80); do
  curl -sf "http://127.0.0.1:${PORT}/v1/health" >/dev/null 2>&1 && break
  if ! kill -0 "${API_PID}" 2>/dev/null; then
    echo "metrics API died; log:" >&2
    tail -n 80 "${LOG}" >&2 || true
    exit 1
  fi
  sleep 0.25
done

CODE401="$(curl -s -o /tmp/m401-${SUFFIX}.txt -w '%{http_code}' "http://127.0.0.1:${PORT}/metrics" || true)"
[[ "${CODE401}" == "401" ]] || {
  echo "expected 401 without bearer, got ${CODE401}; log:" >&2
  tail -n 40 "${LOG}" >&2 || true
  exit 1
}

BODY="$(curl -sf -H "Authorization: Bearer ${TOKEN}" "http://127.0.0.1:${PORT}/metrics")"
echo "${BODY}" | grep -qE '^[a-zA-Z_:#]' || {
  echo "metrics body not prometheus text" >&2
  exit 1
}
if echo "${BODY}" | grep -qiE 'Bearer |password=|@example\.com|ticket_credentials'; then
  echo "metrics leaked sensitive-looking labels" >&2
  exit 1
fi
echo "${BODY}" | grep -qE '# (HELP|TYPE) ' || {
  echo "metrics missing HELP/TYPE lines" >&2
  exit 1
}
OUT="${ARTIFACT}/metrics-scrape-${SUFFIX}.txt"
printf '%s\n' "${BODY}" >"${OUT}"
echo "D5_METRICS_SCRAPE_E2E_PASS port=${PORT} ref=${REF} bytes=$(wc -c <"${OUT}" | tr -d ' ')"
echo "artifact=${OUT}"
