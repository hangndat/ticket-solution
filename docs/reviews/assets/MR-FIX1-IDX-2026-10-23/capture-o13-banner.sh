#!/usr/bin/env bash
# MR-R02 / MR-FIX1-IDX — O13 superseded banner @ measured viewport (Orca only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
IDX_DIR="$ROOT/../MR-IDX-2026-10-23"
BASE="http://127.0.0.1:57277"
URL="$BASE/design/o13-platform-sales/prototype/index.html"
OUT_PNG="$IDX_DIR/o13-index-superseded-banner-390.png"
OUT_JSON="$IDX_DIR/o13-index-superseded-banner-390.json"
PROBE_JS="$ROOT/probe-o13-banner.js"
PROBE_B64=$(base64 < "$PROBE_JS" | tr -d '\n')
W=390
H=844

mkdir -p "$IDX_DIR" "$ROOT"

echo "-> O13 banner ${W}x${H}"
tab_json=$(orca tab create --url "$URL" --json)
page=$(echo "$tab_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('browserPageId') or r.get('pageId',''))")
[[ -n "$page" ]] || { echo "FAIL tab: $tab_json" >&2; exit 1; }
orca exec --page "$page" --command "set viewport $W $H" --json >/dev/null
sleep 0.8
probe_raw=$(orca exec --page "$page" --command "eval -b $PROBE_B64" --json)
meta_raw=$(orca exec --page "$page" --command "eval JSON.stringify({innerWidth:innerWidth,innerHeight:innerHeight,devicePixelRatio:devicePixelRatio})" --json)
shot_json=$(orca exec --page "$page" --command "screenshot" --json)
orca tab close --page "$page" --json >/dev/null 2>&1 || true

python3 - "$OUT_JSON" "$probe_raw" "$meta_raw" "$W" "$H" "$URL" <<'PY'
import json, sys

def unwrap_stdout(blob):
    if isinstance(blob, str):
        try:
            blob = json.loads(blob)
        except json.JSONDecodeError:
            return {"raw": blob}
    if not isinstance(blob, dict):
        return blob
    r = blob.get("result", blob)
    if isinstance(r, dict) and "stdout" in r:
        try:
            return json.loads(r["stdout"])
        except Exception:
            return {"stdout": r.get("stdout")}
    if isinstance(r, dict) and "result" in r:
        inner = r["result"]
        if isinstance(inner, str):
            try:
                return json.loads(inner)
            except Exception:
                return {"raw": inner}
        return inner
    return r

out_path, probe_raw, meta_raw, w, h, url = sys.argv[1:7]
probe = unwrap_stdout(probe_raw)
meta = unwrap_stdout(meta_raw)
payload = {
    "task": "MR-FIX1-IDX",
    "finding": "MR-R02",
    "url": url,
    "requestedViewport": {"width": int(w), "height": int(h)},
    "live": meta,
    "probe": probe,
    "screenshot": "o13-index-superseded-banner-390.png",
}
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)
print("wrote", out_path)
PY

src=$(echo "$shot_json" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',d); print(r.get('path') or r.get('screenshotPath') or '')")
[[ -n "$src" && -f "$src" ]] || { echo "FAIL screenshot: $shot_json" >&2; exit 1; }
cp "$src" "$OUT_PNG"
pw=$(sips -g pixelWidth "$OUT_PNG" 2>/dev/null | awk '/pixelWidth/{print $2}')
ph=$(sips -g pixelHeight "$OUT_PNG" 2>/dev/null | awk '/pixelHeight/{print $2}')
echo "PNG ${pw}x${ph} -> $OUT_PNG"
cp "$OUT_JSON" "$ROOT/o13-index-superseded-banner-390.json"
cp "$OUT_PNG" "$ROOT/o13-index-superseded-banner-390.png"
echo "MR-FIX1-IDX capture done"
