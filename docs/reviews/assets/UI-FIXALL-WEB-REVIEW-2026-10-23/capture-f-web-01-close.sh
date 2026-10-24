#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ROOT/../../../.." && pwd)"
SHA="$(git -C "$REPO" rev-parse HEAD)"
BASE="http://localhost:3000"
ASSET="$ROOT"
export WEB_UAT_USER="${WEB_UAT_USER:-attendee@example.com}"
export WEB_UAT_PASS="${WEB_UAT_PASS:-attendee-demo}"

b64() { base64 <"$1" | tr -d '\n'; }
unwrap() {
  python3 - "$1" <<'PY'
import json, sys
d = json.loads(open(sys.argv[1]).read())
r = d.get("result", d)
if isinstance(r, dict) and "stdout" in r:
    print(r["stdout"])
elif isinstance(r, dict) and "result" in r and isinstance(r["result"], str):
    print(r["result"])
else:
    print(json.dumps(r) if not isinstance(r, str) else r)
PY
}
eval_b64() {
  local page="$1" file="$2" out="$3"
  orca exec --page "$page" --command "eval -b $(b64 "$file")" --json >"$out.raw"
  unwrap "$out.raw" >"$out"
}
page_id() {
  python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('browserPageId') or r.get('pageId',''))"
}
shot() {
  local page="$1" dest="$2"
  local j src
  j=$(orca exec --page "$page" --command screenshot --json)
  src=$(echo "$j" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('path') or r.get('screenshotPath') or '')")
  cp "$src" "$dest"
}
kc_login_return() {
  local page="$1" return_path="$2"
  local enc
  enc=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$return_path', safe=''))")
  orca exec --page "$page" --command "goto ${BASE}/api/auth/logout" --json >/dev/null
  sleep 1
  orca exec --page "$page" --command "goto ${BASE}/api/auth/login?return=${enc}" --json >/dev/null
  sleep 2
  orca exec --page "$page" --command "fill \"input#username\" \"${WEB_UAT_USER}\"" --json >/dev/null
  orca exec --page "$page" --command "fill \"input#password\" \"${WEB_UAT_PASS}\"" --json >/dev/null
  orca exec --page "$page" --command 'click "#kc-login"' --json >/dev/null
  sleep 5
}

echo "F-WEB-01 attendee OIDC + redeem @390"
tab_json=$(orca tab create --url "${BASE}/" --json)
PAGE=$(echo "$tab_json" | page_id)
REDEEM_PATH='/redeem?tenantSlug=mfest-demo&eventSlug=mfest'
kc_login_return "$PAGE" "$REDEEM_PATH"
orca exec --page "$PAGE" --command "set viewport 390 844" --json >/dev/null
sleep 3
eval_b64 "$PAGE" "$ROOT/probe-viewport-persona.js" "$ASSET/review-attendee-persona-pre.json"
shot "$PAGE" "$ASSET/review-attendee-redeem-authenticated-390-vi.png"
# terms refusal: ensure unchecked, submit
orca exec --page "$PAGE" --command 'eval document.querySelector("#terms-accepted")&&(document.querySelector("#terms-accepted").checked=false)' --json >/dev/null 2>&1 || true
orca exec --page "$PAGE" --command 'fill "[data-testid=redeem-global-code]" "DEMO-MFEST-001"' --json >/dev/null 2>&1 || \
  orca exec --page "$PAGE" --command 'fill "input[name=code]" "DEMO-MFEST-001"' --json >/dev/null 2>&1 || true
orca exec --page "$PAGE" --command 'click button[type=submit]' --json >/dev/null 2>&1 || true
sleep 1
eval_b64 "$PAGE" "$ROOT/probe-redeem-terms-submit.js" "$ASSET/review-attendee-terms-refusal-390-vi.json"
shot "$PAGE" "$ASSET/review-attendee-terms-refusal-390-vi.png"

