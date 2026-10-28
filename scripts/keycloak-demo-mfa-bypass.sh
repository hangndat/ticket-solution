#!/usr/bin/env bash
# Controlled demo MFA bypass for launch UAT (Epic #1008).
# Clears CONFIGURE_TOTP + OTP credentials for named demo users.
# Does NOT print secrets.
set -euo pipefail
ENV_FILE="${ENV_FILE:-/opt/vemoki/.env}"
KC_CONTAINER="${KC_CONTAINER:-vemoki-keycloak-1}"
REALM="${KEYCLOAK_REALM:-ticket}"
DEMO_EMAILS="${DEMO_EMAILS:-staff@example.com}"
if [[ ! -f "$ENV_FILE" ]]; then echo "missing_env_file" >&2; exit 1; fi
KC_ADMIN=$(grep -E '^KEYCLOAK_ADMIN=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
KC_ADMIN_PASS=$(grep -E '^KEYCLOAK_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
if [[ -z "$KC_ADMIN" || -z "$KC_ADMIN_PASS" ]]; then echo "missing_keycloak_admin" >&2; exit 1; fi
docker exec "$KC_CONTAINER" /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://127.0.0.1:8080 --realm master \
  --user "$KC_ADMIN" --password "$KC_ADMIN_PASS" >/dev/null
changed=0
for email in $DEMO_EMAILS; do
  mapfile -t ids < <(
    docker exec "$KC_CONTAINER" /opt/keycloak/bin/kcadm.sh get "users" \
      -r "$REALM" -q "email=$email" --fields id,username,email,requiredActions \
      2>/dev/null | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
  )
  if [[ ${#ids[@]} -eq 0 ]]; then echo "demo_user_missing email=$email"; continue; fi
  for uid in "${ids[@]}"; do
    docker exec "$KC_CONTAINER" /opt/keycloak/bin/kcadm.sh update "users/$uid" \
      -r "$REALM" -s 'requiredActions=[]' >/dev/null
    mapfile -t cred_ids < <(
      docker exec "$KC_CONTAINER" /opt/keycloak/bin/kcadm.sh get "users/$uid/credentials" \
        -r "$REALM" --fields id,type 2>/dev/null \
        | awk '/"type"[[:space:]]*:[[:space:]]*"otp"/ { want=1 } want && /"id"[[:space:]]*:[[:space:]]*"/ { sub(/.*"id"[[:space:]]*:[[:space:]]*"/, ""); sub(/".*/, ""); print; want=0 }'
    )
    for cid in "${cred_ids[@]:-}"; do
      [[ -z "$cid" ]] && continue
      docker exec "$KC_CONTAINER" /opt/keycloak/bin/kcadm.sh delete \
        "users/$uid/credentials/$cid" -r "$REALM" >/dev/null || true
    done
    echo "demo_mfa_bypass_ok email=$email user_id=$uid otp_creds_removed=${#cred_ids[@]}"
    changed=$((changed + 1))
  done
done
echo "keycloak_demo_mfa_bypass=ok changed=$changed"
