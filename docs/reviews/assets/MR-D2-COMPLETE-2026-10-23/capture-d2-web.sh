#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BASE="http://127.0.0.1:57277"
MKT="$BASE/design/ui-uplift-2026-10/marketing/index.html"
APP="$BASE/design/ui-uplift-2026-10/app/index.html"
PRESET_EN="$ROOT/../MR-FIX1-WEB-2026-10-23/preset-redeem-terms-en.js"
PRESET_EN_B64=$(base64 < "$PRESET_EN" | tr -d '\n')
PROBE_SECTIONS='JSON.stringify({sections:["top","trust","features","how-it-works","solutions","outcomes","faq","interest"].map(id=>({id,ok:!!document.getElementById(id)}))})'

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
  sleep 0.6
  # shellcheck disable=SC2086
  eval "$setup"
  sleep 1
  local meta_json probe_json
  meta_json=$(orca exec --page "$page" --command "eval JSON.stringify({viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},locale:document.documentElement.lang})" --json)
  probe_json=$(orca exec --page "$page" --command "eval $PROBE_SECTIONS" --json 2>/dev/null || echo '{"ok":false}')
  printf '%s' "$probe_json" > "$probe_out.raw"
  printf '%s' "$meta_json" > "$probe_out.meta"
  python3 - "$probe_out" "$probe_out.raw" "$probe_out.meta" "$w" "$h" "$name" <<'PY'
import json, sys, pathlib
out, probe_path, meta_path, w, h, name = sys.argv[1:7]
raw_probe = json.loads(pathlib.Path(probe_path).read_text())
raw_meta = json.loads(pathlib.Path(meta_path).read_text())
def unwrap(d):
    r = d.get("result", d)
    if isinstance(r, dict) and "stdout" in r:
        try:
            return json.loads(r["stdout"])
        except Exception:
            return r.get("stdout") or r
    if isinstance(r, dict) and "result" in r:
        inner = r["result"]
        if isinstance(inner, str):
            try:
                return json.loads(inner)
            except Exception:
                return {"raw": inner}
        return inner
    return r
probe = unwrap(raw_probe)
meta = unwrap(raw_meta)
if isinstance(meta, str):
    try:
        meta = json.loads(meta)
    except Exception:
        meta = {"raw": meta}
payload = {"capture": name, "viewport": {"width": int(w), "height": int(h)}, "live": meta, "probe": probe}
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

capture_page "marketing-hero-desktop-1280-en.png" 1280 900 "$MKT" \
  'orca exec --page "$page" --command "click #btn-desktop" --json >/dev/null; orca exec --page "$page" --command "click #locale-en" --json >/dev/null'

capture_page "marketing-interest-desktop-1280-en.png" 1280 900 "$MKT" \
  'orca exec --page "$page" --command "click #btn-desktop" --json >/dev/null; orca exec --page "$page" --command "click #locale-en" --json >/dev/null; orca exec --page "$page" --command "eval location.hash=\'#interest\'" --json >/dev/null'

capture_page "marketing-mobile-390-vi.png" 390 844 "$MKT" \
  'orca exec --page "$page" --command "click #btn-mobile" --json >/dev/null; orca exec --page "$page" --command "click #locale-vi" --json >/dev/null'

capture_page "app-redeem-terms-390-en.png" 390 844 "$APP" \
  "orca exec --page \"\$page\" --command \"click #btnMobile\" --json >/dev/null; orca exec --page \"\$page\" --command \"eval -b ${PRESET_EN_B64}\" --json >/dev/null"

capture_page "app-mobile-390-vi-sheet.png" 390 844 "$APP" \
  'orca exec --page "$page" --command "click #btnMobile" --json >/dev/null; orca exec --page "$page" --command "click #app-sheet-trigger" --json >/dev/null; sleep 0.8'

capture_page "app-catalog-desktop-1024-en.png" 1024 900 "$APP" \
  'orca exec --page "$page" --command "click #btnDesktop" --json >/dev/null; orca exec --page "$page" --command "click #locale-en" --json >/dev/null'

echo "D2 capture done: $ROOT"