python3 - "$ASSET/review-attendee-oidc-390-vi.json" "$SHA" "$ASSET/review-attendee-persona-pre.json" "$ASSET/review-attendee-terms-refusal-390-vi.json" <<'PY'
import json, pathlib, sys
out, sha, persona_p, terms_p = sys.argv[1:5]
persona = json.loads(pathlib.Path(persona_p).read_text())
terms = json.loads(pathlib.Path(terms_p).read_text())
for raw in (persona, terms):
    if isinstance(raw, dict) and "result" in raw and isinstance(raw["result"], str):
        try:
            raw.update(json.loads(raw["result"]))
        except json.JSONDecodeError:
            pass
payload = {
  "capture": "review-attendee-oidc-390-vi",
  "sourceSha": sha,
  "persona": "authenticated-attendee",
  "authMethod": "Keycloak UI OIDC (ticket-web PKCE, localhost redirect)",
  "replacesOwnerArtifact": "docs/reviews/assets/FA-WEB-2026-10-23/local-redeem-terms-390-vi.png (mislabeled staff/desktop — exclude from AC proof)",
  "personaProbe": persona,
  "termsProbe": terms,
  "findingF-WEB-01": "closed" if "attendee@example.com" in json.dumps(persona) and terms.get("checked") is False else "open",
}
pathlib.Path(out).write_text(json.dumps(payload, indent=2))
PY

orca tab close --page "$PAGE" --json >/dev/null 2>&1 || true

echo "Consumer sheet keyboard @390"
tab_json=$(orca tab create --url "${BASE}/" --json)
PAGE=$(echo "$tab_json" | page_id)
orca exec --page "$PAGE" --command "set viewport 390 844" --json >/dev/null
sleep 2
orca exec --page "$PAGE" --command 'click [data-testid="nav-menu-toggle"]' --json >/dev/null
sleep 0.8
for _ in $(seq 1 8); do orca exec --page "$PAGE" --command "press Tab" --json >/dev/null; sleep 0.12; done
eval_b64 "$PAGE" "$ROOT/probe-consumer-keyboard.js" "$ASSET/review-consumer-kb-tabs.json"
orca exec --page "$PAGE" --command "press Escape" --json >/dev/null
sleep 0.5
eval_b64 "$PAGE" "$ROOT/probe-consumer-keyboard.js" "$ASSET/review-consumer-kb-escape.json"
orca exec --page "$PAGE" --command 'click [data-testid="nav-menu-toggle"]' --json >/dev/null
sleep 0.5
eval_b64 "$PAGE" "$ROOT/probe-consumer-keyboard.js" "$ASSET/review-consumer-kb-reopen.json"
python3 - "$ASSET/review-consumer-keyboard-390-vi.json" "$SHA" "$ASSET"/review-consumer-kb-*.json <<'PY'
import json, pathlib, sys
out, sha, *paths = sys.argv[1:]
steps = {}
for p in sorted(paths):
    raw = pathlib.Path(p).read_text()
    try:
        body = json.loads(raw)
        if isinstance(body, dict) and "result" in body:
            body = json.loads(body["result"]) if body["result"].startswith("{") else body
    except json.JSONDecodeError:
        body = {"raw": raw[:300]}
    steps[pathlib.Path(p).stem] = body
pathlib.Path(out).write_text(json.dumps({"capture": "review-consumer-keyboard-390-vi", "sourceSha": sha, "steps": steps}, indent=2))
PY
shot "$PAGE" "$ASSET/review-consumer-menu-390-vi.png"
orca tab close --page "$PAGE" --json >/dev/null 2>&1 || true

echo "EN interest validation @390"
tab_json=$(orca tab create --url "${BASE}/marketing/en#interest" --json)
PAGE=$(echo "$tab_json" | page_id)
orca exec --page "$PAGE" --command "set viewport 390 844" --json >/dev/null
sleep 2
orca exec --page "$PAGE" --command 'click [data-testid="interest-submit"]' --json >/dev/null
sleep 0.8
eval_b64 "$PAGE" "$ROOT/probe-interest-en-validation.js" "$ASSET/review-interest-en-validation-390.json"
shot "$PAGE" "$ASSET/review-interest-en-validation-390.png"
orca tab close --page "$PAGE" --json >/dev/null 2>&1 || true

echo "capture-f-web-01-close done"
