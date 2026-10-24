#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BASE="http://127.0.0.1:57277"
MKT="$BASE/design/ui-uplift-2026-10/marketing/index.html"
APP="$BASE/design/ui-uplift-2026-10/app/index.html"
PROBE_JS="$ROOT/probe-form-en.js"
PROBE_B64=$(base64 < "$PROBE_JS" | tr -d '\n')
PRESET_EN="$ROOT/../MR-FIX1-WEB-2026-10-23/preset-redeem-terms-en.js"
PRESET_EN_B64=$(base64 < "$PRESET_EN" | tr -d '\n')

mkdir -p "$ROOT"

capture_page() {
  local name="$1" w="$2" h="$3" url="$4" setup="$5"
  local out="$ROOT/${name}"
  local probe_out="$ROOT/${name%.png}.json"
  echo "-> $name (${w}x${h})"
  local tab_json page
  tab_json=$(orca tab create --url "$url" --json)
  page=$(echo "$tab_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('browserPageId') or r.get('pageId',''))")
  [[ -n "$page" ]] || { echo "FAIL tab: $tab_json" >&2; exit 1; }
  orca exec --page "$page" --command "set viewport $w $h" --json >/dev/null
  sleep 0.5
  # shellcheck disable=SC2086
  eval "$setup"
  sleep 0.8
  local probe_json
  probe_json=$(orca exec --page "$page" --command "eval -b $PROBE_B64" --json)
  python3 - "$probe_out" "$probe_json" "$w" "$h" "$name" <<'PY'
import json, sys
out, raw, w, h, name = sys.argv[1], json.loads(sys.argv[2]), sys.argv[3], sys.argv[4], sys.argv[5]
def unwrap(d):
    r = d.get("result", d)
    if isinstance(r, dict) and "stdout" in r:
        try:
            return json.loads(r["stdout"])
        except Exception:
            return r
    return r
payload = {"capture": name, "viewport": {"width": int(w), "height": int(h)}, "probe": unwrap(raw)}
with open(out, "w") as f:
    json.dump(payload, f, indent=2)
PY
  local shot_json src
  shot_json=$(orca exec --page "$page" --command "screenshot" --json)
  src=$(echo "$shot_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('path') or r.get('screenshotPath') or '')")
  [[ -n "$src" && -f "$src" ]] || { echo "FAIL shot $shot_json" >&2; exit 1; }
  cp "$src" "$out"
  orca tab close --page "$page" --json >/dev/null 2>&1 || true
}

capture_page "marketing-mobile-390-vi.png" 390 844 "$MKT" \
  'orca exec --page "$page" --command "click #btn-mobile" --json >/dev/null'

capture_page "marketing-mobile-390-en.png" 390 844 "$MKT" \
  'orca exec --page "$page" --command "click #btn-mobile" --json >/dev/null; orca exec --page "$page" --command "click #locale-en" --json >/dev/null'

capture_page "marketing-en-form-390.png" 390 844 "$MKT" \
  'orca exec --page "$page" --command "click #btn-mobile" --json >/dev/null; orca exec --page "$page" --command "click #locale-en" --json >/dev/null; orca exec --page "$page" --command "goto ${MKT}#interest" --json >/dev/null'

capture_page "marketing-desktop-1280-en.png" 1280 900 "$MKT" \
  'orca exec --page "$page" --command "click #locale-en" --json >/dev/null'

capture_page "app-mobile-390-vi-sheet.png" 390 844 "$APP" \
  'orca exec --page "$page" --command "click #btnMobile" --json >/dev/null; orca exec --page "$page" --command "click #app-sheet-trigger" --json >/dev/null'

capture_page "app-redeem-terms-390-en.png" 390 844 "$APP" \
  'orca exec --page "$page" --command "click #btnMobile" --json >/dev/null; orca exec --page "$page" --command "eval -b $PRESET_EN_B64" --json >/dev/null'

echo "Capture done: $ROOT"
