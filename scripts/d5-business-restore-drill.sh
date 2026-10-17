#!/usr/bin/env bash
# D5 business + key-state restore drill (Issue #25).
#
# Exact command (repo root):
#   ./scripts/d5-business-restore-drill.sh
#
# Pass proves:
#   1) Real AES-GCM encrypted_token (same algorithm as backend sealCredentialToken)
#      survives pg_dump → restore and decrypts with TICKET_CREDENTIAL_KEY.
#   2) Known mutations AFTER backup are absent post-restore (RPO method for
#      dump-based backups — not continuous PITR ≤15m production claim).
#   3) Nest API reconnects to restored DB (health + credential verify via SQL
#      decrypt helper); business graph invariants hold.
#
# Does NOT prove: production backup, continuous RPO ≤15m, PITR, or cloud failover.

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
API_PORT="${D5_BIZ_RESTORE_API_PORT:-13111}"
PG_PORT="${D5_BIZ_RESTORE_PG_PORT:-55461}"
CRED_KEY="${TICKET_CREDENTIAL_KEY:-local-dev-credential-key}"
PLAIN_TOKEN="drill-qr-token-${SUFFIX}"
POST_BACKUP_EVENT="e2999999-9999-4999-8999-999999999999"
API_LOG="${ARTIFACT_DIR}/biz-restore-api-${SUFFIX}.log"
API_PID=""

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
CODE_HMAC="deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "${API_PID}" 2>/dev/null; then
    kill "${API_PID}" 2>/dev/null || true
    wait "${API_PID}" 2>/dev/null || true
  fi
  if [[ -n "${MINT_PID:-}" ]] && kill -0 "${MINT_PID}" 2>/dev/null; then
    kill "${MINT_PID}" 2>/dev/null || true
    wait "${MINT_PID}" 2>/dev/null || true
  fi
  docker rm -f "${SRC}" "${DST}" >/dev/null 2>&1 || true
  rm -f "${DUMP}"
}
trap cleanup EXIT
API_PID=""
MINT_PID=""

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
if ! command -v node >/dev/null 2>&1; then
  echo "node is required for credential seal/open" >&2
  exit 1
fi

# Seal plaintext with backend-compatible AES-GCM
SEAL_JSON="$(node "${ROOT}/scripts/lib/credential-cli.mjs" seal "${PLAIN_TOKEN}" "${CRED_KEY}")"
ENC_TOKEN="$(node -e 'const s=JSON.parse(process.argv[1]); process.stdout.write(s.encryptedToken)' "${SEAL_JSON}")"
TOKEN_HASH="$(node -e 'const s=JSON.parse(process.argv[1]); process.stdout.write(s.tokenHash)' "${SEAL_JSON}")"
KID="$(node -e 'const s=JSON.parse(process.argv[1]); process.stdout.write(s.kid)' "${SEAL_JSON}")"

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
  local publish="${3:-}"
  local args=(
    run -d --name "${name}"
    --label ticket.task=d5-business-restore
    -e POSTGRES_PASSWORD="${PW}"
    -e POSTGRES_DB="${db}"
  )
  if [[ -n "${publish}" ]]; then
    args+=(-p "127.0.0.1:${publish}:5432")
  fi
  args+=("${IMAGE}")
  docker "${args[@]}" >/dev/null
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

RUNTIME_USER="d5_biz_${SUFFIX}"
RUNTIME_PW="$(openssl rand -hex 16)"
psql_exec "${SRC}" "${SRC_DB}" >/dev/null <<SQL
CREATE ROLE ${RUNTIME_USER} LOGIN PASSWORD '${RUNTIME_PW}' NOSUPERUSER NOBYPASSRLS INHERIT;
GRANT ticket_runtime TO ${RUNTIME_USER};
SQL

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

BACKUP_MARK_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "dumping ${SRC_DB} (backup mark ${BACKUP_MARK_AT})"
T0="$(date +%s)"
docker exec -e PGPASSWORD="${PW}" "${SRC}" \
  pg_dump -h 127.0.0.1 -U postgres -d "${SRC_DB}" --format=plain \
  >"${DUMP}"
T1="$(date +%s)"
DUMP_SECONDS=$((T1 - T0))
DUMP_BYTES="$(wc -c <"${DUMP}" | tr -d ' ')"

# Known mutation AFTER backup — must be ABSENT after restore (RPO drill method).
echo "inserting post-backup mutation event ${POST_BACKUP_EVENT}"
psql_exec "${SRC}" "${SRC_DB}" >/dev/null <<SQL
INSERT INTO events (tenant_id, id, slug, name, status, timezone) VALUES
  ('${TENANT_B}', '${POST_BACKUP_EVENT}', 'event-post-backup', 'Post-backup mutation', 'DRAFT', 'Asia/Ho_Chi_Minh');
SQL
POST_ON_SRC="$(psql_exec "${SRC}" "${SRC_DB}" <<SQL
SELECT count(*)::text FROM events WHERE id = '${POST_BACKUP_EVENT}'::uuid;
SQL
)"
if [[ "${POST_ON_SRC}" != "1" ]]; then
  echo "failed to insert post-backup mutation" >&2
  exit 1
