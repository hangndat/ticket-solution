#!/usr/bin/env bash
# D5 business + key-state restore drill (Issue #25).
#
# Exact command (repo root):
#   ./scripts/d5-business-restore-drill.sh
#
# Pass proves: after Prisma migrations on a throwaway Postgres, a marked
# business graph (2 tenants × 2 events, inventory, issued tickets,
# ticket_credentials.kid, sample check-in, HMAC pepper version) survives
# pg_dump → restore on a second throwaway DB, with invariant checks.
#
# Does NOT prove: production backup, continuous RPO, PITR, or load/admission.
# RTO below is wall-clock dump+restore on this host only (hardware-bound).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_DIR="${ROOT}/packages/backend/prisma/migrations"
IMAGE="${D5_DRILL_POSTGRES_IMAGE:-postgres:18.1-alpine}"
SUFFIX="$(openssl rand -hex 4)"
SRC="d5-biz-restore-src-${SUFFIX}"
DST="d5-biz-restore-dst-${SUFFIX}"
SRC_DB="drill_biz_src"
DST_DB="drill_biz_dst"
PW="$(openssl rand -hex 24)"
DUMP="$(mktemp "${TMPDIR:-/tmp}/d5-biz-restore.XXXXXX.sql")"
ARTIFACT_DIR="${D5_DRILL_ARTIFACT_DIR:-${TMPDIR:-/tmp}/d5-issue25}"
mkdir -p "${ARTIFACT_DIR}"
RESULT_JSON="${ARTIFACT_DIR}/business-restore-${SUFFIX}.json"

TENANT_A="a1111111-1111-4111-8111-111111111111"
TENANT_B="b2222222-2222-4222-8222-222222222222"
EVENT_A1="e1111111-1111-4111-8111-111111111111"
EVENT_A2="e1222222-2222-4222-8222-222222222222"
EVENT_B1="e2111111-1111-4111-8111-111111111111"
EVENT_B2="e2222222-2222-4222-8222-222222222222"
USER_OWNER="01111111-1111-4111-8111-111111111111"
USER_STAFF="02222222-2222-4222-8222-222222222222"
TYPE_A1="aa111111-1111-4111-8111-111111111111"
SRC_A1="bb111111-1111-4111-8111-111111111111"
CODE_A1="cc111111-1111-4111-8111-111111111111"
REQ_A1="dd111111-1111-4111-8111-111111111111"
TICKET_A1="ee111111-1111-4111-8111-111111111111"
SESS_A1="ff111111-1111-4111-8111-111111111111"
RES_A1="d1111111-1111-4111-8111-111111111111"
CHECK_A1="c1111111-1111-4111-8111-111111111111"
MEMBER_A="ab111111-1111-4111-8111-111111111111"
ASSIGN_A="ac111111-1111-4111-8111-111111111111"
KID="drill-local-v1"
CODE_HMAC="deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
TOKEN_HASH="cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe"
ENC_TOKEN="enc:drill-fixture-not-a-real-qr"

cleanup() {
  docker rm -f "${SRC}" "${DST}" >/dev/null 2>&1 || true
  rm -f "${DUMP}"
}
trap cleanup EXIT

case "${SRC}${DST}${SRC_DB}${DST_DB}" in
  *ticket_dev*|*ticket_solution*)
    echo "refusing to touch shared developer databases" >&2
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
    --label ticket.task=d5-business-restore \
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
    psql -h 127.0.0.1 -U postgres -d "${db}" -v ON_ERROR_STOP=1 -qAt
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
INSERT INTO tenants (id, slug, name) VALUES
  ('${TENANT_A}', 'd5-biz-tenant-a', 'D5 business restore tenant A'),
  ('${TENANT_B}', 'd5-biz-tenant-b', 'D5 business restore tenant B');

INSERT INTO events (tenant_id, id, slug, name, status, timezone) VALUES
  ('${TENANT_A}', '${EVENT_A1}', 'event-a1', 'Event A1', 'PUBLISHED', 'Asia/Ho_Chi_Minh'),
  ('${TENANT_A}', '${EVENT_A2}', 'event-a2', 'Event A2', 'PUBLISHED', 'Asia/Ho_Chi_Minh'),
  ('${TENANT_B}', '${EVENT_B1}', 'event-b1', 'Event B1', 'PUBLISHED', 'Asia/Ho_Chi_Minh'),
  ('${TENANT_B}', '${EVENT_B2}', 'event-b2', 'Event B2', 'PUBLISHED', 'Asia/Ho_Chi_Minh');

