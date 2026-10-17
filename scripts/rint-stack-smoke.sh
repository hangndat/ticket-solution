#!/usr/bin/env bash
# R-INT: local reproducible self-host stack smoke (Compose loopback).
#
# Exact:
#   ./scripts/rint-stack-smoke.sh
# Optional bring-up:
#   RINT_STACK_UP=1 ./scripts/rint-stack-smoke.sh
#
# Proves: compose.yaml declares Postgres/Redis/Keycloak/MinIO/Mailpit; env
# manifest keys present in .env.example; optional healthchecks when stack up.
# Does NOT deploy production, create cloud resources, or claim UAT Done.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="${ROOT}/compose.yaml"
ENV_EX="${ROOT}/.env.example"
MANIFEST="${ROOT}/docs/ops/ENV-MANIFEST.md"
ADR17="${ROOT}/docs/ops/ADR-17-OUTBOX-PG-DIRECT.md"

for f in "${COMPOSE}" "${ENV_EX}" "${MANIFEST}" "${ADR17}"; do
  [[ -f "${f}" ]] || { echo "missing ${f}" >&2; exit 1; }
done

grep -q 'image: postgres:' "${COMPOSE}"
grep -q 'image: redis:' "${COMPOSE}"
grep -q 'keycloak' "${COMPOSE}"
grep -q 'minio/minio' "${COMPOSE}"
grep -q 'mailpit' "${COMPOSE}"

# Env names documented (values are placeholders — never assert secrets)
for key in SMTP_URL SMTP_FROM MINIO_ENDPOINT MINIO_BUCKET_ASSETS APNS_ENABLED \
  APNS_KEY_ID APNS_TEAM_ID OUTBOX_POLL_MS PLATFORM_ROOT_DOMAIN; do
  grep -q "${key}" "${ENV_EX}" || grep -q "${key}" "${MANIFEST}" || {
    echo "missing env doc for ${key}" >&2
    exit 1
  }
done

grep -q 'ADR-17' "${ADR17}"
grep -q 'BullMQ' "${ADR17}"

echo "RINT_STACK_MANIFEST_PASS compose+env+adr17"

if [[ "${RINT_STACK_UP:-0}" == "1" ]]; then
  PROJECT="${COMPOSE_PROJECT_NAME:-rint-stack-smoke}"
  case "${PROJECT}" in
    *prod*|*vemoki-prod*)
      echo "refusing production-like COMPOSE_PROJECT_NAME" >&2
      exit 1
      ;;
  esac
  (
    cd "${ROOT}"
    COMPOSE_PROJECT_NAME="${PROJECT}" docker compose up -d --wait postgres redis minio mailpit
  )
  curl -sf "http://127.0.0.1:${MINIO_API_PORT:-9000}/minio/health/live" >/dev/null
  docker exec "$(COMPOSE_PROJECT_NAME="${PROJECT}" docker compose -f "${COMPOSE}" ps -q redis)" \
    redis-cli ping | grep -q PONG
  echo "RINT_STACK_UP_PASS project=${PROJECT}"
  if [[ "${RINT_STACK_DOWN:-1}" == "1" ]]; then
    COMPOSE_PROJECT_NAME="${PROJECT}" docker compose -f "${COMPOSE}" down >/dev/null 2>&1 || true
  fi
else
  echo "RINT_STACK_UP=0 — skipped live compose (set RINT_STACK_UP=1 for health)"
fi

echo "RINT_STACK_SMOKE_PASS"
