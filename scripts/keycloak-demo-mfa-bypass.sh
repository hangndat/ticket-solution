#!/usr/bin/env bash
# Controlled demo MFA bypass for launch UAT (Epic #1008).
# - Clears requiredActions + OTP credentials for named demo users.
# - Optionally disables Conditional OTP on browser flow `vemoki otp browser`
#   (CONFIGURE_TOTP otherwise blocks password-only demo staff).
# Does NOT print secrets.
#
# Restore MFA: re-enable Conditional OTP *inside* forms (after Username Password).
# Top-level CONDITIONAL on this realm NPEs (user null) — do not use that shape.
set -euo pipefail
ENV_FILE="${ENV_FILE:-/opt/vemoki/.env}"
KC_CONTAINER="${KC_CONTAINER:-vemoki-keycloak-1}"
REALM="${KEYCLOAK_REALM:-ticket}"
DEMO_EMAILS="${DEMO_EMAILS:-staff@example.com}"
BROWSER_FLOW="${BROWSER_FLOW:-vemoki otp browser}"
DISABLE_CONDITIONAL_OTP="${DISABLE_CONDITIONAL_OTP:-1}"
if [[ ! -f "$ENV_FILE" ]]; then echo "missing_env_file" >&2; exit 1; fi
KC_ADMIN=$(grep -E '^KEYCLOAK_ADMIN=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
KC_ADMIN_PASS=$(grep -E '^KEYCLOAK_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
if [[ -z "$KC_ADMIN" || -z "$KC_ADMIN_PASS" ]]; then echo "missing_keycloak_admin" >&2; exit 1; fi
docker exec "$KC_CONTAINER" /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://127.0.0.1:8080 --realm master \
  --user "$KC_ADMIN" --password "$KC_ADMIN_PASS" >/dev/null

kcadm() {
  docker exec "$KC_CONTAINER" /opt/keycloak/bin/kcadm.sh "$@"
}

changed=0
for email in $DEMO_EMAILS; do
  mapfile -t ids < <(
    kcadm get users -r "$REALM" -q "email=$email" --fields id 2>/dev/null \
      | python3 -c 'import json,sys
try:
  for u in json.load(sys.stdin): print(u["id"])
except Exception: pass'
  )
  if [[ ${#ids[@]} -eq 0 ]]; then echo "demo_user_missing email=$email"; continue; fi
  for uid in "${ids[@]}"; do
    kcadm update "users/$uid" -r "$REALM" -s 'requiredActions=[]' >/dev/null
    mapfile -t cred_ids < <(
      kcadm get "users/$uid/credentials" -r "$REALM" --fields id,type 2>/dev/null \
        | python3 -c 'import json,sys
try:
  for c in json.load(sys.stdin):
    if c.get("type")=="otp": print(c["id"])
except Exception: pass'
    )
    removed=0
    for cid in "${cred_ids[@]:-}"; do
      [[ -z "$cid" ]] && continue
      kcadm delete "users/$uid/credentials/$cid" -r "$REALM" >/dev/null || true
      removed=$((removed + 1))
    done
    echo "demo_mfa_bypass_ok email=$email user_id=$uid otp_creds_removed=$removed"
    changed=$((changed + 1))
  done
done

otp_disabled=0
if [[ "$DISABLE_CONDITIONAL_OTP" == "1" ]]; then
  FLOW_PATH="authentication/flows/$(python3 -c 'import urllib.parse,os; print(urllib.parse.quote(os.environ["F"]))' F="$BROWSER_FLOW")/executions"
  while IFS=$'\t' read -r eid label; do
    [[ -z "$eid" ]] && continue
    kcadm update "$FLOW_PATH" -r "$REALM" \
      -b "{\"id\":\"$eid\",\"requirement\":\"DISABLED\"}" >/dev/null || true
    echo "otp_execution_disabled id=$eid label=$label"
    otp_disabled=$((otp_disabled + 1))
  done < <(
    kcadm get "$FLOW_PATH" -r "$REALM" 2>/dev/null | python3 -c '
import json,sys
data=json.load(sys.stdin)
in_otp=False
for e in data:
  name=e.get("displayName") or ""
  pid=e.get("providerId") or ""
  if "Browser - Conditional OTP" in name:
    in_otp=True
    print(e["id"]+"\t"+name.replace("\t"," "))
    continue
  if not in_otp:
    continue
  if pid in ("auth-otp-form","conditional-user-configured") or "OTP Form" in name:
    print(e["id"]+"\t"+(name or pid).replace("\t"," "))
  elif e.get("authenticationFlow") and "Conditional OTP" not in name:
    in_otp=False
'
  )
fi

echo "keycloak_demo_mfa_bypass=ok changed=$changed conditional_otp_disabled=$otp_disabled"
