#!/usr/bin/env bash
set -euo pipefail
WT="${WT:-/Users/admin/orca/workspaces/main/UI-audit}"
EVID="$WT/docs/reviews/assets/FA-PORTAL-2026-10-23"
PAGE="${PAGE:?set PAGE to orca browserPageId}"
TEN=d9d9f001-0001-4000-8000-000000000001
EVT=d9d9f001-0002-4000-8000-000000000001
BASE=http://127.0.0.1:3013
SHA=$(git -C "$WT" rev-parse HEAD)
PROBE_JS=$(python3 -c 'import json,sys; print(json.dumps(open(sys.argv[1]).read()))' "$EVID/portal-runtime-probe.js")

run_probe() {
  local label=$1
  orca exec --page "$PAGE" --command "eval $PROBE_JS" --json \
    | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',{}); p=r.get('result',r); print(json.dumps({'label':'$label','sha':'$SHA','probe':p}, indent=2))" \
    > "$EVID/probe-$label.json"
}

shot() {
  local name=$1
  orca exec --page "$PAGE" --command 'screenshot' --json \
    | python3 -c "import sys,json,shutil; d=json.load(sys.stdin); shutil.copy(d['result']['path'], '$EVID/$name.png')"
  python3 - <<PY
import json, pathlib
p=pathlib.Path('$EVID/probe-$2.json')
probe=json.loads(p.read_text()) if p.exists() else {}
out={'sha':'$SHA','png':'$name.png','viewport':probe.get('probe',{}).get('viewport'),'path':probe.get('probe',{}).get('path')}
pathlib.Path('$EVID/$name.json').write_text(json.dumps(out, indent=2)+'\n')
PY
}

nav() {
  orca exec --page "$PAGE" --command "goto $2" --json >/dev/null
  orca exec --page "$PAGE" --command 'wait 3000' --json >/dev/null
}

nav import "$BASE/t/$TEN/e/$EVT/guests#import"
run_probe guests-import-vi-390
shot portal-postauth-guests-import-vi-390 guests-import-vi-390

orca exec --page "$PAGE" --command 'click @e26' --json >/dev/null 2>&1 || true
orca exec --page "$PAGE" --command 'wait 2000' --json >/dev/null
run_probe guests-pending-vi-390
shot portal-postauth-guests-pending-vi-390 guests-pending-vi-390

nav event "$BASE/t/$TEN/e/$EVT"
run_probe event-overview-pa04-vi
shot portal-postauth-event-overview-vi-1024 event-overview-pa04-vi-1024

nav audit "$BASE/t/$TEN/e/$EVT/audit#audit"
run_probe audit-log-vi-390
shot portal-postauth-audit-vi-390 audit-log-vi-390

nav export "$BASE/t/$TEN/e/$EVT/guests#export"
run_probe guests-export-pa05
shot portal-postauth-guests-export-vi-390 guests-export-pa05-vi-390

nav home "$BASE/"
run_probe shell-root-1024
shot portal-postauth-shell-vi-1024 shell-root-1024

echo "capture done sha=$SHA page=$PAGE"
