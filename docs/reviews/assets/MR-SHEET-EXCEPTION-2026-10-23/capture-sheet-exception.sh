#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BASE="http://127.0.0.1:57277"
MKT="$BASE/design/ui-uplift-2026-10/marketing/index.html"
APP="$BASE/design/ui-uplift-2026-10/app/index.html"
PROBE_OPEN_B64=$(base64 < "$ROOT/probe-sheet-open.js" | tr -d '\n')
PROBE_KB_B64=$(base64 < "$ROOT/probe-keyboard.js" | tr -d '\n')

mkdir -p "$ROOT"

unwrap_stdout() {
  python3 - "$1" <<'PY'
import json, sys
d = json.loads(open(sys.argv[1]).read())
r = d.get("result", d)
if isinstance(r, dict) and "result" in r:
    inner = r["result"]
    if isinstance(inner, str):
        try:
            print(json.dumps(json.loads(inner)))
        except Exception:
            print(json.dumps({"raw": inner}))
    else:
        print(json.dumps(inner))
elif isinstance(r, dict) and "stdout" in r:
    print(r["stdout"])
else:
    print(json.dumps(r))
PY
}

run_probe() {
  local page="$1" out="$2"
  local raw
  orca exec --page "$page" --command "eval -b $PROBE_OPEN_B64" --json >"$out.raw"
  unwrap_stdout "$out.raw" >"$out"
}

run_kb_probe() {
  local page="$1" out="$2"
  orca exec --page "$page" --command "eval -b $PROBE_KB_B64" --json >"$out.raw"
  unwrap_stdout "$out.raw" >"$out"
}

capture_sheet() {
  local name="$1" w="$2" h="$3" url="$4" setup="$5" trigger="$6"
  local out="$ROOT/${name}"
  local probe_out="$ROOT/${name%.png}.json"
  echo "-> $name"
  local tab_json page
  tab_json=$(orca tab create --url "$url" --json)
  page=$(echo "$tab_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('browserPageId') or r.get('pageId',''))")
  [[ -n "$page" ]] || { echo "FAIL tab" >&2; exit 1; }
  orca exec --page "$page" --command "set viewport $w $h" --json >/dev/null
  sleep 1
  # shellcheck disable=SC2086
  eval "$setup"
  sleep 2
  orca exec --page "$page" --command "click $trigger" --json >/dev/null
  sleep 1.5
  run_probe "$page" "$probe_out"
  local meta
  orca exec --page "$page" --command "eval JSON.stringify({viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},locale:document.documentElement.lang})" --json >"$probe_out.meta"
  meta=$(unwrap_stdout "$probe_out.meta")
  python3 - "$probe_out" "$meta" "$name" "$w" "$h" <<'PY'
import json, sys, pathlib
out, meta_s, name, w, h = sys.argv[1:6]
meta = json.loads(meta_s)
probe = json.loads(pathlib.Path(out).read_text())
payload = {"capture": name, "viewport": {"width": int(w), "height": int(h)}, "live": meta, "probe": probe}
with open(out, "w") as f:
    json.dump(payload, f, indent=2)
PY
  local shot_json src
  shot_json=$(orca exec --page "$page" --command "screenshot" --json)
  src=$(echo "$shot_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('path') or r.get('screenshotPath') or '')")
  cp "$src" "$out"
  # Tab focus trap
  orca exec --page "$page" --command "press Tab" --json >/dev/null
  sleep 0.3
  run_probe "$page" "$ROOT/${name%.png}-tab.json"
  orca exec --page "$page" --command "press Escape" --json >/dev/null
  sleep 0.5
  run_kb_probe "$page" "$ROOT/${name%.png}-esc.json"
  orca tab close --page "$page" --json >/dev/null 2>&1 || true
}

capture_sheet "marketing-mobile-390-vi-sheet-open.png" 390 844 "$MKT" \
  'orca exec --page "$page" --command "click #btn-mobile" --json >/dev/null; orca exec --page "$page" --command "click #locale-vi" --json >/dev/null' \
  "#mkt-sheet-trigger"

capture_sheet "marketing-mobile-390-en-sheet-open.png" 390 844 "$MKT" \
  'orca exec --page "$page" --command "click #btn-mobile" --json >/dev/null; orca exec --page "$page" --command "click #locale-en" --json >/dev/null' \
  "#mkt-sheet-trigger"

capture_sheet "app-mobile-390-vi-sheet-open.png" 390 844 "$APP" \
  'orca exec --page "$page" --command "click #btnMobile" --json >/dev/null; orca exec --page "$page" --command "click #locale-vi" --json >/dev/null' \
  "#app-sheet-trigger"

capture_sheet "app-mobile-390-en-sheet-open.png" 390 844 "$APP" \
  'orca exec --page "$page" --command "click #btnMobile" --json >/dev/null; orca exec --page "$page" --command "click #locale-en" --json >/dev/null' \
  "#app-sheet-trigger"

# Regression 1024 desktop marketing
capture_reg() {
  local name="$1"
  local out="$ROOT/${name}"
  local probe_out="$ROOT/${name%.png}.json"
  tab_json=$(orca tab create --url "$MKT" --json)
  page=$(echo "$tab_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('browserPageId') or '')")
  orca exec --page "$page" --command "set viewport 1024 900" --json >/dev/null
  sleep 0.8
  orca exec --page "$page" --command "click #btn-desktop" --json >/dev/null
  orca exec --page "$page" --command "click #locale-en" --json >/dev/null
  sleep 0.8
  run_probe "$page" "$probe_out"
  shot_json=$(orca exec --page "$page" --command "screenshot" --json)
  src=$(echo "$shot_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('path') or '')")
  cp "$src" "$out"
  orca tab close --page "$page" --json >/dev/null 2>&1 || true
}
capture_reg "marketing-desktop-1024-en.png"

echo "Sheet exception capture done: $ROOT"
