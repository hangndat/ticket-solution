#!/usr/bin/env bash
# Capture + compare prod-route screenshots: main baseline vs PR (Epic #766 gap 2).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAIN_SHA="${FE_DS_MAIN_SHA:-bfd17c50790ce31c58b63d933773ae4175102058}"
MAIN_WT="${FE_DS_MAIN_WT:-/tmp/fe-ds-main-measure}"
ASSETS="${ROOT}/docs/reviews/assets"
BASE_DIR="${ASSETS}/FE-DS-SLICE0-parity-main"
PR_DIR="${ASSETS}/FE-DS-SLICE0-parity-pr"
WEB_PR_PORT="${FE_DS_PR_WEB_PORT:-3000}"
WEB_MAIN_PORT="${FE_DS_MAIN_WEB_PORT:-3002}"
API_PORT="${FE_UAT_API_PORT:-3001}"

die() { echo "fe-ds-slice0-visual-parity: $*" >&2; exit 1; }

[[ -f "${ROOT}/.fe-uat-stack/env.sh" ]] || die "run ./scripts/fe-uat-stack.sh bootstrap first"

# shellcheck source=/dev/null
source "${ROOT}/.fe-uat-stack/env.sh"
eval "$(cd "${ROOT}" && ./scripts/fe-uat-stack.sh print-env | grep '^export')"

start_api() {
  if curl -sf "http://127.0.0.1:${API_PORT}/v1/public/events" >/dev/null 2>&1; then
    return 0
  fi
  (cd "${ROOT}" && pnpm --filter @ticket/api build >/dev/null)
  unset NODE_ENV
  HOST=127.0.0.1 PORT="${API_PORT}" node "${ROOT}/apps/api/dist/main.js" &
  API_PID=$!
  for _ in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:${API_PORT}/v1/public/events" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  die "API did not start on :${API_PORT}"
}

WEB_PID=""
start_web() {
  local web_root="$1"
  local port="$2"
  unset NODE_ENV
  (
    cd "${web_root}/apps/web"
    export API_BASE_URL="http://127.0.0.1:${API_PORT}"
    export WEB_PUBLIC_ORIGIN="http://127.0.0.1:${port}"
    export PRODUCT_ORIGIN="http://127.0.0.1:${port}"
    exec pnpm exec next start --hostname 127.0.0.1 --port "${port}"
  ) &
  WEB_PID=$!
  for _ in $(seq 1 45); do
    if curl -sf -o /dev/null "http://127.0.0.1:${port}/"; then
      return 0
    fi
    sleep 1
  done
  die "web did not start on :${port} (${web_root})"
}

stop_pid() {
  local p="$1"
  [[ -n "${p}" ]] && kill "${p}" 2>/dev/null || true
  wait "${p}" 2>/dev/null || true
}

ensure_main_build() {
  if [[ ! -d "${MAIN_WT}/apps/web/.next" ]]; then
    die "missing main worktree build at ${MAIN_WT} — checkout ${MAIN_SHA} and turbo build"
  fi
}

API_PID=""
trap 'stop_pid "${WEB_PID}"; [[ -n "${API_PID}" ]] && stop_pid "${API_PID}"' EXIT

ensure_main_build
start_api
API_PID=$(lsof -tiTCP:"${API_PORT}" -sTCP:LISTEN | head -1 || true)

mkdir -p "${BASE_DIR}" "${PR_DIR}"

echo "== capture main @ ${MAIN_SHA} :${WEB_MAIN_PORT}"
start_web "${MAIN_WT}" "${WEB_MAIN_PORT}"
node "${ROOT}/apps/web/tests/fe-ds-slice0-visual-parity.mjs" capture "${BASE_DIR}" "http://127.0.0.1:${WEB_MAIN_PORT}"
stop_pid "${WEB_PID}"
WEB_PID=""

echo "== capture PR :${WEB_PR_PORT}"
start_web "${ROOT}" "${WEB_PR_PORT}"
node "${ROOT}/apps/web/tests/fe-ds-slice0-visual-parity.mjs" capture "${PR_DIR}" "http://127.0.0.1:${WEB_PR_PORT}"
stop_pid "${WEB_PID}"
WEB_PID=""

echo "== compare"
node "${ROOT}/apps/web/tests/fe-ds-slice0-visual-parity.mjs" compare "${BASE_DIR}" "${PR_DIR}"
echo "fe-ds-slice0-visual-parity: OK (all diffPixels=0)"
