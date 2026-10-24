#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BASE="http://localhost:3000"
export WEB_UAT_USER="${WEB_UAT_USER:-attendee@example.com}"
export WEB_UAT_PASS="${WEB_UAT_PASS:-attendee-demo}"
b64() { base64 <"$1" | tr -d '\n'; }
unwrap() { python3 - "$1" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
r=d.get("result",d)
print(r.get("stdout", r.get("result", json.dumps(r))))
PY
}
eval_b64() {
  orca exec --page "$1" --command "eval -b $(b64 "$2")" --json >"$3.raw"
  unwrap "$3.raw" >"$3"
}
page_id() { python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('browserPageId') or '')"; }

BFF_JS="$ROOT/probe-bff-me.js"
cat >"$BFF_JS" <<'JS'
(async function () {
  const r = await fetch('/api/bff/me', { credentials: 'include' });
  const body = await r.json().catch(() => ({}));
  return JSON.stringify({ status: r.status, email: body.email, subject: body.subject });
})();
JS

PROBE_INT="$ROOT/probe-interest-en-validation.js"
cat >"$PROBE_INT" <<'JS'
(function () {
  var errs = [...document.querySelectorAll('[data-testid="interest-form"] [id$="-err-name"], [data-testid="interest-form"] [id$="-err-email"], [data-testid="interest-form"] [id$="-err-org"], [data-testid="interest-form"] [id$="-err-role"], [data-testid="interest-form"] [id$="-err-consent"]')]
    .map(function (el) { return (el.innerText || '').trim(); })
    .filter(Boolean);
  return JSON.stringify({
    measuredViewport: { innerWidth: innerWidth, innerHeight: innerHeight, devicePixelRatio: devicePixelRatio },
    locale: document.documentElement.lang,
    validationMessages: errs,
    hasEnterYourName: errs.some(function (m) { return /Enter your name/i.test(m); }),
  });
})();
JS

PROBE_TERMS="$ROOT/probe-redeem-terms-submit.js"
cat >"$PROBE_TERMS" <<'JS'
(function () {
  var cb = document.querySelector('#terms-accepted');
  var err = document.querySelector('[data-testid="redeem-terms-consent"] [role="alert"], [id*="terms"]');
  var texts = [...document.querySelectorAll('p, [role="alert"]')].map(function (el) {
    return (el.innerText || '').trim();
  }).filter(function (t) { return /điều khoản|terms/i.test(t); });
  return JSON.stringify({
    measuredViewport: { innerWidth: innerWidth, innerHeight: innerHeight, devicePixelRatio: devicePixelRatio },
    checked: cb ? cb.checked : null,
    termsTexts: texts.slice(0, 5),
    consentPresent: !!document.querySelector('[data-testid="redeem-terms-consent"]'),
  });
})();
JS

# Attendee terms refusal (reuse login flow)
tab_json=$(orca tab create --url "${BASE}/" --json)
PAGE=$(echo "$tab_json" | page_id)
orca exec --page "$PAGE" --command "goto ${BASE}/api/auth/logout" --json >/dev/null
sleep 1
ENC='%2Fredeem%3FtenantSlug%3Dmfest-demo%26eventSlug%3Dmfest'
orca exec --page "$PAGE" --command "goto ${BASE}/api/auth/login?return=${ENC}" --json >/dev/null
sleep 2
orca exec --page "$PAGE" --command "fill \"input#username\" \"${WEB_UAT_USER}\"" --json >/dev/null
orca exec --page "$PAGE" --command "fill \"input#password\" \"${WEB_UAT_PASS}\"" --json >/dev/null
orca exec --page "$PAGE" --command 'click "#kc-login"' --json >/dev/null
sleep 5
orca exec --page "$PAGE" --command "set viewport 390 844" --json >/dev/null
sleep 2
eval_b64 "$PAGE" "$BFF_JS" "$ROOT/review-attendee-bff-me.json"
orca exec --page "$PAGE" --command 'eval document.querySelector("[data-testid=redeem-terms-consent]")?.scrollIntoView({block:"center"})' --json >/dev/null
sleep 0.5
orca exec --page "$PAGE" --command 'fill "[data-testid=redeem-global-code]" "DEMO-MFEST-001"' --json >/dev/null 2>&1 || true
orca exec --page "$PAGE" --command 'eval var c=document.querySelector("#terms-accepted"); if(c) c.checked=false' --json >/dev/null
orca exec --page "$PAGE" --command 'press Enter' --json >/dev/null
sleep 1
eval_b64 "$PAGE" "$PROBE_TERMS" "$ROOT/review-attendee-terms-refusal-390-vi.json"
j=$(orca exec --page "$PAGE" --command screenshot --json)
src=$(echo "$j" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('path') or '')")
cp "$src" "$ROOT/review-attendee-terms-refusal-390-vi.png"
orca tab close --page "$PAGE" --json >/dev/null 2>&1 || true

# EN interest validation
tab_json=$(orca tab create --url "${BASE}/marketing/en#interest" --json)
PAGE=$(echo "$tab_json" | page_id)
orca exec --page "$PAGE" --command "set viewport 390 844" --json >/dev/null
sleep 2
orca exec --page "$PAGE" --command 'eval document.querySelector("#interest")?.scrollIntoView({block:"start"})' --json >/dev/null
sleep 1
orca exec --page "$PAGE" --command 'click [data-testid="interest-submit"]' --json >/dev/null
sleep 0.8
eval_b64 "$PAGE" "$PROBE_INT" "$ROOT/review-interest-en-validation-390.json"
j=$(orca exec --page "$PAGE" --command screenshot --json)
src=$(echo "$j" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('path') or '')")
cp "$src" "$ROOT/review-interest-en-validation-390.png"
orca tab close --page "$PAGE" --json >/dev/null 2>&1 || true

# Consumer escape focus fix check
tab_json=$(orca tab create --url "${BASE}/" --json)
PAGE=$(echo "$tab_json" | page_id)
orca exec --page "$PAGE" --command "set viewport 390 844" --json >/dev/null
sleep 2
orca exec --page "$PAGE" --command 'click [data-testid="nav-menu-toggle"]' --json >/dev/null
sleep 0.5
orca exec --page "$PAGE" --command "press Escape" --json >/dev/null
sleep 0.5
eval_b64 "$PAGE" "$ROOT/probe-consumer-keyboard.js" "$ROOT/review-consumer-kb-escape-v2.json"
orca tab close --page "$PAGE" --json >/dev/null 2>&1 || true

echo supplement done