fi

echo "starting throwaway restore target ${DST} on :${PG_PORT}"
start_pg "${DST}" "${DST_DB}" "${PG_PORT}"

psql_exec "${DST}" "${DST_DB}" >/dev/null <<SQL
CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE ${RUNTIME_USER} LOGIN PASSWORD '${RUNTIME_PW}' NOSUPERUSER NOBYPASSRLS INHERIT;
GRANT ticket_runtime TO ${RUNTIME_USER};
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
  (SELECT allocated::text FROM quota_buckets WHERE id = 'ad111111-1111-4111-8111-111111111111'::uuid) || '|' ||
  (SELECT encrypted_token FROM ticket_credentials WHERE ticket_id = '${TICKET_A1}'::uuid AND version = 1) || '|' ||
  (SELECT count(*)::text FROM events WHERE id = '${POST_BACKUP_EVENT}'::uuid) || '|' ||
  (SELECT count(*)::text FROM events);
SQL
)"

IFS='|' read -r V_TENANTS V_EVENTS V_TICKET V_KID V_PEPPER V_CHECKIN V_ALLOC V_ENC V_POST V_EVENT_COUNT <<<"${VERIFY}"
EXPECTED_PREFIX="2|4|1|${KID}|1|1|1"
GOT_PREFIX="${V_TENANTS}|${V_EVENTS}|${V_TICKET}|${V_KID}|${V_PEPPER}|${V_CHECKIN}|${V_ALLOC}"
if [[ "${GOT_PREFIX}" != "${EXPECTED_PREFIX}" ]]; then
  echo "business restore invariant mismatch" >&2
  echo "got:      ${GOT_PREFIX}" >&2
  echo "expected: ${EXPECTED_PREFIX}" >&2
  exit 1
fi
if [[ "${V_POST}" != "0" || "${V_EVENT_COUNT}" != "4" ]]; then
  echo "RPO drill failed: post-backup mutation present after restore (post=${V_POST} events=${V_EVENT_COUNT})" >&2
  exit 1
fi

# Cryptographic decrypt/verify of restored ciphertext
OPENED="$(node "${ROOT}/scripts/lib/credential-cli.mjs" open "${V_ENC}" "${CRED_KEY}")"
if [[ "${OPENED}" != "${PLAIN_TOKEN}" ]]; then
  echo "credential decrypt mismatch after restore" >&2
  echo "got: ${OPENED}" >&2
  exit 1
fi
CRYPTO_OK=true

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

# API reconnect: build if needed, ephemeral JWKS+JWT, authenticated GET /v1/me/tickets
API_RECONNECT_OK=false
API_BUSINESS_READ_OK=false
MINT_PID=""
if [[ ! -f "${ROOT}/apps/api/dist/main.js" ]]; then
  echo "building @ticket/api for reconnect smoke…"
  (cd "${ROOT}" && pnpm --filter @ticket/contracts build \
    && pnpm --filter @ticket/backend build \
    && pnpm --filter @ticket/api build)
fi
if [[ ! -f "${ROOT}/apps/api/dist/main.js" ]]; then
  echo "apps/api/dist/main.js missing after build" >&2
  exit 1
fi

MINT_PORT="${D5_BIZ_RESTORE_JWKS_PORT:-18999}"
MINT_OUT="${ARTIFACT_DIR}/mint-${SUFFIX}.json"
MINT_SUB="restore-owner-${SUFFIX}"
MINT_PORT="${MINT_PORT}" MINT_OUT="${MINT_OUT}" MINT_SUB="${MINT_SUB}" \
  MINT_EMAIL="owner-drill@example.com" \
  node "${ROOT}/scripts/lib/mint-test-jwt-server.mjs" &
MINT_PID=$!
for _ in $(seq 1 40); do
  [[ -f "${MINT_OUT}" ]] && break
  sleep 0.1
done
if [[ ! -f "${MINT_OUT}" ]]; then
  echo "mint JWT server failed" >&2
  exit 1
fi
MINT_ISSUER="$(node -e 'const j=require(process.argv[1]); process.stdout.write(j.issuer)' "${MINT_OUT}")"
MINT_JWKS="$(node -e 'const j=require(process.argv[1]); process.stdout.write(j.jwksUrl)' "${MINT_OUT}")"
ACCESS_TOKEN="$(node -e 'const j=require(process.argv[1]); process.stdout.write(j.token)' "${MINT_OUT}")"

# Bind restored owner row to minted subject so /v1/me/tickets can authorize
psql_exec "${DST}" "${DST_DB}" >/dev/null <<SQL
UPDATE users SET
  issuer = '${MINT_ISSUER}',
  subject = '${MINT_SUB}',
  email = 'owner-drill@example.com',
  email_verified = true
WHERE id = '${USER_OWNER}'::uuid;
SQL

