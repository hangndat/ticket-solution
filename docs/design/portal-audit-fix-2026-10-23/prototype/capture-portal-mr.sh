#!/usr/bin/env bash
# MR-PORTAL evidence — dùng docs server chung (không kill cổng shared).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PACK="$ROOT/.."
OUT="$PACK/assets"
EVIDENCE="$OUT/evidence"
MR_ASSETS="$ROOT/../../../reviews/assets/MR-PORTAL-2026-10-23"
MR_FIX1="$ROOT/../../../reviews/assets/MR-FIX1-PORTAL-2026-10-23"
DOCS_PORT="${DOCS_PORT:-57277}"
BASE="http://127.0.0.1:${DOCS_PORT}/design/portal-audit-fix-2026-10-23/prototype/portal-full-specimen.html"
PROBE_JS="$ROOT/probe-portal-full.js"
PROBE_B64=$(base64 < "$PROBE_JS" | tr -d '\n')

mkdir -p "$OUT" "$EVIDENCE" "$MR_ASSETS" "$MR_FIX1"

if ! curl -sf -o /dev/null "http://127.0.0.1:${DOCS_PORT}/"; then
  echo "FAIL: docs server not on :${DOCS_PORT}" >&2
  exit 1
fi

capture() {
  local name="$1" w="$2" h="$3" query="$4"
  local url="${BASE}${query}"
  local out="$OUT/${name}"
  local probe_out="$EVIDENCE/${name%.png}.json"
  echo "-> $name (${w}x${h})"
  local tab_json page
  tab_json=$(orca tab create --url "$url" --json)
  page=$(echo "$tab_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('browserPageId') or d.get('result',{}).get('browserPageId') or d.get('pageId',''))")
  [[ -n "$page" ]] || { echo "FAIL tab: $tab_json" >&2; exit 1; }
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
" > "$probe_out"

  local shot_json src
  shot_json=$(orca exec --page "$page" --command "screenshot" --json)
  src=$(echo "$shot_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('path') or r.get('screenshotPath') or '')")
  [[ -n "$src" && -f "$src" ]] || { echo "FAIL screenshot $name" >&2; exit 1; }
  cp "$src" "$out"
  cp "$src" "$MR_ASSETS/${name}"
  cp "$src" "$MR_FIX1/${name}"
  python3 - "$probe_out" "$out" <<'PY'
import json, sys, subprocess
probe_path, png = sys.argv[1], sys.argv[2]
with open(probe_path) as f:
    data = json.load(f)
out = subprocess.check_output(["sips", "-g", "pixelWidth", "-g", "pixelHeight", png], text=True)
w = h = None
for line in out.splitlines():
    if "pixelWidth" in line:
        w = int(line.split()[-1])
    if "pixelHeight" in line:
        h = int(line.split()[-1])
data["pngPixels"] = {"w": w, "h": h}
vp = data.get("viewport") or {}
if w and h and vp:
    data["viewportMatch"] = vp.get("w") == w and vp.get("h") == h
with open(probe_path, "w") as f:
    json.dump(data, f, indent=2)
PY
  orca tab close --page "$page" --json >/dev/null 2>&1 || true
}

# Journey probe first (390 guests import VI)
echo "Probe journey (guests import VI @390)..."
capture "portal-guests-import-vi-390x844.png" 390 844 "?locale=vi&page=guests&tab=import&state=ready"
capture "portal-guests-pending-vi-1024x900.png" 1024 900 "?locale=vi&page=guests&tab=pending&state=ready"
capture "portal-guests-export-vi-390x844.png" 390 844 "?locale=vi&page=guests&tab=export&state=ready"
capture "portal-pa04-datetime-vi-390x844.png" 390 844 "?locale=vi&page=event-home&state=ready"
capture "portal-pa04-datetime-en-390x844.png" 390 844 "?locale=en&page=event-home&state=ready"
capture "portal-pa06-rm-vi-390x844.png" 390 844 "?locale=vi&page=guests&tab=import&state=loading&rm=1"
capture "portal-full-en-1024x900.png" 1024 900 "?locale=en&page=guests&tab=notifications&state=ready"
capture "portal-platform-operator-1024x900.png" 1024 900 "?locale=vi&page=platform&persona=operator&state=ready"
capture "portal-audit-log-vi-390x844.png" 390 844 "?locale=vi&page=audit&auditTab=audit&state=ready"
capture "portal-audit-codes-en-390x844.png" 390 844 "?locale=en&page=audit&auditTab=codes&state=ready"
capture "portal-audit-empty-vi-390x844.png" 390 844 "?locale=vi&page=audit&auditTab=audit&state=empty"
capture "portal-guests-denied-vi-390x844.png" 390 844 "?locale=vi&page=guests&tab=import&state=denied"
capture "portal-org-long-vi-390x844.png" 390 844 "?locale=vi&page=org-home&long=1&state=ready"
capture "portal-platform-grants-vi-1024x900.png" 1024 900 "?locale=vi&page=platform&persona=operator&platformTab=grants&state=ready"
capture "portal-full-vi-1440x1000.png" 1440 1000 "?locale=vi&page=event-home&state=ready"
capture "portal-full-en-1440x1000.png" 1440 1000 "?locale=en&page=guests&tab=pending&state=ready"

SOURCE_MANIFEST="$MR_ASSETS/source-manifest.json"
FIX1_MANIFEST="$MR_FIX1/source-manifest.json"
git -C "$ROOT/../../../.." rev-parse HEAD 2>/dev/null | python3 -c "
import json, sys, hashlib, os, glob
sha = sys.stdin.read().strip()
root = os.path.abspath('$PACK')
proto = os.path.join(root, 'prototype')
files = []
for fn in sorted(glob.glob(os.path.join(proto, '*'))):
    if os.path.isfile(fn):
        with open(fn, 'rb') as f:
            files.append({'path': os.path.relpath(fn, root), 'sha256': hashlib.sha256(f.read()).hexdigest()})
print(json.dumps({
  'task': 'MR-PORTAL',
  'baseShaNote': 'review local — artifacts not tied to commit',
  'gitHead': sha,
  'docsServer': 'http://127.0.0.1:${DOCS_PORT}',
  'prototypeFiles': files,
}, indent=2))
" > "$SOURCE_MANIFEST"
cp "$SOURCE_MANIFEST" "$FIX1_MANIFEST"
python3 -c "
import json, hashlib, os, glob
fix1 = '$MR_FIX1'
pack = os.path.abspath('$PACK')
with open('$FIX1_MANIFEST') as f:
    data = json.load(f)
data['task'] = 'MR-FIX1-PORTAL'
data['fixRound'] = '1/2'
data['mrR08'] = 'audit route fixture + platform grants preview'
ev = []
for fn in sorted(glob.glob(os.path.join(fix1, 'portal-*.png'))):
    with open(fn, 'rb') as f:
        ev.append({'file': os.path.basename(fn), 'sha256': hashlib.sha256(f.read()).hexdigest()})
data['evidencePng'] = ev
with open('$FIX1_MANIFEST', 'w') as f:
    json.dump(data, f, indent=2)
"

echo "Done: $OUT + $MR_ASSETS + $MR_FIX1 (+ manifests)"
