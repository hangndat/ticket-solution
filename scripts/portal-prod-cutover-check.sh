#!/usr/bin/env bash
# Production portal cutover probes (Issue #502 / ADR-20 §8).
# Headless HTTP only — no Computer Use / mouse. Does not print secrets.
set -euo pipefail

PORTAL_ORIGIN="${PORTAL_ORIGIN:-https://portal.vemoki.com}"
APP_ORIGIN="${PRODUCT_ORIGIN:-https://app.vemoki.com}"
FAIL=0

pass() { echo "PORTAL_PROD_CUTOVER_PASS $*"; }
fail() { echo "PORTAL_PROD_CUTOVER_FAIL $*" >&2; FAIL=1; }
info() { echo "PORTAL_PROD_CUTOVER_INFO $*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    fail "missing command $1"
    exit 2
  }
}

need_cmd curl
need_cmd dig
need_cmd openssl

# --- DNS ---
ips="$(dig +short portal.vemoki.com A | tr '\n' ' ' | sed 's/[[:space:]]*$//')"
if [[ -z "$ips" ]]; then
  fail "DNS portal.vemoki.com has no A record"
else
  pass "DNS portal.vemoki.com A=$ips"
fi

# --- TLS SAN ---
san="$(
  echo | openssl s_client -connect portal.vemoki.com:443 -servername portal.vemoki.com 2>/dev/null \
    | openssl x509 -noout -ext subjectAltName 2>/dev/null || true
)"
if echo "$san" | grep -q 'DNS:portal.vemoki.com'; then
  pass "TLS SAN includes portal.vemoki.com"
else
  fail "TLS SAN missing portal.vemoki.com (cert may predate expand)"
fi

# --- Portal HTTP ---
portal_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$PORTAL_ORIGIN/" || echo 000)"
case "$portal_code" in
  200|301|302|307|308) pass "portal / HTTP $portal_code" ;;
  *) fail "portal / HTTP $portal_code" ;;
esac

login_headers="$(curl -sSI --max-time 15 "$PORTAL_ORIGIN/api/auth/login" 2>/dev/null | tr -d '\r' || true)"
login_code="$(printf '%s\n' "$login_headers" | awk 'NR==1{print $2}')"
login_loc="$(printf '%s\n' "$login_headers" | awk 'tolower($1)=="location:"{print $2; exit}')"
if [[ "$login_code" == "307" || "$login_code" == "302" ]] && echo "$login_loc" | grep -q 'auth.vemoki.com/realms/ticket'; then
  if echo "$login_loc" | grep -q 'redirect_uri=https%3A%2F%2Fportal.vemoki.com'; then
    pass "portal /api/auth/login → IdP with portal redirect_uri"
  else
    fail "portal login Location missing portal redirect_uri: $login_loc"
  fi
else
  fail "portal /api/auth/login expected 307 to IdP got HTTP $login_code loc=$login_loc"
fi

# Location must not advertise 0.0.0.0
loc="$(curl -sSI --max-time 15 "$PORTAL_ORIGIN/auth" 2>/dev/null | tr -d '\r' | awk 'tolower($1)=="location:"{print $2; exit}' || true)"
if [[ -n "$loc" ]] && echo "$loc" | grep -q '0.0.0.0'; then
  fail "portal auth Location contains 0.0.0.0: $loc"
else
  pass "portal auth Location ok (${loc:-none})"
fi

# --- Dual-run redirect (app → portal) ---
admin_headers="$(curl -sSI --max-time 15 "$APP_ORIGIN/admin" 2>/dev/null | tr -d '\r' || true)"
admin_code="$(printf '%s\n' "$admin_headers" | awk 'NR==1{print $2}')"
admin_loc="$(printf '%s\n' "$admin_headers" | awk 'tolower($1)=="location:"{print $2; exit}')"
if [[ "$admin_code" == "302" || "$admin_code" == "301" || "$admin_code" == "307" || "$admin_code" == "308" ]]; then
  if echo "$admin_loc" | grep -q "^${PORTAL_ORIGIN}"; then
    pass "dual-run ON: app /admin → $admin_loc"
  else
    info "app /admin HTTP $admin_code Location=$admin_loc (dual-run may still be OFF — expected before flag=1)"
  fi
else
  info "app /admin HTTP $admin_code (legacy serve — dual-run OFF)"
fi

# POST must not migrate
post_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 -X POST "$APP_ORIGIN/admin" || echo 000)"
post_loc="$(curl -sSI --max-time 15 -X POST "$APP_ORIGIN/admin" 2>/dev/null | tr -d '\r' | awk 'tolower($1)=="location:"{print $2; exit}' || true)"
if echo "${post_loc:-}" | grep -q "^${PORTAL_ORIGIN}"; then
  fail "POST /admin redirected to portal (forbidden)"
else
  pass "POST /admin does not redirect to portal (HTTP $post_code)"
fi

# --- GATE-STAY-APP ---
gate_headers="$(curl -sSI --max-time 15 "$APP_ORIGIN/gate" 2>/dev/null | tr -d '\r' || true)"
gate_loc="$(printf '%s\n' "$gate_headers" | awk 'tolower($1)=="location:"{print $2; exit}')"
if echo "${gate_loc:-}" | grep -q 'portal.vemoki.com'; then
  fail "GATE redirected to portal: $gate_loc"
else
  pass "GATE-STAY-APP: /gate Location=${gate_loc:-same-origin}"
fi

# --- Regression neighbour vhost ---
ancafe_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 https://ancafe.anphong.vn/ || echo 000)"
case "$ancafe_code" in
  200|301|302|307|308) pass "ancafe.anphong.vn HTTP $ancafe_code" ;;
  *) fail "ancafe.anphong.vn HTTP $ancafe_code" ;;
esac

# --- Realm JSON (optional local path) ---
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REALM="${PORTAL_REALM_JSON:-$ROOT/infra/keycloak/realm-ticket.json}"
if [[ -f "$REALM" ]]; then
  if node -e "
const d=require('fs').readFileSync(process.argv[1],'utf8');
const j=JSON.parse(d);
const by=Object.fromEntries((j.clients||[]).map(c=>[c.clientId,c]));
const a=by['ticket-admin-web'];
const p=by['ticket-platform-web'];
const need=[
  [a,'https://portal.vemoki.com/api/auth/callback'],
  [p,'https://portal.vemoki.com/api/auth/platform/callback'],
];
let ok=true;
for (const [c,u] of need) {
  if (!c || !(c.redirectUris||[]).includes(u)) { console.error('missing', u); ok=false; }
}
process.exit(ok?0:1);
" "$REALM"; then
    pass "realm JSON contains portal.vemoki.com redirect URIs"
  else
    fail "realm JSON missing portal.vemoki.com redirect URIs"
  fi
else
  info "realm JSON not found at $REALM (skip)"
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "PORTAL_PROD_CUTOVER_RESULT FAIL" >&2
  exit 1
fi
echo "PORTAL_PROD_CUTOVER_RESULT PASS"
echo "See docs/ops/PORTAL-PROD-CUTOVER.md"
