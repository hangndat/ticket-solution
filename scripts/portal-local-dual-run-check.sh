#!/usr/bin/env bash
# Verify local portal dual-run Keycloak URIs (P1.2 / Issue #437).
# No production DNS/TLS/deploy. Does not mutate Keycloak unless --apply is passed
# (delegates to platform-keycloak-apply-realm.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PORTAL_REALM_JSON="${ROOT}/infra/keycloak/realm-ticket.json"
LIVE=0
APPLY=0

for arg in "$@"; do
  case "$arg" in
    --live) LIVE=1 ;;
    --apply) APPLY=1 ;;
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/portal-local-dual-run-check.sh [--live] [--apply]

  (default)  Assert realm JSON contains portal local (3013) redirect URIs.
  --live     Also HTTP-probe loopback Keycloak + portal origin (best-effort).
  --apply    Run ./scripts/platform-keycloak-apply-realm.sh then re-check JSON.
EOF
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ ! -f "$PORTAL_REALM_JSON" ]]; then
  echo "PORTAL_LOCAL_DUAL_RUN_FAIL missing realm: $PORTAL_REALM_JSON" >&2
  exit 1
fi

if [[ "$APPLY" -eq 1 ]]; then
  "${ROOT}/scripts/platform-keycloak-apply-realm.sh"
fi

node <<'NODE'
const fs = require('fs');
const realmPath = process.env.PORTAL_REALM_JSON;
const data = JSON.parse(fs.readFileSync(realmPath, 'utf8'));
const byId = Object.fromEntries((data.clients || []).map((c) => [c.clientId, c]));
const required = [
  {
    clientId: 'ticket-admin-web',
    redirects: [
      'http://127.0.0.1:3013/api/auth/callback',
      'http://localhost:3013/api/auth/callback',
    ],
    origins: ['http://127.0.0.1:3013', 'http://localhost:3013'],
    postLogout: ['http://127.0.0.1:3013/auth', 'http://localhost:3013/auth'],
  },
  {
    clientId: 'ticket-platform-web',
    redirects: [
      'http://127.0.0.1:3013/api/auth/platform/callback',
      'http://localhost:3013/api/auth/platform/callback',
    ],
    origins: ['http://127.0.0.1:3013', 'http://localhost:3013'],
    postLogout: ['http://127.0.0.1:3013/auth', 'http://localhost:3013/auth'],
  },
];
let failed = false;
for (const spec of required) {
  const c = byId[spec.clientId];
  if (!c) {
    console.error('PORTAL_LOCAL_DUAL_RUN_FAIL missing client ' + spec.clientId);
    failed = true;
    continue;
  }
  const redirects = new Set(c.redirectUris || []);
  const origins = new Set(c.webOrigins || []);
  const post = new Set(
    String((c.attributes && c.attributes['post.logout.redirect.uris']) || '')
      .split('##')
      .filter(Boolean),
  );
  for (const u of spec.redirects) {
    if (!redirects.has(u)) {
      console.error('PORTAL_LOCAL_DUAL_RUN_FAIL ' + spec.clientId + ' missing redirect ' + u);
      failed = true;
    }
  }
  for (const u of spec.origins) {
    if (!origins.has(u)) {
      console.error('PORTAL_LOCAL_DUAL_RUN_FAIL ' + spec.clientId + ' missing webOrigin ' + u);
      failed = true;
    }
  }
  for (const u of spec.postLogout) {
    if (!post.has(u)) {
      console.error('PORTAL_LOCAL_DUAL_RUN_FAIL ' + spec.clientId + ' missing post-logout ' + u);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log('PORTAL_LOCAL_DUAL_RUN_JSON_PASS realm local portal URIs (3013) present');
NODE

if [[ "$LIVE" -eq 1 ]]; then
  probe() {
    local url="$1"
    if curl -fsS -o /dev/null --max-time 3 "$url"; then
      echo "PORTAL_LOCAL_DUAL_RUN_LIVE_OK $url"
    else
      echo "PORTAL_LOCAL_DUAL_RUN_LIVE_SKIP $url (not up — OK if stack not started)"
    fi
  }
  probe "http://127.0.0.1:8080/realms/ticket/.well-known/openid-configuration"
  probe "http://127.0.0.1:3013/"
  probe "http://127.0.0.1:3000/"
fi

echo "PORTAL_LOCAL_DUAL_RUN_PASS see docs/ops/PORTAL-LOCAL-CUTOVER-PREP.md"
