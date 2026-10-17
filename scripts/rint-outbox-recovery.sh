#!/usr/bin/env bash
# R-INT: outbox durability under Redis loss + worker lease reclaim after crash.
#
# Exact:
#   ./scripts/rint-outbox-recovery.sh
#
# Proves (throwaway Docker Postgres + Redis):
#   1) Outbox PENDING row survives Redis FLUSHALL / container restart.
#   2) Active LEASED row is not double-claimed while lease valid.
#   3) After lease expiry (simulated crashed worker), another lease_owner reclaim.
#
# Does NOT prove: BullMQ, SMTP internet delivery, APNs device, production SLO.
# Never touches ticket_dev / developer DATABASE_URL.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_DIR="${ROOT}/packages/backend/prisma/migrations"
IMAGE="${RINT_POSTGRES_IMAGE:-postgres:18.1-alpine}"
REDIS_IMAGE="${RINT_REDIS_IMAGE:-redis:7-alpine}"
SUFFIX="$(openssl rand -hex 4)"
PG="rint-outbox-pg-${SUFFIX}"
RD="rint-outbox-redis-${SUFFIX}"
DB="rint_outbox"
PW="$(openssl rand -hex 24)"
TENANT_ID="a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1"
OUTBOX_ID="b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2"
AGG_ID="c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3"

cleanup() {
  docker rm -f "${PG}" "${RD}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

case "${PG}${DB}" in
  *ticket_dev*)
    echo "refusing to touch ticket_dev" >&2
    exit 1
    ;;
esac

command -v docker >/dev/null 2>&1 || { echo "docker required" >&2; exit 1; }

MIGRATION_FILES=()
while IFS= read -r migration_file; do
  MIGRATION_FILES+=("${migration_file}")
done < <(find "${MIGRATION_DIR}" -mindepth 2 -maxdepth 2 -name migration.sql | sort)
[[ "${#MIGRATION_FILES[@]}" -gt 0 ]] || { echo "no migrations" >&2; exit 1; }

start_pg() {
  docker run -d \
    --name "${PG}" \
    --label ticket.task=rint-outbox-recovery \
    -e POSTGRES_PASSWORD="${PW}" \
    -e POSTGRES_DB="${DB}" \
    "${IMAGE}" >/dev/null
  for _ in $(seq 1 60); do
    if docker exec "${PG}" pg_isready -h 127.0.0.1 -U postgres -d "${DB}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  echo "postgres not ready" >&2
  return 1
}

psql_q() {
  docker exec -i -e PGPASSWORD="${PW}" "${PG}" \
    psql -h 127.0.0.1 -U postgres -d "${DB}" -v ON_ERROR_STOP=1 -At "$@"
}

echo "starting throwaway ${PG} + ${RD}"
start_pg
docker run -d --name "${RD}" --label ticket.task=rint-outbox-recovery "${REDIS_IMAGE}" >/dev/null
for _ in $(seq 1 40); do
  if docker exec "${RD}" redis-cli ping 2>/dev/null | grep -q PONG; then
    break
  fi
  sleep 0.25
done

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
} | docker exec -i -e PGPASSWORD="${PW}" "${PG}" \
  psql -h 127.0.0.1 -U postgres -d "${DB}" -v ON_ERROR_STOP=1 >/dev/null

# Seed tenant + PENDING outbox (minimal; no ticket required for reclaim/Redis tests)
psql_q -q <<SQL
INSERT INTO tenants (id, slug, name)
VALUES ('${TENANT_ID}', 'rint-a', 'R-INT tenant A (fixture)');
INSERT INTO outbox (
  id, tenant_id, type, aggregate_id, payload, payload_version, status, attempts, created_at, updated_at
) VALUES (
  '${OUTBOX_ID}',
  '${TENANT_ID}',
  'TicketIssued',
  '${AGG_ID}',
  '{"fixture":true}'::jsonb,
  1,
  'PENDING',
  0,
  now(),
  now()
);
SQL

# Redis holds only non-durable cache marker
docker exec "${RD}" redis-cli SET rint:cache:marker volatile-only >/dev/null
docker exec "${RD}" redis-cli FLUSHALL >/dev/null
MARKER="$(docker exec "${RD}" redis-cli GET rint:cache:marker || true)"
[[ -z "${MARKER}" || "${MARKER}" == "(nil)" ]] || { echo "redis flush failed" >&2; exit 1; }

STATUS="$(psql_q -c "SELECT status FROM outbox WHERE id = '${OUTBOX_ID}'::uuid")"
[[ "${STATUS}" == "PENDING" ]] || { echo "outbox lost after redis flush: ${STATUS}" >&2; exit 1; }
echo "RINT_REDIS_LOSS_OUTBOX_INTACT status=PENDING"

# Restart Redis container (AOF wipe is fine — business stays in PG)
docker restart "${RD}" >/dev/null
for _ in $(seq 1 40); do
  if docker exec "${RD}" redis-cli ping 2>/dev/null | grep -q PONG; then
    break
  fi
  sleep 0.25
done
STATUS="$(psql_q -c "SELECT status FROM outbox WHERE id = '${OUTBOX_ID}'::uuid")"
[[ "${STATUS}" == "PENDING" ]] || { echo "outbox lost after redis restart" >&2; exit 1; }
echo "RINT_REDIS_RESTART_OUTBOX_INTACT status=PENDING"

# Superuser can EXECUTE SECURITY DEFINER claim_outbox_batch (GRANT is to ticket_runtime;
# this drill only asserts lease semantics, not RLS of the claim role).
# Claim with short lease (SQL min = 5s)
CLAIM1="$(psql_q -c "SELECT outbox_id::text FROM claim_outbox_batch(10, 'worker-crash-a', 5)")"
echo "${CLAIM1}" | grep -q "${OUTBOX_ID}" || { echo "first claim failed: ${CLAIM1}" >&2; exit 1; }

CLAIM2="$(psql_q -c "SELECT count(*)::text FROM claim_outbox_batch(10, 'worker-other', 5)")"
[[ "${CLAIM2}" == "0" ]] || { echo "double claim while leased: ${CLAIM2}" >&2; exit 1; }
echo "RINT_LEASE_HOLDS_NO_DOUBLE_CLAIM"

echo "waiting for lease expiry (crash reclaim)…"
sleep 6

CLAIM3="$(psql_q -c "SELECT outbox_id::text FROM claim_outbox_batch(10, 'worker-reclaim-b', 5)")"
echo "${CLAIM3}" | grep -q "${OUTBOX_ID}" || { echo "reclaim claim failed: ${CLAIM3}" >&2; exit 1; }
OWNER="$(psql_q -c "SELECT lease_owner FROM outbox WHERE id = '${OUTBOX_ID}'::uuid")"
STATUS="$(psql_q -c "SELECT status FROM outbox WHERE id = '${OUTBOX_ID}'::uuid")"
[[ "${OWNER}" == "worker-reclaim-b" ]] || { echo "reclaim owner wrong: ${OWNER}" >&2; exit 1; }
[[ "${STATUS}" == "LEASED" ]] || { echo "reclaim status wrong: ${STATUS}" >&2; exit 1; }
echo "RINT_WORKER_CRASH_LEASE_RECLAIM owner=worker-reclaim-b"

echo "RINT_OUTBOX_RECOVERY_PASS redis_loss=1 lease_hold=1 reclaim=1"
echo "not BullMQ; not SMTP/APNs delivery; throwaway containers only"
