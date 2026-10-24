#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ROOT/../../../.." && pwd)"
BASE="http://127.0.0.1:3000"
SHA="$(git -C "$REPO" rev-parse HEAD)"
PROBE_OPEN_B64=$(base64 < "$ROOT/probe-mkt-sheet-open.js" | tr -d '\n')
PROBE_KB_B64=$(base64 < "$ROOT/probe-mkt-keyboard.js" | tr -d '\n')
PROBE_INTEREST_B64=$(base64 < "$ROOT/probe-interest-en.js" | tr -d '\n')
PROBE_WRAP_B64=$(base64 < "$ROOT/probe-chrome-wrap.js" | tr -d '\n')

unwrap_stdout() {
  python3 - "$1" <<'PY'
import json, sys
d = json.loads(open(sys.argv[1]).read())
r = d.get("result", d)
if isinstance(r, dict) and "stdout" in r:
    print(r["stdout"])
elif isinstance(r, dict) and "result" in r:
    inner = r["result"]
    if isinstance(inner, str):
        print(inner)
    else:
        print(json.dumps(inner))
else:
    print(json.dumps(r))
PY
}

run_eval_b64() {
  local page="$1" b64="$2" out="$3"
  orca exec --page "$page" --command "eval -b $b64" --json >"$out.raw"
  unwrap_stdout "$out.raw" >"$out"
}

capture_mkt_menu() {
  local name="$1" w="$2" h="$3" path="$4"
  local out_png="$ROOT/${name}.png"
  local out_json="$ROOT/${name}.json"
  echo "-> $name"
  local tab_json page
  tab_json=$(orca tab create --url "$BASE$path" --json)
  page=$(echo "$tab_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('browserPageId') or r.get('pageId',''))")
  [[ -n "$page" ]] || { echo "FAIL tab" >&2; exit 1; }
  orca exec --page "$page" --command "set viewport $w $h" --json >/dev/null
  sleep 2
  orca exec --page "$page" --command 'click [data-testid="mkt-nav-menu-toggle"]' --json >/dev/null
  sleep 1
  run_eval_b64 "$page" "$PROBE_OPEN_B64" "$out_json.tmp"
  run_eval_b64 "$page" "$PROBE_WRAP_B64" "$ROOT/${name}-wrap.json.tmp"
  python3 - "$out_json" "$out_json.tmp" "$ROOT/${name}-wrap.json.tmp" "$name" "$w" "$h" "$path" "$SHA" <<'PY'
import json, sys, pathlib
out, open_p, wrap_p, name, w, h, path, sha = sys.argv[1:9]
open_j = json.loads(pathlib.Path(open_p).read_text())
wrap_j = json.loads(pathlib.Path(wrap_p).read_text())
payload = {
  "capture": name,
  "persona": "public-guest",
  "url": f"http://127.0.0.1:3000{path}",
  "viewport": {"width": int(w), "height": int(h)},
  "sourceSha": sha,
  "sheet": open_j if isinstance(open_j, dict) else json.loads(open_j),
  "chromeWrap": wrap_j if isinstance(wrap_j, dict) else json.loads(wrap_j),
}
with open(out, "w") as f:
    json.dump(payload, f, indent=2)
PY
  local shot_json src
  shot_json=$(orca exec --page "$page" --command "screenshot" --json)
  src=$(echo "$shot_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('path') or r.get('screenshotPath') or '')")
  cp "$src" "$out_png"
  orca exec --page "$page" --command "press Tab" --json >/dev/null
  sleep 0.3
  run_eval_b64 "$page" "$PROBE_OPEN_B64" "$ROOT/${name}-tab.json.tmp"
  orca exec --page "$page" --command "press Escape" --json >/dev/null
  sleep 0.5
  run_eval_b64 "$page" "$PROBE_KB_B64" "$ROOT/${name}-esc.json.tmp"
  python3 - "$ROOT/${name}-esc.json" "$ROOT/${name}-esc.json.tmp" <<'PY'
import json, pathlib, sys
out, tmp = sys.argv[1:3]
raw = pathlib.Path(tmp).read_text()
try:
    j = json.loads(raw)
except json.JSONDecodeError:
    j = {"raw": raw}
pathlib.Path(out).write_text(json.dumps(j, indent=2))
PY
  rm -f "$out_json.tmp" "$ROOT/${name}-wrap.json.tmp" "$ROOT/${name}-tab.json.tmp" "$ROOT/${name}-esc.json.tmp" "$out_json.tmp.raw" 2>/dev/null || true
  orca tab close --page "$page" --json >/dev/null 2>&1 || true
}

capture_interest_en() {
  local name="local-mkt-interest-en-390"
  echo "-> $name"
  local tab_json page
  tab_json=$(orca tab create --url "$BASE/marketing/en#interest" --json)
  page=$(echo "$tab_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('browserPageId') or r.get('pageId',''))")
  orca exec --page "$page" --command "set viewport 390 844" --json >/dev/null
  sleep 2
  orca exec --page "$page" --command 'eval document.querySelector("#interest")?.scrollIntoView({block:"start"})' --json >/dev/null
  sleep 1
  run_eval_b64 "$page" "$PROBE_INTEREST_B64" "$ROOT/${name}.json.tmp"
  python3 - "$ROOT/${name}.json" "$ROOT/${name}.json.tmp" "$SHA" <<'PY'
import json, pathlib, sys
out, tmp, sha = sys.argv[1:4]
raw = pathlib.Path(tmp).read_text()
body = json.loads(raw) if raw.strip().startswith("{") else json.loads(json.loads(raw))
pathlib.Path(out).write_text(json.dumps({"capture": pathlib.Path(out).stem, "sourceSha": sha, "probe": body}, indent=2))
PY
  rm -f "$ROOT/${name}.json.tmp" "$ROOT/${name}.json.tmp.raw"
  shot_json=$(orca exec --page "$page" --command "screenshot" --json)
  src=$(echo "$shot_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('path') or r.get('screenshotPath') or '')")
  cp "$src" "$ROOT/${name}.png"
  orca tab close --page "$page" --json >/dev/null 2>&1 || true
}

capture_mkt_menu "local-mkt-320-vi-menu-open" 320 844 "/marketing"
capture_mkt_menu "local-mkt-360-vi-menu-open" 360 844 "/marketing"
capture_mkt_menu "local-mkt-390-vi-menu-open" 390 844 "/marketing"
capture_mkt_menu "local-mkt-390-en-menu-open" 390 844 "/marketing/en"
capture_mkt_menu "local-mkt-1024-en-menu-open" 1024 900 "/marketing/en"
capture_interest_en

echo "FA-WEB capture done"
