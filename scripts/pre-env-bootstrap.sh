#!/usr/bin/env bash
# Bootstrap /opt/vemoki-pre on the VPS (no secrets printed). Run on host as deploy user.
set -euo pipefail

PRE_ROOT="${PRE_ROOT:-/opt/vemoki-pre}"
SRC_ROOT="${PRE_ROOT}/src"
DEPLOY_DIR="${SRC_ROOT}/infra/deploy"
ENV_FILE="${PRE_ROOT}/.env"
REALM_HOST="${PRE_ROOT}/realm-ticket.pre.json"
TEMPLATE_ENV="${DEPLOY_DIR}/.env.pre.example"
TEMPLATE_REALM="${SRC_ROOT}/infra/keycloak/realm-ticket.pre.json"

rand() { openssl rand -base64 32 | tr -d '/+=' | head -c "${1:-24}"; }

if [[ ! -f "${TEMPLATE_ENV}" ]]; then
  echo "Missing ${TEMPLATE_ENV} — sync source to ${SRC_ROOT} first." >&2
  exit 1
fi

mkdir -p "${PRE_ROOT}" "${SRC_ROOT}"

if [[ -f "${ENV_FILE}" ]] && ! grep -q 'change_me_postgres_pre' "${ENV_FILE}" 2>/dev/null; then
  echo "Refusing to overwrite existing ${ENV_FILE} (remove manually to regenerate)." >&2
  exit 1
fi

cp "${TEMPLATE_ENV}" "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

sed -i "s/change_me_postgres_pre/$(rand 32)/" "${ENV_FILE}"
sed -i "s/change_me_ticket_app_pre/$(rand 32)/" "${ENV_FILE}"
sed -i "s/change_me_keycloak_db_pre/$(rand 32)/" "${ENV_FILE}"
sed -i "s/change_me_keycloak_admin_pre/$(rand 24)/" "${ENV_FILE}"
sed -i "s/change_me_oidc_web_secret_pre/$(rand 32)/" "${ENV_FILE}"
sed -i "s/change_me_oidc_admin_secret_pre/$(rand 32)/" "${ENV_FILE}"
sed -i "s/change_me_oidc_platform_secret_pre/$(rand 32)/" "${ENV_FILE}"
sed -i "s/change_me_hmac_pepper_pre_32chars_min/$(rand 40)/" "${ENV_FILE}"
sed -i "s/change_me_credential_key_pre_16plus/$(rand 32)/" "${ENV_FILE}"
sed -i "s/change_me_minio_root_pre/$(rand 32)/" "${ENV_FILE}"

cp "${TEMPLATE_REALM}" "${REALM_HOST}"
chmod 644 "${REALM_HOST}"

# Align Keycloak import secrets with env (import-time only; dev placeholders in template).
get_env() { grep -E "^${1}=" "${ENV_FILE}" | head -1 | cut -d= -f2-; }
WEB_SECRET="$(get_env OIDC_CLIENT_SECRET)"
ADMIN_SECRET="$(get_env OIDC_ADMIN_CLIENT_SECRET)"
PLATFORM_SECRET="$(get_env PLATFORM_OIDC_CLIENT_SECRET)"
escape_sed() { printf '%s' "$1" | sed -e 's/[&/\]/\\&/g'; }
sed -i "s/dev-web-secret-change-me/$(escape_sed "${WEB_SECRET}")/" "${REALM_HOST}"
sed -i "s/dev-admin-web-secret-change-me/$(escape_sed "${ADMIN_SECRET}")/" "${REALM_HOST}"
sed -i "s/dev-platform-web-secret-change-me/$(escape_sed "${PLATFORM_SECRET}")/" "${REALM_HOST}"

echo "Bootstrap OK: ${ENV_FILE} and ${REALM_HOST} (secrets not printed)."
