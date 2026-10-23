#!/usr/bin/env bash
# Chụp specimen PA-01 qua Orca browser (PD demo, không runtime).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/../assets"
PORT="${PORT:-8765}"
BASE="http://127.0.0.1:${PORT}/header-specimen.html"

mkdir -p "$OUT"
cd "$ROOT"
python3 -m http.server "$PORT" >/tmp/pd-header-http.log 2>&1 &
HTTP_PID=$!
trap 'kill "$HTTP_PID" 2>/dev/null || true' EXIT
sleep 0.5

capture() {
  local name="$1" w="$2" h="$3" query="$4"
  local url="${BASE}${query}"
  local out="$OUT/${name}"
  echo "-> $name (${w}x${h})"
  local tab_json
  tab_json=$(orca tab create --url "$url" --json)
  local page
  page=$(echo "$tab_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('browserPageId') or d.get('result',{}).get('browserPageId') or d.get('pageId',''))")
  orca exec --page "$page" --command "set viewport $w $h" --json >/dev/null
  sleep 0.3
  local shot_json
  shot_json=$(orca exec --page "$page" --command "screenshot" --json)
  local src
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
capture "header-pa01-vi-1024x900.png" 1024 900 "?locale=vi"
capture "header-pa01-vi-1440x1000.png" 1440 1000 "?locale=vi&long=1"
capture "header-pa01-en-1440x1000.png" 1440 1000 "?locale=en&long=1"

echo "Done: $OUT"
