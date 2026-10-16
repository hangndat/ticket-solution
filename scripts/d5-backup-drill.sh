#!/usr/bin/env bash
# D5 local backup/restore drill (Issue #25).
#
# Exact command, from the repository root:
#   ./scripts/d5-backup-drill.sh
#
# What a pass proves: one marked fixture row, inserted after the backend
# Prisma migrations on a throwaway Postgres container, is still present after
# pg_dump and restore into a second throwaway database on a second container.
#
# What a pass does not prove: a production backup, an RPO/RTO or other SLO,
# observability, or a load/admission result. Load/admission is not measured.
# This script never connects to ticket_dev or any developer database URL.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_DIR="${ROOT}/packages/backend/prisma/migrations"
IMAGE="${D5_DRILL_POSTGRES_IMAGE:-postgres:18.1-alpine}"
SUFFIX="$(openssl rand -hex 4)"
SRC="d5-backup-drill-src-${SUFFIX}"
DST="d5-backup-drill-dst-${SUFFIX}"
SRC_DB="drill_src"
DST_DB="drill_dst"
PW="$(openssl rand -hex 24)"
DUMP="$(mktemp "${TMPDIR:-/tmp}/d5-backup-drill.XXXXXX.sql")"
FIXTURE_ID="d5f11111-1111-4111-8111-111111111111"
FIXTURE_SLUG="d5-backup-drill-fixture"
FIXTURE_NAME="D5 backup drill fixture (marked, not production)"

cleanup() {
  docker rm -f "${SRC}" "${DST}" >/dev/null 2>&1 || true
  rm -f "${DUMP}"
}
trap cleanup EXIT

case "${SRC}${DST}${SRC_DB}${DST_DB}" in
  *ticket_dev*)
    echo "refusing to touch ticket_dev" >&2
    exit 1
    ;;
esac

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

MIGRATION_FILES=()
while IFS= read -r migration_file; do
  MIGRATION_FILES+=("${migration_file}")
done < <(find "${MIGRATION_DIR}" -mindepth 2 -maxdepth 2 -name migration.sql | sort)
if [[ "${#MIGRATION_FILES[@]}" -eq 0 ]]; then
  echo "no backend migrations found under ${MIGRATION_DIR}" >&2
  exit 1
fi

start_pg() {
  local name="$1"
  local db="$2"
  docker run -d \
    --name "${name}" \
    --label ticket.task=d5-backup-drill \
    -e POSTGRES_PASSWORD="${PW}" \
    -e POSTGRES_DB="${db}" \
    "${IMAGE}" >/dev/null
  local attempt
  for attempt in $(seq 1 60); do
    if docker exec "${name}" pg_isready -h 127.0.0.1 -U postgres -d "${db}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  echo "postgres ${name} did not become ready" >&2
  return 1
}

psql_exec() {
  local name="$1"
  local db="$2"
  docker exec -i -e PGPASSWORD="${PW}" "${name}" \
    psql -h 127.0.0.1 -U postgres -d "${db}" -v ON_ERROR_STOP=1
}

echo "starting throwaway source ${SRC} (${IMAGE}, database ${SRC_DB})"
start_pg "${SRC}" "${SRC_DB}"

{
  cat <<'SQL'
CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT CREATE, USAGE ON SCHEMA public TO migration_owner;
SET ROLE migration_owner;
SQL
  for file in "${MIGRATION_FILES[@]}"; do
    cat "${file}"
    printf '\n'
  done
  printf 'RESET ROLE;\n'
} | psql_exec "${SRC}" "${SRC_DB}" >/dev/null

psql_exec "${SRC}" "${SRC_DB}" >/dev/null <<SQL
INSERT INTO tenants (id, slug, name)
VALUES ('${FIXTURE_ID}', '${FIXTURE_SLUG}', '${FIXTURE_NAME}');
SQL

echo "dumping ${SRC_DB}"
docker exec -e PGPASSWORD="${PW}" "${SRC}" \
  pg_dump -h 127.0.0.1 -U postgres -d "${SRC_DB}" --format=plain \
  >"${DUMP}"

echo "starting throwaway restore target ${DST} (database ${DST_DB})"
start_pg "${DST}" "${DST_DB}"

psql_exec "${DST}" "${DST_DB}" >/dev/null <<'SQL'
CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
SQL

echo "restoring dump into ${DST_DB}"
psql_exec "${DST}" "${DST_DB}" <"${DUMP}" >/dev/null

RESULT="$(psql_exec "${DST}" "${DST_DB}" <<SQL
SELECT slug || '|' || name
FROM tenants
WHERE id = '${FIXTURE_ID}'::uuid
  AND slug = '${FIXTURE_SLUG}';
SQL
)"

if [[ "${RESULT}" != *"${FIXTURE_SLUG}|${FIXTURE_NAME}"* ]]; then
  echo "fixture row missing after restore" >&2
  echo "${RESULT}" >&2
  exit 1
fi

echo "D5_BACKUP_DRILL_PASS fixture=${FIXTURE_SLUG} restored=1 source=${SRC_DB} target=${DST_DB}"
echo "not a production backup; no SLO claimed; load/admission is not measured"
echo "tearing down ${SRC} and ${DST}"
