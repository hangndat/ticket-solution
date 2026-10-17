#!/usr/bin/env bash
# Validate Issue #25 observability artifacts (no SaaS, no lockfile change).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROM="${ROOT}/infra/observability/prometheus.yml"
COMPOSE="${ROOT}/infra/observability/compose.observability.yaml"
CADY="${ROOT}/infra/admission/Caddyfile.example"
NGINX_ADM="${ROOT}/infra/admission/nginx.conf"
BEARER_EXAMPLE="${ROOT}/infra/observability/secrets/metrics_bearer.example"

for f in "${PROM}" "${COMPOSE}" "${CADY}" "${NGINX_ADM}" "${BEARER_EXAMPLE}"; do
  [[ -f "${f}" ]] || { echo "missing ${f}" >&2; exit 1; }
done

# Must NOT scrape JSON /v1/health as Prometheus metrics_path
if grep -E 'metrics_path:\s*/v1/health' "${PROM}"; then
  echo "prometheus.yml must not use /v1/health as metrics_path" >&2
  exit 1
fi

grep -q 'job_name: postgres-exporter' "${PROM}"
grep -q 'job_name: redis-exporter' "${PROM}"
grep -q 'ticket-api-metrics' "${PROM}"
grep -q 'credentials_file' "${PROM}"
grep -q 'prom/prometheus' "${COMPOSE}"
grep -q 'ADR-15' "${CADY}"
grep -q 'limit_req' "${NGINX_ADM}"
grep -q 'Bearer' "${BEARER_EXAMPLE}" || grep -q 'replace-me' "${BEARER_EXAMPLE}"

# Config parse check when promtool available
if command -v promtool >/dev/null 2>&1; then
  promtool check config "${PROM}"
  echo "promtool: ok"
else
  echo "promtool: skipped (not installed)"
fi

# Optional: bring up overlay and assert exporter scrapes succeed
if [[ "${D5_OBS_UP:-0}" == "1" ]]; then
  COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-d5-obs}" \
    docker compose -f "${ROOT}/compose.yaml" -f "${COMPOSE}" \
    up -d prometheus postgres-exporter redis-exporter postgres redis
  sleep 5
  curl -sf "http://127.0.0.1:${D5_PROM_PORT:-19090}/-/ready" >/dev/null
  # Targets should include exporters (api metrics still deferred)
  targets="$(curl -sf "http://127.0.0.1:${D5_PROM_PORT:-19090}/api/v1/targets")"
  echo "${targets}" | grep -q 'postgres-exporter' || {
    echo "postgres-exporter target missing from prometheus" >&2
    exit 1
  }
  echo "prometheus ready + exporter targets visible on :${D5_PROM_PORT:-19090}"
fi

echo "D5_OBSERVABILITY_SMOKE_PASS"
echo "gap: API Prometheus /metrics text exposition owned by BE dispatch (not this root PR)"
echo "scrape overlay ready: authorization.credentials_file → secrets/metrics_bearer (not logged)"
