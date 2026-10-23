#!/usr/bin/env bash
# Chụp specimen PA-01 qua Orca browser (PD demo). Viewport-first goto + probe JSON.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/../assets"
EVIDENCE="$OUT/evidence"
PORT="${PORT:-8765}"
BASE="http://127.0.0.1:${PORT}/header-specimen.html"
PROBE_JS="$ROOT/probe-pa01-header.js"
PROBE_B64=$(base64 < "$PROBE_JS" | tr -d '\n')

mkdir -p "$OUT" "$EVIDENCE"
cd "$ROOT"

# Dọn server/tab cũ nếu còn
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  kill "$(lsof -ti:"$PORT")" 2>/dev/null || true
  sleep 0.2
fi

python3 -m http.server "$PORT" >/tmp/pd-header-http.log 2>&1 &
HTTP_PID=$!
cleanup() {
  kill "$HTTP_PID" 2>/dev/null || true
}
trap cleanup EXIT
sleep 0.5

capture() {
  local name="$1" w="$2" h="$3" query="$4"
  local url="${BASE}${query}"
  local out="$OUT/${name}"
  local probe_out="$EVIDENCE/${name%.png}.json"
  echo "-> $name (${w}x${h})"
  local tab_json page
  tab_json=$(orca tab create --url "$url" --json)
  page=$(echo "$tab_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('browserPageId') or d.get('result',{}).get('browserPageId') or d.get('pageId',''))")
  if [[ -z "$page" ]]; then
    echo "FAIL: no page id from tab create: $tab_json" >&2
    exit 1
  fi
  orca exec --page "$page" --command "set viewport $w $h" --json >/dev/null
  sleep 0.55
  local probe_json
  probe_json=$(orca exec --page "$page" --command "eval -b $PROBE_B64" --json)
  echo "$probe_json" | python3 -c "
import sys, json
raw = json.load(sys.stdin)
r = raw.get('result', raw)
if isinstance(r, dict) and 'result' in r and 'viewport' not in r:
    r = r['result']
if isinstance(r, dict) and 'stdout' in r:
    import json as j
    r = j.loads(r['stdout']) if isinstance(r['stdout'], str) else r['stdout']
print(json.dumps(r, indent=2))
" > "$probe_out" 2>/dev/null || echo "$probe_json" > "$probe_out"

  python3 - "$probe_out" "$w" "$h" <<'PY'
import json, sys
path, ew, eh = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
with open(path) as f:
    data = json.load(f)
if isinstance(data, dict) and 'result' in data and 'viewport' not in data:
    inner = data['result']
    data = inner if isinstance(inner, dict) else data
if isinstance(data, str):
    data = json.loads(data)
vp = data.get('viewport', {})
if vp.get('w') != ew or vp.get('h') != eh:
    sys.stderr.write(f"FAIL {path}: innerWidth/Height {vp} != expected {ew}x{eh}\n")
    sys.exit(1)
meta = data.get('metaText') or ''
if f"{ew}×{eh}" not in meta and f"{ew}x{eh}" not in meta.lower():
    sys.stderr.write(f"FAIL {path}: meta label missing {ew}x{eh}: {meta}\n")
    sys.exit(1)
if ew < 768 and data.get('layout', {}).get('stacked') is not True:
    sys.stderr.write(f"FAIL {path}: mobile not stacked: {data.get('layout')}\n")
    sys.exit(1)
if ew >= 768 and data.get('layout', {}).get('sideBySide') is not True:
    sys.stderr.write(f"FAIL {path}: desktop not side-by-side: {data.get('layout')}\n")
    sys.exit(1)
print(f"  probe OK: viewport={vp['w']}x{vp['h']} stacked={data.get('layout',{}).get('stacked')}")
PY

  local shot_json src
  shot_json=$(orca exec --page "$page" --command "screenshot" --json)
  src=$(echo "$shot_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('path') or r.get('screenshotPath') or '')")
  if [[ -z "$src" || ! -f "$src" ]]; then
    echo "FAIL screenshot $name: $shot_json" >&2
    exit 1
  fi
  cp "$src" "$out"
  orca tab close --page "$page" --json >/dev/null 2>&1 || true
}

capture "header-pa01-vi-390x844.png" 390 844 "?locale=vi"
capture "header-pa01-vi-long-390x844.png" 390 844 "?locale=vi&long=1"
capture "header-pa01-en-390x844.png" 390 844 "?locale=en"
capture "header-pa01-vi-1024x900.png" 1024 900 "?locale=vi"
capture "header-pa01-vi-1440x1000.png" 1440 1000 "?locale=vi&long=1"
capture "header-pa01-en-1440x1000.png" 1440 1000 "?locale=en&long=1"

echo "Done: $OUT (+ probes in $EVIDENCE)"
