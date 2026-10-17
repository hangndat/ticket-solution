#!/usr/bin/env bash
# Throwaway Keycloak with current realm-ticket.json (task-local ports).
# Does NOT replace shared compose Keycloak / ticket_dev.
#
# Exact:
#   ./scripts/platform-keycloak-task-stack.sh up
#   D5_PLATFORM_OIDC_ISSUER=http://127.0.0.1:18089/realms/ticket \
#     ./scripts/platform-keycloak-assurance-smoke.sh
#   ./scripts/platform-keycloak-task-stack.sh down

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="${D5_PLATFORM_KC_NAME:-d5-platform-kc}"
PORT="${D5_PLATFORM_KC_PORT:-18089}"
IMAGE="${D5_PLATFORM_KC_IMAGE:-quay.io/keycloak/keycloak:26.0}"
CMD="${1:-up}"

case "${CMD}" in
  up)
    docker rm -f "${NAME}" >/dev/null 2>&1 || true
    docker run -d --name "${NAME}" \
      --label ticket.task=d5-platform-keycloak \
      -e KEYCLOAK_ADMIN=admin \
      -e KEYCLOAK_ADMIN_PASSWORD=admin \
      -p "127.0.0.1:${PORT}:8080" \
      -v "${ROOT}/infra/keycloak/realm-ticket.json:/opt/keycloak/data/import/realm-ticket.json:ro" \
      "${IMAGE}" start-dev --import-realm --http-port=8080 >/dev/null
    echo "waiting for Keycloak on :${PORT}"
    for _ in $(seq 1 90); do
      if curl -sf "http://127.0.0.1:${PORT}/realms/ticket/.well-known/openid-configuration" >/dev/null; then
        echo "PLATFORM_KC_TASK_UP name=${NAME} port=${PORT} issuer=http://127.0.0.1:${PORT}/realms/ticket"
        exit 0
      fi
      sleep 2
    done
    echo "Keycloak task stack failed to become ready" >&2
    docker logs "${NAME}" 2>&1 | tail -40 >&2 || true
    exit 1
    ;;
  down)
    docker rm -f "${NAME}" >/dev/null 2>&1 || true
    echo "PLATFORM_KC_TASK_DOWN name=${NAME}"
    ;;
  *)
    echo "usage: $0 up|down" >&2
    exit 2
    ;;
esac
