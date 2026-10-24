#!/usr/bin/env bash
# MR-R09 + D-2 evidence batch · Issue #859 · server :57277
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BASE="http://127.0.0.1:57277"
MKT="$BASE/design/ui-uplift-2026-10/marketing/index.html"
APP="$BASE/design/ui-uplift-2026-10/app/index.html"
ORCA=/usr/local/bin/orca
PRESET_EN="$ROOT/../../../reviews/assets/MR-FIX1-WEB-2026-10-23/preset-redeem-terms-en.js"
PRESET_EN_B64=$(base64 < "$PRESET_EN" | tr -d '\n')
PROBE_B64=$(base64 < "$ROOT/../../../agents/tools/ui-chrome-wrap-probe.js" | tr -d '\n')
PROBE_D2_B64=$(echo -n 'JSON.stringify({sections:["top","trust","features","how-it-works","solutions","outcomes","faq","interest"].map(id=>({id,ok:!!document.getElementById(id)}))})' | base64 | tr -d '\n')
META_B64=$(echo -n 'JSON.stringify({viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},locale:document.documentElement.lang,frameWidth:Math.round((document.querySelector(".browser")||document.body).getBoundingClientRect().width)})' | base64 | tr -d '\n')
DEVICE_MOBILE_B64=$(echo -n 'device("mobile")' | base64 | tr -d '\n')
DEVICE_DESKTOP_B64=$(echo -n 'device("desktop")' | base64 | tr -d '\n')
VIEW_MOBILE_B64=$(echo -n 'setView("mobile")' | base64 | tr -d '\n')
VIEW_DESKTOP_B64=$(echo -n 'setView("desktop")' | base64 | tr -d '\n')
HASH_INTEREST_B64=$(echo -n "location.hash='#interest'" | base64 | tr -d '\n')
# Hero [data-fade-in] is 300ms; reviewer settled captures wait ≥2s before screenshot
MKT_SETTLE_B64=$(echo -n 'new Promise(r=>{const el=document.querySelector(".mkt-hero-copy");const done=()=>setTimeout(r,2000);if(!el||!el.hasAttribute("data-fade-in")){done();return;}const end=()=>{el.removeEventListener("animationend",end);done();};el.addEventListener("animationend",end,{once:true});setTimeout(done,2500);})' | base64 | tr -d '\n')
MENU_CONTRAST_B64=$(base64 < "$ROOT/../../../reviews/assets/UI-FIXALL-PD-REVIEW-2026-10-23/probe-menu-contrast.js" | tr -d '\n')

mkdir -p "$ROOT"

capture_page() {
  local name="$1" w="$2" h="$3" url="$4" setup="$5"
  local out="$ROOT/${name}"
  local probe_out="$ROOT/${name%.png}.json"
  echo "-> $name (${w}x${h})"
  local tab_json page
  tab_json=$("$ORCA" tab create --url "$url" --json)
  page=$(echo "$tab_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('browserPageId') or r.get('pageId',''))")
  [[ -n "$page" ]] || { echo "FAIL tab: $tab_json" >&2; exit 1; }
  "$ORCA" exec --page "$page" --command "set viewport $w $h" --json >/dev/null
  sleep 1
  # shellcheck disable=SC2086
  eval "$setup"
  sleep 0.8
  local meta_json probe_json wrap_json
  meta_json=$("$ORCA" exec --page "$page" --command "eval -b $META_B64" --json)
  probe_json=$("$ORCA" exec --page "$page" --command "eval -b $PROBE_D2_B64" --json 2>/dev/null || echo '{"ok":false}')
  wrap_json=$("$ORCA" exec --page "$page" --command "eval -b $PROBE_B64" --json 2>/dev/null || echo '{}')
  printf '%s' "$probe_json" > "$probe_out.raw"
  printf '%s' "$meta_json" > "$probe_out.meta"
  printf '%s' "$wrap_json" > "$probe_out.wrap"
  python3 - "$probe_out" "$probe_out.raw" "$probe_out.meta" "$probe_out.wrap" "$w" "$h" "$name" <<'PY'
import json, sys, pathlib

def unwrap(d):
    r = d.get("result", d) if isinstance(d, dict) else d
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

out, probe_path, meta_path, wrap_path, w, h, name = sys.argv[1:8]

def load_raw(path):
    return unwrap(json.loads(pathlib.Path(path).read_text()))

probe = load_raw(probe_path)
meta = load_raw(meta_path)
wrap = load_raw(wrap_path)
if isinstance(meta, str):
    meta = json.loads(meta)
if isinstance(wrap, str):
    wrap = json.loads(wrap)
payload = {
    "capture": name,
    "viewport": {"width": int(w), "height": int(h)},
    "live": meta,
    "probe": probe,
    "chromeWrap": wrap,
}
with open(out, "w") as f:
    json.dump(payload, f, indent=2)
PY
  local shot_json src
  shot_json=$("$ORCA" exec --page "$page" --command "screenshot" --json)
  src=$(echo "$shot_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('path') or r.get('screenshotPath') or '')")
  [[ -n "$src" && -f "$src" ]] || { echo "FAIL shot $shot_json" >&2; exit 1; }
  cp "$src" "$out"
  "$ORCA" tab close --page "$page" --json >/dev/null 2>&1 || true
}

