#!/usr/bin/env bash
# Live Keycloak assurance smoke (task-local issuer preferred).
#
# Prefer throwaway stack (does not touch shared compose Keycloak):
#   ./scripts/platform-keycloak-task-stack.sh up
#   D5_PLATFORM_OIDC_ISSUER=http://127.0.0.1:18089/realms/ticket \
#     ./scripts/platform-keycloak-assurance-smoke.sh
#   ./scripts/platform-keycloak-task-stack.sh down
#
# Proves: platform/admin clients exist; attendee password grant ticket-api only;
# admin/platform password grant disabled; mobile must not get platform audience (static).

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

OIDC_ISSUER="${D5_PLATFORM_OIDC_ISSUER:-}"
if [[ -z "${OIDC_ISSUER}" ]]; then
  OIDC_ISSUER="$(
    curl -sf http://127.0.0.1:8080/realms/ticket/.well-known/openid-configuration \
      | python3 -c 'import json,sys; print(json.load(sys.stdin)["issuer"].rstrip("/"))' \
      2>/dev/null || true
  )"
  OIDC_ISSUER="${OIDC_ISSUER:-http://127.0.0.1:8080/realms/ticket}"
fi

if ! curl -sf "${OIDC_ISSUER}/.well-known/openid-configuration" >/dev/null; then
  echo "OIDC issuer unreachable: ${OIDC_ISSUER}" >&2
  echo "Use: ./scripts/platform-keycloak-task-stack.sh up" >&2
  exit 1
fi

"${ROOT}/scripts/platform-security-config-smoke.sh"

# Fail closed if platform clients not imported (openid-configuration alone is insufficient)
WELLKNOWN="$(curl -sf "${OIDC_ISSUER}/.well-known/openid-configuration")"
# Probe clients via token endpoint error codes
probe_client() {
  local cid="$1" secret="$2"
  local body code
  body="$(mktemp)"
  code="$(curl -s -o "${body}" -w '%{http_code}' -X POST "${OIDC_ISSUER}/protocol/openid-connect/token" \
    -d "grant_type=client_credentials" \
    -d "client_id=${cid}" \
    -d "client_secret=${secret}" || true)"
  # confidential clients without service account → 401 invalid_grant / unauthorized_client
  # missing client → often 401 unauthorized_client with "Invalid client"
  local err
  err="$(python3 -c 'import json,sys; 
try:
 d=json.load(open(sys.argv[1])); print(d.get("error","")+"|"+d.get("error_description",""))
except Exception:
 print("parse|")' "${body}" 2>/dev/null || echo "parse|")"
  rm -f "${body}"
  echo "${code}|${err}"
}

# Presence: admin UI-less check — GET authz endpoint with bogus still 400 if client known
# Use Keycloak account clients list via registration of well-known + password grant attempt messages
PLATFORM_PROBE="$(probe_client ticket-platform-web dev-platform-web-secret-change-me)"
ADMIN_PROBE="$(probe_client ticket-admin-web dev-admin-web-secret-change-me)"
echo "probe platform=${PLATFORM_PROBE}"
echo "probe admin=${ADMIN_PROBE}"

# If client missing, Keycloak returns unauthorized_client + Invalid client or Client not found
if echo "${PLATFORM_PROBE}" | grep -qiE 'Invalid client|Client not found|invalid_client'; then
  echo "FAIL: ticket-platform-web not present in live realm — run task-stack up or apply-realm" >&2
  exit 1
fi
if echo "${ADMIN_PROBE}" | grep -qiE 'Invalid client|Client not found|invalid_client'; then
  echo "FAIL: ticket-admin-web not present in live realm" >&2
  exit 1
fi

# Attendee password grant (ticket-web)
TOKEN_JSON="$(
  curl -sf -X POST "${OIDC_ISSUER}/protocol/openid-connect/token" \
    -d "grant_type=password" \
    -d "client_id=ticket-web" \
    -d "client_secret=dev-web-secret-change-me" \
    -d "username=attendee@example.com" \
    -d "password=attendee-demo"
)"

ACCESS="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])' <<<"${TOKEN_JSON}")"
python3 <<PY
import json, base64, sys
tok = """${ACCESS}"""
payload = tok.split(".")[1]
payload += "=" * (-len(payload) % 4)
claims = json.loads(base64.urlsafe_b64decode(payload.encode()))
aud = claims.get("aud")
auds = aud if isinstance(aud, list) else [aud]
if "ticket-platform-api" in auds:
    print("FAIL: attendee token must not include ticket-platform-api", file=sys.stderr)
    sys.exit(1)
if "ticket-api" not in auds:
    print(f"FAIL: expected ticket-api in aud={auds}", file=sys.stderr)
    sys.exit(1)
print(f"attendee_aud_ok aud={auds} acr={claims.get('acr')!r}")
PY

ADMIN_CODE="$(
  curl -s -o /tmp/adm-tok.json -w '%{http_code}' -X POST "${OIDC_ISSUER}/protocol/openid-connect/token" \
    -d "grant_type=password" \
    -d "client_id=ticket-admin-web" \
    -d "client_secret=dev-admin-web-secret-change-me" \
    -d "username=staff@example.com" \
    -d "password=staff-demo" || true
)"
if [[ "${ADMIN_CODE}" == "200" ]]; then
  echo "FAIL: ticket-admin-web must not allow password grant (got 200)" >&2
  exit 1
fi
echo "admin_password_grant_blocked http=${ADMIN_CODE}"

PLATFORM_CODE="$(
  curl -s -o /tmp/plat-tok.json -w '%{http_code}' -X POST "${OIDC_ISSUER}/protocol/openid-connect/token" \
    -d "grant_type=password" \
    -d "client_id=ticket-platform-web" \
    -d "client_secret=dev-platform-web-secret-change-me" \
    -d "username=staff@example.com" \
    -d "password=staff-demo" || true
)"
if [[ "${PLATFORM_CODE}" == "200" ]]; then
  echo "FAIL: ticket-platform-web must not allow password grant" >&2
  exit 1
fi
echo "platform_password_grant_blocked http=${PLATFORM_CODE}"

echo "PLATFORM_KEYCLOAK_ASSURANCE_SMOKE_PASS issuer=${OIDC_ISSUER}"
echo "gap: full TOTP Auth Code + acr=2 live proof after enroll — bootstrap --token-file"
echo "not production; O06 unresolved"