DATABASE_URL="postgresql://${RUNTIME_USER}:${RUNTIME_PW}@127.0.0.1:${PG_PORT}/${DST_DB}" \
PORT="${API_PORT}" HOST=127.0.0.1 \
OIDC_ISSUER="${MINT_ISSUER}" \
OIDC_AUDIENCE=ticket-api \
OIDC_JWKS_URL="${MINT_JWKS}" \
CODE_HMAC_PEPPER=local-dev-code-pepper-change-me \
CODE_HMAC_VERSION=1 \
TICKET_CREDENTIAL_KEY="${CRED_KEY}" \
NODE_ENV=development \
  node "${ROOT}/apps/api/dist/main.js" >"${API_LOG}" 2>&1 &
API_PID=$!

for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${API_PORT}/v1/health" >/dev/null 2>&1; then
    API_RECONNECT_OK=true
    break
  fi
  if ! kill -0 "${API_PID}" 2>/dev/null; then
    break
  fi
  sleep 0.25
done
if [[ "${API_RECONNECT_OK}" != "true" ]]; then
  echo "API reconnect health failed; log=${API_LOG}" >&2
  tail -n 60 "${API_LOG}" >&2 || true
  kill "${MINT_PID}" 2>/dev/null || true
  exit 1
fi

# Authenticated business read against restored DB (not health-only)
ME_TICKETS="$(curl -sS -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "http://127.0.0.1:${API_PORT}/v1/me/tickets?tenantId=${TENANT_A}" || true)"
if echo "${ME_TICKETS}" | node -e '
const fs=require("fs"); const t=fs.readFileSync(0,"utf8");
let j; try { j=JSON.parse(t); } catch { process.exit(2); }
const items=j.items||j.tickets||j;
const arr=Array.isArray(items)?items:(items&&items.length!=null?items:[]);
const ok=Array.isArray(j)?j.some(x=>x.ticketId||x.id): (Array.isArray(arr)&&arr.some(x=>String(x.ticketId||x.id||"").includes("ee111111")||x.ticketId||x.id));
process.exit(ok?0:1);
'; then
  API_BUSINESS_READ_OK=true
else
  echo "API business read /v1/me/tickets failed: ${ME_TICKETS:0:400}" >&2
  kill "${MINT_PID}" 2>/dev/null || true
  exit 1
fi

# Ciphertext still decryptable while API is live
STILL="$(psql_exec "${DST}" "${DST_DB}" <<SQL
SELECT encrypted_token FROM ticket_credentials WHERE ticket_id = '${TICKET_A1}'::uuid AND version = 1;
SQL
)"
STILL_OPEN="$(node "${ROOT}/scripts/lib/credential-cli.mjs" open "${STILL}" "${CRED_KEY}")"
if [[ "${STILL_OPEN}" != "${PLAIN_TOKEN}" ]]; then
  echo "live reconcile decrypt failed" >&2
  kill "${MINT_PID}" 2>/dev/null || true
  exit 1
fi
kill "${MINT_PID}" 2>/dev/null || true
MINT_PID=""

# RPO measured: post-backup mutation lost; window = time from backup mark to restore complete.
# Continuous RPO ≤15m requires PITR — not claimed.
RPO_METHOD="dump-based: mutations after backup mark absent post-restore"
RPO_CONTINUOUS_CLAIMED=false

cat >"${RESULT_JSON}" <<JSON
{
  "drill": "d5-business-restore",
  "pass": true,
  "tenants": 2,
  "events": 4,
  "ticketCredentialsKid": "${KID}",
  "codePepperVersion": 1,
  "checkinsCurrent": 1,
  "cryptoDecryptOk": ${CRYPTO_OK},
  "apiReconnectOk": ${API_RECONNECT_OK},
  "apiBusinessReadOk": ${API_BUSINESS_READ_OK},
  "postBackupMutationAbsent": true,
  "postBackupEventId": "${POST_BACKUP_EVENT}",
  "backupMarkAt": "${BACKUP_MARK_AT}",
  "rpoMethod": "${RPO_METHOD}",
  "rpoContinuousClaimed": ${RPO_CONTINUOUS_CLAIMED},
  "rpoClaimed": false,
  "dumpBytes": ${DUMP_BYTES},
  "dumpSeconds": ${DUMP_SECONDS},
  "restoreSeconds": ${RESTORE_SECONDS},
  "rtoWallClockSeconds": ${RTO_SECONDS},
  "productionBackup": false,
  "image": "${IMAGE}",
  "apiPort": ${API_PORT},
  "pgPort": ${PG_PORT}
}
JSON

echo "D5_BUSINESS_RESTORE_PASS tenants=2 events=4 kid=${KID} crypto=1 api_reconnect=1 api_business_read=1 rpo_post_mutation_absent=1 dump_bytes=${DUMP_BYTES} dump_s=${DUMP_SECONDS} restore_s=${RESTORE_SECONDS} rto_wall_s=${RTO_SECONDS}"
echo "artifact=${RESULT_JSON}"
echo "not production backup; continuous RPO≤15m not claimed (dump-point method only); RTO is local dump+restore wall-clock"
echo "tearing down ${SRC} and ${DST}"
