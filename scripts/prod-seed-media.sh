#!/usr/bin/env bash
# Epic #686: upload prod raster pack to MinIO (idempotent, checksum).
#
#   PROD_MEDIA_CONFIRM=1 ./scripts/prod-seed-media.sh
#   PROD_MEDIA_DRY_RUN=1 ./scripts/prod-seed-media.sh
#   D9_MEDIA_STACK_UP=1 PROD_MEDIA_CONFIRM=1 ./scripts/prod-seed-media.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

# Reuse MinIO bring-up from D9 script when requested.
if [[ -f "${ROOT}/scripts/d9-seed-media.sh" ]]; then
  # shellcheck disable=SC1091
  source /dev/null
fi

CONTAINER_NAME="${D9_MEDIA_MINIO_NAME:-ticket-prod-media-minio}"
MINIO_PORT="${D9_MEDIA_MINIO_PORT:-9000}"
CLEANSTART_IMAGE="${D9_MEDIA_MINIO_IMAGE:-cleanstart/minio:latest}"

minio_live() {
  local endpoint="${1}"
  curl -sf "${endpoint%/}/minio/health/live" >/dev/null 2>&1
}

start_cleanstart_minio() {
  local data_dir="${TMPDIR:-/tmp}/${CONTAINER_NAME}-data"
  mkdir -p "${data_dir}"
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  docker run -d --name "${CONTAINER_NAME}" --user root \
    -e "MINIO_ROOT_USER=${MINIO_ROOT_USER:-minioadmin}" \
    -e "MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-minioadmin}" \
    -p "127.0.0.1:${MINIO_PORT}:9000" \
    -v "${data_dir}:/data" \
    "${CLEANSTART_IMAGE}" \
    server /data --address ':9000' >/dev/null

  local endpoint="http://127.0.0.1:${MINIO_PORT}"
  local i
  for i in $(seq 1 80); do
    if minio_live "${endpoint}"; then
      echo "MinIO ready (cleanstart fallback) at ${endpoint}"
      export MINIO_ENDPOINT="${endpoint}"
      return 0
    fi
    sleep 0.4
  done
  echo "cleanstart MinIO failed to become healthy at ${endpoint}" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  return 1
}

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

export MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://127.0.0.1:9000}"
export MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-${MINIO_ROOT_USER:-minioadmin}}"
export MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-${MINIO_ROOT_PASSWORD:-minioadmin}}"
export MINIO_BUCKET_ASSETS="${MINIO_BUCKET_ASSETS:-vemoki-assets}"
export MINIO_REGION="${MINIO_REGION:-us-east-1}"

if [[ "${D9_MEDIA_STACK_UP:-}" == "1" ]]; then
  if minio_live "${MINIO_ENDPOINT}"; then
    echo "MinIO already live at ${MINIO_ENDPOINT}"
  else
    if docker compose up -d minio --wait 2>/tmp/prod-minio-compose.err; then
      echo "MinIO via compose at ${MINIO_ENDPOINT}"
    else
      echo "compose minio unavailable; falling back to ${CLEANSTART_IMAGE}" >&2
      cat /tmp/prod-minio-compose.err >&2 || true
      start_cleanstart_minio
    fi
  fi
fi

exec node "${ROOT}/scripts/prod-seed-media.mjs" "$@"
