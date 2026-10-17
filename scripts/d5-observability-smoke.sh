#!/usr/bin/env bash
# Validate Issue #25 observability artifacts (no SaaS, no lockfile change).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROM="${ROOT}/infra/observability/prometheus.yml"
COMPOSE="${ROOT}/infra/observability/compose.observability.yaml"
CADY="${ROOT}/infra/admission/Caddyfile.example"

for f in "${PROM}" "${COMPOSE}" "${CADY}"; do
  [[ -f "${f}" ]] || { echo "missing ${f}" >&2; exit 1; }
done

grep -q 'job_name: ticket-api-health' "${PROM}"
grep -q 'postgres-exporter' "${PROM}"
grep -q 'redis-exporter' "${PROM}"
grep -q 'prom/prometheus' "${COMPOSE}"
grep -q 'ADR-15' "${CADY}"

# Config parse check when promtool available
if command -v promtool >/dev/null 2>&1; then
  promtool check config "${PROM}"
  echo "promtool: ok"
else
  echo "promtool: skipped (not installed)"
fi

# Optional: bring up overlay briefly if D5_OBS_UP=1
if [[ "${D5_OBS_UP:-0}" == "1" ]]; then
  COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-d5-obs}" \
    docker compose -f "${ROOT}/compose.yaml" -f "${COMPOSE}" \
    up -d prometheus postgres-exporter redis-exporter postgres redis
  sleep 3
  curl -sf "http://127.0.0.1:${D5_PROM_PORT:-19090}/-/ready" >/dev/null
  echo "prometheus ready on :${D5_PROM_PORT:-19090}"
fi

echo "D5_OBSERVABILITY_SMOKE_PASS"
echo "gap: API Prometheus /metrics text exposition owned by BE dispatch (not this root PR)"
