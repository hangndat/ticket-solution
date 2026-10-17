#!/usr/bin/env bash
# D5 ADR-15 admission S4 isolated smoke (Issue #25).
#
# Exact command (repo root):
#   ./scripts/d5-admission-s4.sh
#
# Proves: nginx admission edge returns 429 + Retry-After under controlled
# overload; Gate path bypasses rate limit. Does NOT run 50k uncontrolled
# opening-shock against Nest/Postgres. Not production admission SLO.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${COMPOSE_PROJECT_NAME:-d5-adm-$$}"
PORT="${D5_ADMISSION_PORT:-18080}"
COMPOSE=(docker compose -p "${PROJECT}" -f "${ROOT}/infra/admission/compose.admission.yaml")
ARTIFACT_DIR="${D5_DRILL_ARTIFACT_DIR:-${TMPDIR:-/tmp}/d5-issue25}"
mkdir -p "${ARTIFACT_DIR}"
RESULT_JSON="${ARTIFACT_DIR}/admission-s4-${PROJECT}.json"

cleanup() {
  "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

export D5_ADMISSION_PORT="${PORT}"
echo "starting admission edge project=${PROJECT} port=${PORT}"
"${COMPOSE[@]}" up -d

ready=0
for _ in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${PORT}/v1/gate/events/x/sessions" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.25
done
if [[ "${ready}" != "1" ]]; then
  echo "admission edge not ready on :${PORT}" >&2
  "${COMPOSE[@]}" logs >&2 || true
  exit 1
fi

# Gate bypass: many rapid requests must stay 200 (no rate limit)
GATE_OK=0
GATE_FAIL=0
for _ in $(seq 1 40); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/v1/gate/events/demo/sessions")"
  if [[ "${code}" == "200" ]]; then
    GATE_OK=$((GATE_OK + 1))
  else
    GATE_FAIL=$((GATE_FAIL + 1))
  fi
done

# Controlled sale overload (not 50k) — expect some 429 with Retry-After
SALE_200=0
SALE_429=0
SALE_OTHER=0
RETRY_AFTER_SEEN=0
for _ in $(seq 1 80); do
  hdrs="$(mktemp)"
  code="$(curl -s -D "${hdrs}" -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/v1/health-sale")"
  case "${code}" in
    200) SALE_200=$((SALE_200 + 1)) ;;
    429)
      SALE_429=$((SALE_429 + 1))
      if grep -qi '^Retry-After:' "${hdrs}"; then
        RETRY_AFTER_SEEN=$((RETRY_AFTER_SEEN + 1))
      fi
      ;;
    *) SALE_OTHER=$((SALE_OTHER + 1)) ;;
  esac
  rm -f "${hdrs}"
done

PASS=0
if [[ "${GATE_OK}" -ge 38 && "${GATE_FAIL}" -eq 0 && "${SALE_429}" -ge 5 && "${RETRY_AFTER_SEEN}" -ge 1 ]]; then
  PASS=1
fi

cat >"${RESULT_JSON}" <<JSON
{
  "drill": "d5-admission-s4",
  "pass": $([[ "${PASS}" == "1" ]] && echo true || echo false),
  "edge": "nginx",
  "port": ${PORT},
  "gateBypass": { "ok": ${GATE_OK}, "fail": ${GATE_FAIL} },
  "saleOverload": {
    "ok200": ${SALE_200},
    "overload429": ${SALE_429},
    "other": ${SALE_OTHER},
    "retryAfterSeen": ${RETRY_AFTER_SEEN}
  },
  "openingShock50k": false,
  "note": "Isolated mock upstream; controlled ~80 sale req; Gate excluded from limit",
  "productionClaim": false
}
JSON

if [[ "${PASS}" != "1" ]]; then
  echo "D5_ADMISSION_S4_FAIL gate_ok=${GATE_OK} sale_429=${SALE_429} retry_after=${RETRY_AFTER_SEEN}" >&2
  echo "artifact=${RESULT_JSON}" >&2
  exit 2
fi

echo "D5_ADMISSION_S4_PASS gate_ok=${GATE_OK} sale_429=${SALE_429} retry_after=${RETRY_AFTER_SEEN}"
echo "artifact=${RESULT_JSON}"
echo "not production admission; S4 50k opening-shock not claimed"
