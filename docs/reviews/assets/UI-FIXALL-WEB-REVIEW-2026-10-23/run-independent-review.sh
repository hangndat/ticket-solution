#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ROOT/../../../.." && pwd)"
BASE="http://localhost:3000"
SHA="$(git -C "$REPO" rev-parse HEAD)"
PROBE_KB="$ROOT/probe-keyboard-full.js"
PROBE_CONS="$ROOT/probe-consumer-links.js"
PROBE_SESS="$ROOT/probe-attendee-session.js"
OPEN_PROBE="$REPO/docs/reviews/assets/FA-WEB-2026-10-23/probe-mkt-sheet-open.js"
WRAP_PROBE="$REPO/docs/agents/tools/ui-chrome-wrap-probe.js"

b64() { base64 <"$1" | tr -d '\n'; }

unwrap() {
  python3 - "$1" <<'PY'
import json, sys
d = json.loads(open(sys.argv[1]).read())
r = d.get("result", d)
if isinstance(r, dict) and "stdout" in r:
    print(r["stdout"])
else:
    print(json.dumps(r) if not isinstance(r, str) else r)
PY
}

eval_b64() {
  local page="$1" b="$2" out="$3"
  orca exec --page "$page" --command "eval -b $b" --json >"$out.raw"
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

echo "SHA=$SHA"

# --- Keyboard journey @390 VI ---
tab_json=$(orca tab create --url "$BASE/marketing" --json)
PAGE=$(echo "$tab_json" | page_id)
orca exec --page "$PAGE" --command "set viewport 390 844" --json >/dev/null
sleep 2
orca exec --page "$PAGE" --command 'click [data-testid="mkt-nav-menu-toggle"]' --json >/dev/null
sleep 0.8
eval_b64 "$PAGE" "$(b64 "$OPEN_PROBE")" "$ROOT/review-kb-open.json"
# Tab through dialog links (7 links + 2 buttons ≈ 9 tabs)
for _ in $(seq 1 12); do
  orca exec --page "$PAGE" --command "press Tab" --json >/dev/null
  sleep 0.15
done
eval_b64 "$PAGE" "$(b64 "$PROBE_KB")" "$ROOT/review-kb-after-tabs.json"
orca exec --page "$PAGE" --command "press Shift+Tab" --json >/dev/null
sleep 0.2
eval_b64 "$PAGE" "$(b64 "$PROBE_KB")" "$ROOT/review-kb-after-shift-tab.json"
orca exec --page "$PAGE" --command "press Escape" --json >/dev/null
sleep 0.5
eval_b64 "$PAGE" "$(b64 "$PROBE_KB")" "$ROOT/review-kb-after-escape.json"
orca exec --page "$PAGE" --command 'click [data-testid="mkt-nav-menu-toggle"]' --json >/dev/null
sleep 0.5
eval_b64 "$PAGE" "$(b64 "$OPEN_PROBE")" "$ROOT/review-kb-reopen.json"
shot "$PAGE" "$ROOT/review-kb-390-vi-sheet.png"
orca tab close --page "$PAGE" --json >/dev/null 2>&1 || true

python3 - "$ROOT/review-keyboard-390-vi.json" "$SHA" "$ROOT"/review-kb-*.json <<'PY'
import json, pathlib, sys
out, sha, *paths = sys.argv[1:]
payload = {"capture": "review-keyboard-390-vi", "sourceSha": sha, "steps": {}}
for p in paths:
    name = pathlib.Path(p).stem
    raw = pathlib.Path(p).read_text().strip()
    try:
        payload["steps"][name] = json.loads(raw)
    except json.JSONDecodeError:
        payload["steps"][name] = {"raw": raw[:500]}
with open(out, "w") as f:
    json.dump(payload, f, indent=2)
PY

# --- Consumer home @390 VI ---
tab_json=$(orca tab create --url "$BASE/" --json)
PAGE=$(echo "$tab_json" | page_id)
orca exec --page "$PAGE" --command "set viewport 390 844" --json >/dev/null
sleep 2
eval_b64 "$PAGE" "$(b64 "$PROBE_CONS")" "$ROOT/review-consumer-390-vi-initial.json"
orca exec --page "$PAGE" --command 'click [data-testid="home-catalog-filter-past"]' --json >/dev/null
sleep 0.8
eval_b64 "$PAGE" "$(b64 "$PROBE_CONS")" "$ROOT/review-consumer-390-vi-past.json"
shot "$PAGE" "$ROOT/review-consumer-390-vi-past.png"
orca tab close --page "$PAGE" --json >/dev/null 2>&1 || true

# --- Attendee redeem session probe (no OTP echo) ---
tab_json=$(orca tab create --url "$BASE/redeem?tenantSlug=mfest-demo&eventSlug=mfest" --json)
PAGE=$(echo "$tab_json" | page_id)
orca exec --page "$PAGE" --command "set viewport 390 844" --json >/dev/null
sleep 3
eval_b64 "$PAGE" "$(b64 "$PROBE_SESS")" "$ROOT/review-attendee-session.json"
shot "$PAGE" "$ROOT/review-attendee-redeem.png"
orca tab close --page "$PAGE" --json >/dev/null 2>&1 || true

# --- Chrome wrap @320 ---
tab_json=$(orca tab create --url "$BASE/marketing" --json)
PAGE=$(echo "$tab_json" | page_id)
orca exec --page "$PAGE" --command "set viewport 320 844" --json >/dev/null
sleep 2
eval_b64 "$PAGE" "$(b64 "$WRAP_PROBE")" "$ROOT/review-chrome-wrap-320.json"
shot "$PAGE" "$ROOT/review-chrome-wrap-320.png"
orca tab close --page "$PAGE" --json >/dev/null 2>&1 || true

echo "Independent review capture done"
