#!/usr/bin/env bash
# Apply Porkbun (or any SMTP_URL) to live Keycloak realm ticket via kcadm.
# Run on VPS as deploy user. Never prints SMTP password.
#
# Usage (on conanphong):
#   ENV_FILE=/opt/vemoki/.env KC_CONTAINER=vemoki-keycloak-1 ./scripts/keycloak-prod-smtp-apply.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/vemoki/.env}"
if [[ -f /opt/vemoki/secrets/smtp/env ]]; then
  ENV_FILE=/opt/vemoki/secrets/smtp/env
fi
KC_CONTAINER="${KC_CONTAINER:-vemoki-keycloak-1}"
TMP="${TMP:-${HOME}/kc-smtp.env}"

docker run --rm --user "$(id -u):$(id -g)" -e HOME="$HOME" -v "$HOME:$HOME" \
  --env-file "$ENV_FILE" vemoki-runtime:local node -e "
const fs = require('fs');
const u = new URL(process.env.SMTP_URL);
const esc = (v) => String(v).replace(/'/g, \"'\\\\''\");
const lines = [
  \"HOST='\" + esc(u.hostname) + \"'\",
  \"PORT='\" + esc(u.port || 587) + \"'\",
  \"USER='\" + esc(decodeURIComponent(u.username || '')) + \"'\",
  \"PASS='\" + esc(decodeURIComponent(u.password || '')) + \"'\",
  \"FROM='\" + esc(process.env.SMTP_FROM || 'noreply@vemoki.com') + \"'\",
];
fs.writeFileSync(process.env.HOME + '/kc-smtp.env', lines.join('\\n') + '\\n', { mode: 0o600 });
"

# shellcheck disable=SC1090
source "$TMP"

KC_ADMIN=$(grep -E '^KEYCLOAK_ADMIN=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
KC_ADMIN_PASS=$(grep -E '^KEYCLOAK_ADMIN_PASSWORD=' /opt/vemoki/.env | cut -d= -f2- | tr -d '\r')

docker exec "$KC_CONTAINER" /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://127.0.0.1:8080 --realm master --user "$KC_ADMIN" --password "$KC_ADMIN_PASS" >/dev/null

docker exec "$KC_CONTAINER" /opt/keycloak/bin/kcadm.sh update realms/ticket \
  -s "smtpServer.host=$HOST" \
  -s "smtpServer.port=$PORT" \
  -s "smtpServer.from=$FROM" \
  -s "smtpServer.fromDisplayName=Vemoki" \
  -s "smtpServer.ssl=false" \
  -s "smtpServer.starttls=true" \
  -s "smtpServer.auth=true" \
  -s "smtpServer.user=$USER" \
  -s "smtpServer.password=$PASS"

rm -f "$TMP"
docker exec "$KC_CONTAINER" /opt/keycloak/bin/kcadm.sh get realms/ticket 2>/dev/null \
  | grep -A10 '"smtpServer"' | grep -v password || true
echo "keycloak_prod_smtp_apply=ok"
