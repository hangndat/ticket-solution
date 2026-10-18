#!/usr/bin/env bash
# Idempotent D9 multi-tenant demo seed (fixture). Issues #135–#138 / Epic #134.
# Safe to re-run. Never prints passwords.
#
# By default, published marketing config is skipped if already present.
# After seed copy/venue changes, force a new version + publish:
#   D9_DEMO_FORCE_MARKETING=1 ./scripts/d9-demo-seed.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${CODE_HMAC_PEPPER:=local-dev-code-pepper-change-me}"
: "${CODE_HMAC_VERSION:=1}"
: "${OIDC_ISSUER:=http://127.0.0.1:8080/realms/ticket}"
export CODE_HMAC_PEPPER CODE_HMAC_VERSION OIDC_ISSUER
# Optional: D9_DEMO_FORCE_MARKETING=1|true — republish marketing on re-seed
if [[ -n "${D9_DEMO_FORCE_MARKETING:-}" ]]; then
  export D9_DEMO_FORCE_MARKETING
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (migrated Postgres with ticket schema)." >&2
  echo "Example: postgresql://ticket_dev:local_dev_only@127.0.0.1:55432/ticket_d9_demo" >&2
  exit 2
fi

pnpm --filter @ticket/backend build
node packages/backend/scripts/demo-seed.cjs
echo "D9_DEMO_SEED_OK"
