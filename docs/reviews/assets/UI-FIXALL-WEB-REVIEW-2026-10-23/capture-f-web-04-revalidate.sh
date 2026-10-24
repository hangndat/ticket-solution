#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ROOT/../../../.." && pwd)"
SHA="$(git -C "$REPO" rev-parse HEAD)"
BASE="http://localhost:3000"
PROBE="$ROOT/probe-consumer-kb-full.js"
MKT_OPEN="$REPO/docs/reviews/assets/FA-WEB-2026-10-23/probe-mkt-sheet-open.js"

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
    print(json.dumps(r))
PY
}
eval_b64() {
  orca exec --page "$1" --command "eval -b $(b64 "$2")" --json >"$3.raw"
  unwrap "$3.raw" >"$3"
}
page_id() {
  python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('browserPageId') or '')"
}

run_consumer_kb() {
  local name="$1" url="$2"
  echo "-> $name"
  local tab_json PAGE
  tab_json=$(orca tab create --url "$url" --json)
  PAGE=$(echo "$tab_json" | page_id)
  orca exec --page "$PAGE" --command "set viewport 390 844" --json >/dev/null
  sleep 2
  orca exec --page "$PAGE" --command 'click [data-testid="nav-menu-toggle"]' --json >/dev/null
  sleep 0.6
  eval_b64 "$PAGE" "$PROBE" "$ROOT/${name}-open.json"
  for _ in $(seq 1 10); do
    orca exec --page "$PAGE" --command "press Tab" --json >/dev/null
    sleep 0.1
  done
  eval_b64 "$PAGE" "$PROBE" "$ROOT/${name}-tabs.json"
  orca exec --page "$PAGE" --command "press Shift+Tab" --json >/dev/null
  sleep 0.15
  eval_b64 "$PAGE" "$PROBE" "$ROOT/${name}-shift-tab.json"
  orca exec --page "$PAGE" --command "press Escape" --json >/dev/null
  sleep 0.5
  eval_b64 "$PAGE" "$PROBE" "$ROOT/${name}-escape.json"
  orca exec --page "$PAGE" --command 'click [data-testid="nav-menu-toggle"]' --json >/dev/null
  sleep 0.5
  eval_b64 "$PAGE" "$PROBE" "$ROOT/${name}-reopen.json"
  orca exec --page "$PAGE" --command 'click [data-testid="nav-menu-toggle"]' --json >/dev/null
  sleep 0.5
  orca exec --page "$PAGE" --command 'click [data-testid="nav-mobile-menu"] a[href="/redeem"]' --json >/dev/null 2>&1 || \
    orca exec --page "$PAGE" --command 'eval var a=document.querySelector("[data-testid=nav-mobile-menu] a"); if(a) a.click()' --json >/dev/null
  sleep 1
  eval_b64 "$PAGE" "$PROBE" "$ROOT/${name}-after-nav.json"
  j=$(orca exec --page "$PAGE" --command screenshot --json)
  src=$(echo "$j" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'].get('path',''))")
  cp "$src" "$ROOT/${name}.png"
  orca tab close --page "$PAGE" --json >/dev/null 2>&1 || true

  python3 - "$ROOT/${name}-summary.json" "$SHA" "$name" "$ROOT/${name}"-*.json <<'PY'
import json, pathlib, sys
out, sha, name, *paths = sys.argv[1:]
steps = {}
for p in sorted(paths):
    if p.endswith("-summary.json"):
        continue
    stem = pathlib.Path(p).stem.replace(name + "-", "")
    raw = pathlib.Path(p).read_text()
    try:
        steps[stem] = json.loads(raw)
    except json.JSONDecodeError:
        steps[stem] = {"raw": raw[:200]}
esc = steps.get("escape", {})
pass_esc = esc.get("focusOnTrigger") is True and esc.get("dialogOpen") is False
pathlib.Path(out).write_text(
    json.dumps(
        {
            "capture": name,
            "sourceSha": sha,
            "ac": "F-WEB-04 consumer sheet keyboard @390",
            "escapeFocusOnTrigger": pass_esc,
            "steps": steps,
        },
        indent=2,
    )
)
PY
}

run_consumer_kb "review-consumer-kb-390-vi" "${BASE}/"

echo "Marketing smoke @390 VI + EN"
tab_json=$(orca tab create --url "${BASE}/marketing" --json)
PAGE=$(echo "$tab_json" | page_id)
orca exec --page "$PAGE" --command "set viewport 390 844" --json >/dev/null
sleep 2
orca exec --page "$PAGE" --command 'click [data-testid="mkt-nav-menu-toggle"]' --json >/dev/null
sleep 0.5
eval_b64 "$PAGE" "$MKT_OPEN" "$ROOT/review-mkt-smoke-390-vi.json"
orca exec --page "$PAGE" --command "press Escape" --json >/dev/null
sleep 0.5
eval_b64 "$PAGE" "$PROBE" "$ROOT/review-mkt-smoke-390-vi-kb.json"
orca tab close --page "$PAGE" --json >/dev/null 2>&1 || true

tab_json=$(orca tab create --url "${BASE}/marketing/en" --json)
PAGE=$(echo "$tab_json" | page_id)
orca exec --page "$PAGE" --command "set viewport 390 844" --json >/dev/null
sleep 2
orca exec --page "$PAGE" --command 'click [data-testid="mkt-nav-menu-toggle"]' --json >/dev/null
sleep 0.5
eval_b64 "$PAGE" "$MKT_OPEN" "$ROOT/review-mkt-smoke-390-en.json"
orca exec --page "$PAGE" --command "press Escape" --json >/dev/null
sleep 0.5
eval_b64 "$PAGE" "$PROBE" "$ROOT/review-mkt-smoke-390-en-kb.json"
orca tab close --page "$PAGE" --json >/dev/null 2>&1 || true

echo "F-WEB-04 revalidate done"
