#!/usr/bin/env bash
# Epic #686 prod-like seed (4 org / 6 event). Idempotent; never prints secrets.
#
# Mutate:  PROD_SEED_CONFIRM=1 ./scripts/prod-seed.sh
# Dry-run: PROD_SEED_DRY_RUN=1 ./scripts/prod-seed.sh  (rolls back transaction)
#
# Local dev staff rows (tests only): PROD_SEED_CREATE_STAFF_USERS=1
# Re-publish marketing: PROD_SEED_FORCE_MARKETING=1
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${CODE_HMAC_PEPPER:=local-dev-code-pepper-change-me}"
: "${CODE_HMAC_VERSION:=1}"
: "${OIDC_ISSUER:=http://127.0.0.1:8080/realms/ticket}"
export CODE_HMAC_PEPPER CODE_HMAC_VERSION OIDC_ISSUER

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (migrated Postgres with ticket schema)." >&2
  exit 2
fi

if [[ -z "${PROD_SEED_DRY_RUN:-}" && -z "${PROD_SEED_CONFIRM:-}" ]]; then
  echo "Refuse: set PROD_SEED_CONFIRM=1 to mutate or PROD_SEED_DRY_RUN=1 for dry-run." >&2
  exit 2
fi

pnpm --filter @ticket/backend build
node packages/backend/scripts/prod-seed.cjs
echo "PROD_SEED_OK"
