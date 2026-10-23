#!/usr/bin/env bash
# Independent review capture — SHA 8014fc30, fixture portal-fix-838
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
WEB_ASSETS="$(cd "$ROOT/../web" && pwd)"
PROBE_JS="$WEB_ASSETS/probe-pa01-runtime.js"
CHROME_PROBE="$(cd "$ROOT/../../../../agents/tools" && pwd)/ui-chrome-wrap-probe.js"
PROBE_B64=$(base64 < "$PROBE_JS" | tr -d '\n')
CHROME_B64=$(base64 < "$CHROME_PROBE" | tr -d '\n')
LOGIN_FIXTURE="/tmp/portal-fix-838-runtime/login-fixture.py"
BASE="http://127.0.0.1:3413"
T1="d9d9f001-0001-4000-8000-000000000001"
E1="d9d9f001-0002-4000-8000-000000000001"
T2="d9d9f001-0001-4000-8000-000000000002"
E2="d9d9f001-0002-4000-8000-000000000002"
REVIEW_SHA="8014fc30796c25243e954e2d0e6c325de3e03f01"

mkdir -p "$ROOT/evidence"

ensure_auth() {
  local page="$1" return_path="$2"
  orca exec --page "$page" --command "goto $BASE/api/auth/login?return=$return_path" --json >/dev/null
  sleep 2
  python3 "$LOGIN_FIXTURE" --page "$page" >/dev/null 2>&1 || true
  sleep 2
  orca exec --page "$page" --command "goto $return_path" --json >/dev/null
  sleep 2
}

set_locale() {
  local page="$1" loc="$2" path="$3"
  orca exec --page "$page" --command "goto $path" --json >/dev/null
  sleep 1
  orca exec --page "$page" --command 'click [data-testid=account-menu]' --json >/dev/null 2>&1 || true
  sleep 0.4
  if [[ "$loc" == "en" ]]; then
    orca exec --page "$page" --command 'click [data-testid=portal-locale-en]' --json >/dev/null 2>&1 || true
  else
    orca exec --page "$page" --command 'click [data-testid=portal-locale-vi]' --json >/dev/null 2>&1 || true
  fi
  sleep 1
  orca exec --page "$page" --command "goto $path" --json >/dev/null
  sleep 1.2
}

meta_probe() {
  local page="$1" out="$2"
  orca exec --page "$page" --command 'eval JSON.stringify({p:location.pathname,l:document.documentElement.lang,w:window.innerWidth,h:window.innerHeight})' --json > "$out"
}

run_probes() {
  local page="$1" probe_out="$2" chrome_out="$3" merged="$4"
  orca exec --page "$page" --command "eval -b $PROBE_B64" --json > "$probe_out"
  orca exec --page "$page" --command "eval -b $CHROME_B64" --json > "$chrome_out"
  python3 - "$probe_out" "$chrome_out" "$merged" <<'PY'
import json, sys
def unwrap_file(path):
    d = json.load(open(path))
    r = d.get("result", d)
    if isinstance(r, dict) and "result" in r:
        inner = r["result"]
        if isinstance(inner, dict):
            return inner
        if isinstance(inner, str):
            try:
                return json.loads(inner)
            except Exception:
                return {"raw": inner}
    return r
payload = {"pa01": unwrap_file(sys.argv[1]), "chrome": unwrap_file(sys.argv[2])}
with open(sys.argv[3], "w") as f:
    json.dump(payload, f)
PY
}

