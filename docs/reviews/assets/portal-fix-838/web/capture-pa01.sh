#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PROBE_JS="$ROOT/probe-pa01-runtime.js"
CHROME_PROBE="$(cd "$ROOT/../../../../agents/tools" && pwd)/ui-chrome-wrap-probe.js"
PROBE_B64=$(base64 < "$PROBE_JS" | tr -d '\n')
CHROME_B64=$(base64 < "$CHROME_PROBE" | tr -d '\n')
BASE="http://127.0.0.1:3413"
TENANT="d9d9f001-0001-4000-8000-000000000001"
EVENT="d9d9f001-0002-4000-8000-000000000001"
GUESTS="$BASE/t/$TENANT/e/$EVENT/guests"
GATE="$BASE/t/$TENANT/e/$EVENT/gate"
LOGIN_FIXTURE="/tmp/portal-fix-838-runtime/login-fixture.py"

mkdir -p "$ROOT/evidence"

ensure_auth() {
  local page="$1"
  local return_path="$2"
  orca exec --page "$page" --command "goto $BASE/api/auth/login?return=$return_path" --json >/dev/null
  sleep 2
  python3 "$LOGIN_FIXTURE" --page "$page" >/dev/null || true
  sleep 2
  orca exec --page "$page" --command "goto $return_path" --json >/dev/null
  sleep 2
}

capture() {
  local name="$1" w="$2" h="$3" locale="$4" path="$5"
  local out="$ROOT/${name}"
  local probe_out="$ROOT/evidence/${name%.png}.json"
  echo "-> $name (${w}x${h} locale=$locale)"
  local tab_json page
  tab_json=$(orca tab create --url "$path" --json)
  page=$(echo "$tab_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('browserPageId') or d.get('result',{}).get('browserPageId') or d.get('pageId',''))")
  [[ -n "$page" ]] || { echo "FAIL tab: $tab_json" >&2; exit 1; }
  ensure_auth "$page" "$path"
  if [[ "$locale" == "en" ]]; then
    orca exec --page "$page" --command "goto $path" --json >/dev/null
    sleep 1
    orca exec --page "$page" --command 'click [data-testid=account-menu]' --json >/dev/null 2>&1 || true
    sleep 0.3
    orca exec --page "$page" --command 'click [data-testid=portal-locale-en]' --json >/dev/null 2>&1 || true
    sleep 0.8
  fi
  orca exec --page "$page" --command "goto $path" --json >/dev/null
  sleep 1.2
  orca exec --page "$page" --command "set viewport $w $h" --json >/dev/null
  sleep 0.8
  local probe_json chrome_json
  probe_json=$(orca exec --page "$page" --command "eval -b $PROBE_B64" --json)
  chrome_json=$(orca exec --page "$page" --command "eval -b $CHROME_B64" --json)
  python3 - "$probe_out" "$probe_json" "$chrome_json" <<'PY'
import json, sys
out, raw_probe, raw_chrome = sys.argv[1], json.loads(sys.argv[2]), json.loads(sys.argv[3])
def unwrap(d):
    r = d.get("result", d)
    if isinstance(r, dict) and "result" in r and "viewport" not in r:
        r = r["result"]
    if isinstance(r, dict) and "stdout" in r:
        try:
            return json.loads(r["stdout"])
        except Exception:
            return r
    return r
payload = {"pa01": unwrap(raw_probe), "chrome": unwrap(raw_chrome)}
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

capture "runtime-header-vi-guests-390x844.png" 390 844 vi "$GUESTS"
capture "runtime-header-en-guests-390x844.png" 390 844 en "$GUESTS"
capture "runtime-header-vi-guests-430x932.png" 430 932 vi "$GUESTS"
capture "runtime-header-vi-gate-1024x900.png" 1024 900 vi "$GATE"
capture "runtime-header-vi-gate-1440x1000.png" 1440 1000 vi "$GATE"

(cd "$ROOT" && shasum -a 256 *.png | sort -u | wc -l | xargs -I{} echo "PNG count: {}")
echo "Done $ROOT"