# D-2 desktop EN
capture_page "marketing-hero-desktop-1280-en.png" 1280 900 "$MKT" \
  "$ORCA exec --page \"\$page\" --command \"eval -b $DEVICE_DESKTOP_B64\" --json >/dev/null; $ORCA exec --page \"\$page\" --command \"click #locale-en\" --json >/dev/null"

capture_page "marketing-interest-form-desktop-1280-en.png" 1280 900 "$MKT" \
  "$ORCA exec --page \"\$page\" --command \"eval -b $DEVICE_DESKTOP_B64\" --json >/dev/null; $ORCA exec --page \"\$page\" --command \"click #locale-en\" --json >/dev/null; $ORCA exec --page \"\$page\" --command \"eval -b $HASH_INTEREST_B64\" --json >/dev/null"

# MR-R09 mobile chrome viewports
for w in 320 360 390; do
  capture_page "marketing-mobile-${w}-vi.png" "$w" 844 "$MKT" \
    "$ORCA exec --page \"\$page\" --command \"eval -b $DEVICE_MOBILE_B64\" --json >/dev/null; $ORCA exec --page \"\$page\" --command \"click #locale-vi\" --json >/dev/null; $ORCA exec --page \"\$page\" --command \"eval -b $MKT_SETTLE_B64\" --json >/dev/null"
  capture_page "app-mobile-${w}-vi.png" "$w" 844 "$APP" \
    "$ORCA exec --page \"\$page\" --command \"eval -b $VIEW_MOBILE_B64\" --json >/dev/null; $ORCA exec --page \"\$page\" --command \"click #locale-vi\" --json >/dev/null"
done

capture_page "app-redeem-terms-390-en.png" 390 844 "$APP" \
  "$ORCA exec --page \"\$page\" --command \"eval -b $VIEW_MOBILE_B64\" --json >/dev/null; $ORCA exec --page \"\$page\" --command \"eval -b ${PRESET_EN_B64}\" --json >/dev/null"

capture_page "app-mobile-390-vi-sheet.png" 390 844 "$APP" \
  "$ORCA exec --page \"\$page\" --command \"eval -b $VIEW_MOBILE_B64\" --json >/dev/null; $ORCA exec --page \"\$page\" --command \"click #app-sheet-trigger\" --json >/dev/null; sleep 0.8"

capture_page "marketing-mobile-390-vi-sheet.png" 390 844 "$MKT" \
  "$ORCA exec --page \"\$page\" --command \"eval -b $DEVICE_MOBILE_B64\" --json >/dev/null; $ORCA exec --page \"\$page\" --command \"click #locale-vi\" --json >/dev/null; $ORCA exec --page \"\$page\" --command \"eval -b $MKT_SETTLE_B64\" --json >/dev/null; $ORCA exec --page \"\$page\" --command \"click #mkt-sheet-trigger\" --json >/dev/null; sleep 0.8"

capture_page "app-catalog-desktop-1024-en.png" 1024 900 "$APP" \
  "$ORCA exec --page \"\$page\" --command \"eval -b $VIEW_DESKTOP_B64\" --json >/dev/null; $ORCA exec --page \"\$page\" --command \"click #locale-en\" --json >/dev/null"

echo "FIXALL PD capture done: $ROOT"