INSERT INTO users (id, issuer, subject, email, email_verified) VALUES
  ('${USER_OWNER}', 'http://127.0.0.1:8080/realms/ticket', 'drill-owner', 'owner-drill@example.com', true),
  ('${USER_STAFF}', 'http://127.0.0.1:8080/realms/ticket', 'drill-staff', 'staff-drill@example.com', true);

INSERT INTO memberships (id, tenant_id, user_id, role, permissions, activated_at)
VALUES (
  '${MEMBER_A}', '${TENANT_A}', '${USER_STAFF}', 'STAFF',
  ARRAY['gate.confirm','gate.undo','ticket.revoke']::text[], now()
);
INSERT INTO event_assignments (id, tenant_id, event_id, membership_id, permissions, activated_at)
VALUES (
  '${ASSIGN_A}', '${TENANT_A}', '${EVENT_A1}', '${MEMBER_A}',
  ARRAY['gate.confirm','gate.undo','ticket.revoke']::text[], now()
);

INSERT INTO ticket_types (tenant_id, event_id, id, label)
VALUES ('${TENANT_A}', '${EVENT_A1}', '${TYPE_A1}', 'General');
INSERT INTO issuance_sources (tenant_id, event_id, id, name, approval_mode)
VALUES ('${TENANT_A}', '${EVENT_A1}', '${SRC_A1}', 'VIP', 'AUTO');
INSERT INTO source_ticket_types (tenant_id, event_id, source_id, ticket_type_id)
VALUES ('${TENANT_A}', '${EVENT_A1}', '${SRC_A1}', '${TYPE_A1}');
INSERT INTO quota_buckets (tenant_id, event_id, id, scope, scope_id, capacity, allocated)
VALUES
  ('${TENANT_A}', '${EVENT_A1}', 'ad111111-1111-4111-8111-111111111111', 'EVENT', NULL, 20000, 1),
  ('${TENANT_A}', '${EVENT_A1}', 'ae222222-2222-4222-8222-222222222222', 'TICKET_TYPE', '${TYPE_A1}', 20000, 1),
  ('${TENANT_A}', '${EVENT_A1}', 'af333333-3333-4333-8333-333333333333', 'ISSUANCE_SOURCE', '${SRC_A1}', 20000, 1);

INSERT INTO redemption_codes (
  tenant_id, event_id, id, code_hmac, code_pepper_version, source_id, ticket_type_id, status
) VALUES (
  '${TENANT_A}', '${EVENT_A1}', '${CODE_A1}', '${CODE_HMAC}', 1, '${SRC_A1}', '${TYPE_A1}', 'CONSUMED'
);

INSERT INTO redemption_requests (
  tenant_id, event_id, id, actor_user_id, redemption_code_id, status
) VALUES (
  '${TENANT_A}', '${EVENT_A1}', '${REQ_A1}', '${USER_OWNER}', '${CODE_A1}', 'ISSUED'
);

INSERT INTO tickets (
  tenant_id, event_id, id, owner_user_id, ticket_type_id, source_id, request_id,
  redemption_code_id, state, credential_version
) VALUES (
  '${TENANT_A}', '${EVENT_A1}', '${TICKET_A1}', '${USER_OWNER}', '${TYPE_A1}', '${SRC_A1}',
  '${REQ_A1}', '${CODE_A1}', 'USED', 1
);

INSERT INTO ticket_credentials (
  tenant_id, ticket_id, version, kid, token_hash, encrypted_token, status
) VALUES (
  '${TENANT_A}', '${TICKET_A1}', 1, '${KID}', '${TOKEN_HASH}', '${ENC_TOKEN}', 'ACTIVE'
);

INSERT INTO staff_sessions (tenant_id, event_id, id, user_id, status)
VALUES ('${TENANT_A}', '${EVENT_A1}', '${SESS_A1}', '${USER_STAFF}', 'ACTIVE');

INSERT INTO checkin_reservations (
  tenant_id, event_id, id, ticket_id, staff_session_id, token_hash, status, expires_at
) VALUES (
  '${TENANT_A}', '${EVENT_A1}', '${RES_A1}', '${TICKET_A1}', '${SESS_A1}',
  '${TOKEN_HASH}', 'CONFIRMED', now() + interval '1 hour'
);

