#!/usr/bin/env bash
# Regenerate infra/keycloak/realm-ticket.prod.json from realm-ticket.json (drops smtpServer).
# Production SMTP is applied live via scripts/keycloak-prod-smtp-apply.sh — not realm import.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
jq 'del(.smtpServer)' "$ROOT/infra/keycloak/realm-ticket.json" > "$ROOT/infra/keycloak/realm-ticket.prod.json"
echo "Wrote $ROOT/infra/keycloak/realm-ticket.prod.json (no smtpServer)"
