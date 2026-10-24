#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ROOT/../../../.." && pwd)"
SHA="$(git -C "$REPO" rev-parse HEAD)"
SHEET_SHA="$(shasum -a 256 "$REPO/packages/ui/src/components/ui/sheet.tsx" | awk '{print $1}')"
W_B64=$(base64 < "$ROOT/probe-sheet-width.js" | tr -d '\n')
F_B64=$(base64 < "$ROOT/probe-sheet-escape-focus.js" | tr -d '\n')

parse_stdout() {
  python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('stdout') or r.get('result') or '')"
}

capture_one() {
  local name="$1" url="$2" w="$3" h="$4" toggle="$5"
  echo "-> $name"
  local tab_json page
  tab_json=$(orca tab create --url "$url" --json)
  page=$(echo "$tab_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('browserPageId') or '')")
  orca exec --page "$page" --command "reload" --json >/dev/null 2>&1 || true
  sleep 2
  orca exec --page "$page" --command "set viewport $w $h" --json >/dev/null
  sleep 1
  orca exec --page "$page" --command "click $toggle" --json >/dev/null
  sleep 1
  local open_probe
  open_probe=$(orca exec --page "$page" --command "eval -b $W_B64" --json | parse_stdout)
  local shot_json src
  shot_json=$(orca exec --page "$page" --command "screenshot" --json)
  src=$(echo "$shot_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('path') or '')")
  cp "$src" "$ROOT/${name}-open.png"
  orca exec --page "$page" --command "press Escape" --json >/dev/null
  sleep 0.8
  local esc_probe
  esc_probe=$(orca exec --page "$page" --command "eval -b $F_B64" --json | parse_stdout)
  python3 - "$ROOT/${name}.json" "$name" "$url" "$w" "$h" "$SHA" "$SHEET_SHA" "$open_probe" "$esc_probe" <<'PY'
import json,sys
out,name,url,w,h,sha,sheet_sha,open_s,esc_s=sys.argv[1:11]
open_j=json.loads(open_s) if open_s.strip().startswith('{') else {}
esc_j=json.loads(esc_s) if esc_s.strip().startswith('{') else {}
json.dump({
  "capture":name,"url":url,"viewport":{"width":int(w),"height":int(h)},
  "sourceSha":sha,"sheetSha":sheet_sha,"open":open_j,"afterEscape":esc_j,
}, open(out,'w'), indent=2)
PY
  orca tab close --page "$page" --json >/dev/null 2>&1 || true
}

for w in 320 360 390; do
  capture_one "consumer-${w}-vi" "http://localhost:3000/" "$w" 844 '[data-testid="nav-menu-toggle"]'
  capture_one "marketing-${w}-vi" "http://localhost:3000/marketing" "$w" 844 '[data-testid="mkt-nav-menu-toggle"]'
done
capture_one "consumer-1024-vi" "http://localhost:3000/" 1024 900 '[data-testid="nav-menu-toggle"]'
capture_one "marketing-1024-vi" "http://localhost:3000/marketing" 1024 900 '[data-testid="mkt-nav-menu-toggle"]'

echo "capture-sheet-fix done"