capture_viewport() {
  local name="$1" w="$2" h="$3" locale="$4" path="$5"
  local out_png="$ROOT/${name}.png"
  local out_json="$ROOT/evidence/${name}.json"
  echo "==> $name ${w}x${h} locale=$locale"
  local tab_json page
  tab_json=$(orca tab create --url "$path" --json)
  page=$(echo "$tab_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('browserPageId') or d.get('browserPageId',''))")
  ensure_auth "$page" "$path"
  set_locale "$page" "$locale" "$path"
  orca exec --page "$page" --command "set viewport $w $h" --json >/dev/null
  sleep 0.9
  local meta_tmp probe_raw chrome_raw probes_merged
  meta_tmp=$(mktemp)
  probe_raw=$(mktemp)
  chrome_raw=$(mktemp)
  probes_merged=$(mktemp)
  meta_probe "$page" "$meta_tmp"
  run_probes "$page" "$probe_raw" "$chrome_raw" "$probes_merged"
  python3 - "$out_json" "$meta_tmp" "$probes_merged" "$locale" "$path" <<'PY'
import json, sys
out, meta_path, probes_path, locale, path = sys.argv[1:6]
meta_d = json.load(open(meta_path))
meta_r = meta_d.get("result", meta_d).get("result", "")
if isinstance(meta_r, str):
    meta_obj = json.loads(meta_r)
else:
    meta_obj = meta_r if isinstance(meta_r, dict) else {}
probes = json.load(open(probes_path))
payload = {
  "reviewSHA": "8014fc30796c25243e954e2d0e6c325de3e03f01",
  "localeActive": locale,
  "route": path,
  "meta": {
    "pathname": meta_obj.get("p"),
    "htmlLang": meta_obj.get("l"),
    "innerViewport": f"{meta_obj.get('w')}x{meta_obj.get('h')}" if meta_obj.get("w") else None,
  },
  "probes": probes,
}
with open(out, "w") as f:
    json.dump(payload, f, indent=2)
PY
  rm -f "$meta_tmp" "$probe_raw" "$chrome_raw" "$probes_merged"
  local shot_json src
  shot_json=$(orca exec --page "$page" --command "screenshot" --json)
  src=$(echo "$shot_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('path') or r.get('screenshotPath') or '')")
  cp "$src" "$out_png"
  orca tab close --page "$page" --json >/dev/null 2>&1 || true
}

GUESTS1="$BASE/t/$T1/e/$E1/guests"
GATE1="$BASE/t/$T1/e/$E1/gate"
GUESTS2="$BASE/t/$T2/e/$E2/guests"

capture_viewport "runtime-review-vi-guests-390x844" 390 844 vi "$GUESTS1"
capture_viewport "runtime-review-vi-guests-768x1024" 768 1024 vi "$GUESTS1"
capture_viewport "runtime-review-en-guests-390x844" 390 844 en "$GUESTS1"
capture_viewport "runtime-review-vi-guests-430x932" 430 932 vi "$GUESTS1"
capture_viewport "runtime-review-vi-gate-1024x900" 1024 900 vi "$GATE1"
capture_viewport "runtime-review-vi-gate-1440x1000" 1440 1000 vi "$GATE1"
capture_viewport "runtime-review-vi-tenant2-guests-390x844" 390 844 vi "$GUESTS2"

# PA-03/05/06 focused tab on guests1 VI
tab_json=$(orca tab create --url "$GUESTS1" --json)
page=$(echo "$tab_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('browserPageId') or '')")
ensure_auth "$page" "$GUESTS1"
set_locale "$page" vi "$GUESTS1"
orca exec --page "$page" --command "set viewport 1024 900" --json >/dev/null
sleep 1
# Import tab default; probe filters aria
orca exec --page "$page" --command 'click [data-testid=portal-guests-tab-export]' --json >/dev/null 2>&1 || orca exec --page "$page" --command 'eval location.hash="#export"; void 0' --json >/dev/null
sleep 1
orca exec --page "$page" --command 'eval JSON.stringify({tabHash:location.hash,exportInput:document.querySelector("input[aria-label]")?.getAttribute("aria-label"),exportPlaceholder:document.querySelector("input[placeholder]")?.getAttribute("placeholder"),importFiltersAria:document.querySelector("[aria-label*=catalog]")?.getAttribute("aria-label")})' --json > "$ROOT/evidence/pa03-pa05-spot.json" 2>&1 || true
# Back to import
orca exec --page "$page" --command 'eval location.hash="#import"; void 0' --json >/dev/null
sleep 1
orca exec --page "$page" --command 'eval JSON.stringify({importAria:document.querySelector("[aria-label]")?.getAttribute("aria-label"),sourceSelect:!!document.querySelector(".ant-select"),filtersOutsideImport:document.body.innerText.includes("nav.event.sources")})' --json > "$ROOT/evidence/pa03-import-tab.json" 2>&1 || true
# PA-06 reduced motion
orca exec --page "$page" --command 'eval JSON.stringify((function(){var el=document.querySelector(".portal-surface-loading__spinner");if(!el)return{found:false};var s=getComputedStyle(el);return{found:true,animation:s.animationName,reduced:window.matchMedia("(prefers-reduced-motion: reduce)").matches};})())' --json > "$ROOT/evidence/pa06-spinner-baseline.json" 2>&1 || true
orca tab close --page "$page" --json >/dev/null 2>&1 || true

echo "Review capture done: $ROOT"