INSERT INTO checkins (
  tenant_id, event_id, id, ticket_id, reservation_id, staff_session_id, actor_user_id
) VALUES (
  '${TENANT_A}', '${EVENT_A1}', '${CHECK_A1}', '${TICKET_A1}', '${RES_A1}',
  '${SESS_A1}', '${USER_STAFF}'
);
SQL

echo "dumping ${SRC_DB}"
T0="$(date +%s)"
docker exec -e PGPASSWORD="${PW}" "${SRC}" \
  pg_dump -h 127.0.0.1 -U postgres -d "${SRC_DB}" --format=plain \
  >"${DUMP}"
T1="$(date +%s)"
DUMP_SECONDS=$((T1 - T0))
DUMP_BYTES="$(wc -c <"${DUMP}" | tr -d ' ')"

echo "starting throwaway restore target ${DST} (database ${DST_DB})"
start_pg "${DST}" "${DST_DB}"

psql_exec "${DST}" "${DST_DB}" >/dev/null <<'SQL'
CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
SQL

echo "restoring dump into ${DST_DB}"
T2="$(date +%s)"
psql_exec "${DST}" "${DST_DB}" <"${DUMP}" >/dev/null
T3="$(date +%s)"
RESTORE_SECONDS=$((T3 - T2))
RTO_SECONDS=$((DUMP_SECONDS + RESTORE_SECONDS))

VERIFY="$(psql_exec "${DST}" "${DST_DB}" <<SQL
SELECT
  (SELECT count(*)::text FROM tenants) || '|' ||
  (SELECT count(*)::text FROM events) || '|' ||
  (SELECT count(*)::text FROM tickets WHERE id = '${TICKET_A1}'::uuid) || '|' ||
  (SELECT kid FROM ticket_credentials WHERE ticket_id = '${TICKET_A1}'::uuid AND version = 1) || '|' ||
  (SELECT code_pepper_version::text FROM redemption_codes WHERE id = '${CODE_A1}'::uuid) || '|' ||
  (SELECT count(*)::text FROM checkins WHERE id = '${CHECK_A1}'::uuid AND undone_at IS NULL) || '|' ||
  (SELECT allocated::text FROM quota_buckets WHERE id = 'ad111111-1111-4111-8111-111111111111'::uuid);
SQL
)"

EXPECTED="2|4|1|${KID}|1|1|1"
if [[ "${VERIFY}" != "${EXPECTED}" ]]; then
  echo "business restore invariant mismatch" >&2
  echo "got:      ${VERIFY}" >&2
  echo "expected: ${EXPECTED}" >&2
  exit 1
fi

# Cross-tenant isolation sanity: tenant B events still present; ticket stays on A
CROSS="$(psql_exec "${DST}" "${DST_DB}" <<SQL
SELECT
  (SELECT count(*)::text FROM events WHERE tenant_id = '${TENANT_B}'::uuid) || '|' ||
  (SELECT tenant_id::text FROM tickets WHERE id = '${TICKET_A1}'::uuid);
SQL
)"
if [[ "${CROSS}" != "2|${TENANT_A}" ]]; then
  echo "cross-tenant invariant failed: ${CROSS}" >&2
  exit 1
fi

cat >"${RESULT_JSON}" <<JSON
{
  "drill": "d5-business-restore",
  "pass": true,
  "tenants": 2,
  "events": 4,
  "ticketCredentialsKid": "${KID}",
  "codePepperVersion": 1,
  "checkinsCurrent": 1,
  "dumpBytes": ${DUMP_BYTES},
  "dumpSeconds": ${DUMP_SECONDS},
  "restoreSeconds": ${RESTORE_SECONDS},
  "rtoWallClockSeconds": ${RTO_SECONDS},
  "rpoClaimed": false,
  "productionBackup": false,
  "image": "${IMAGE}"
}
JSON

echo "D5_BUSINESS_RESTORE_PASS tenants=2 events=4 kid=${KID} checkins=1 dump_bytes=${DUMP_BYTES} dump_s=${DUMP_SECONDS} restore_s=${RESTORE_SECONDS} rto_wall_s=${RTO_SECONDS}"
echo "artifact=${RESULT_JSON}"
echo "not production backup; RPO not measured (no continuous backup); RTO is local dump+restore wall-clock only"
echo "tearing down ${SRC} and ${DST}"
