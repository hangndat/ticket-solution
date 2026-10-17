#!/usr/bin/env bash
# D5 load / admission baseline (Issue #25) — real API + Postgres + OIDC.
#
# Exact command (repo root):
#   ./scripts/d5-load-baseline.sh
#
# Env (optional):
#   D5_LOAD_TICKETS_PER_EVENT   default 20000 (PRD pilot). Use 500 for smoke.
#   D5_LOAD_SCANNERS            default 50 per event
#   D5_LOAD_EVENTS              default 2
#   D5_LOAD_ISSUE_RATE          default 50 (issue/s, TD S3)
#   D5_LOAD_CONFIRM_RATE        default 20 (confirm/s, TD S3)
#   D5_LOAD_SUSTAIN_SEC         default 60 (concurrent issue+confirm)
#   D5_LOAD_ISSUE_HTTP_COUNT    default rate×sustain (authenticated issue pool)
#   D5_LOAD_API_PORT            default 13101 (task-specific; avoids :3001)
#   D5_LOAD_PG_PORT             default 55452
#   D5_LOAD_OIDC_ISSUER         default http://127.0.0.1:8080/realms/ticket
#   D5_LOAD_SKIP_BUILD=1        skip pnpm build if dist already present
#
# Uses throwaway Postgres (docker label ticket.task=d5-load). Does not touch
# ticket_dev / compose project ticket-solution volumes.
# Admission edge: ./scripts/d5-admission-s4.sh (isolated; Gate bypass).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

export D5_LOAD_TICKETS_PER_EVENT="${D5_LOAD_TICKETS_PER_EVENT:-20000}"
export D5_LOAD_SCANNERS="${D5_LOAD_SCANNERS:-50}"
export D5_LOAD_EVENTS="${D5_LOAD_EVENTS:-2}"
export D5_LOAD_ISSUE_RATE="${D5_LOAD_ISSUE_RATE:-50}"
export D5_LOAD_CONFIRM_RATE="${D5_LOAD_CONFIRM_RATE:-20}"
export D5_LOAD_SUSTAIN_SEC="${D5_LOAD_SUSTAIN_SEC:-60}"
export D5_LOAD_API_PORT="${D5_LOAD_API_PORT:-13101}"
export D5_LOAD_PG_PORT="${D5_LOAD_PG_PORT:-55452}"
if [[ -z "${D5_LOAD_OIDC_ISSUER:-}" ]]; then
  # Prefer issuer claim from live discovery (may be LAN hostname, not 127.0.0.1).
  D5_LOAD_OIDC_ISSUER="$(
    curl -sf http://127.0.0.1:8080/realms/ticket/.well-known/openid-configuration \
      | python3 -c 'import json,sys; print(json.load(sys.stdin)["issuer"].rstrip("/"))' \
      2>/dev/null || true
  )"
  D5_LOAD_OIDC_ISSUER="${D5_LOAD_OIDC_ISSUER:-http://127.0.0.1:8080/realms/ticket}"
fi
export D5_LOAD_OIDC_ISSUER
export D5_LOAD_ARTIFACT_DIR="${D5_LOAD_ARTIFACT_DIR:-${TMPDIR:-/tmp}/d5-issue25}"
mkdir -p "${D5_LOAD_ARTIFACT_DIR}"
echo "OIDC issuer: ${D5_LOAD_OIDC_ISSUER}"

HW_NCPU="$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo unknown)"
HW_MEM_BYTES="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
export D5_LOAD_HW_NCPU="${HW_NCPU}"
export D5_LOAD_HW_MEM_GB="$((HW_MEM_BYTES / 1024 / 1024 / 1024))"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi
if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 is required (Homebrew k6). No npm dependency added." >&2
  exit 1
fi
if ! curl -sf "${D5_LOAD_OIDC_ISSUER}/.well-known/openid-configuration" >/dev/null; then
  echo "OIDC issuer unreachable: ${D5_LOAD_OIDC_ISSUER}" >&2
  echo "Start Keycloak (e.g. docker compose up -d keycloak) without replacing this task DB." >&2
  exit 1
fi

if [[ "${D5_LOAD_SKIP_BUILD:-0}" != "1" ]]; then
  pnpm --filter @ticket/contracts build
  pnpm --filter @ticket/backend build
  pnpm --filter @ticket/api build
fi

node "${ROOT}/scripts/d5-load-baseline.mjs"
