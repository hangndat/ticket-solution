#!/usr/bin/env bash
# D-2 scope: canonical HTML must not import BEM body stylesheets.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
for f in "$ROOT/marketing/index.html" "$ROOT/app/index.html"; do
  if grep -E 'href="[^"]*/(marketing|app-uplift)\.css"' "$f" >/dev/null 2>&1; then
    echo "FAIL: BEM stylesheet still linked in $f"
    fail=1
  fi
done
for css in "$ROOT/marketing/css/marketing.css" "$ROOT/app/css/app-uplift.css"; do
  if [[ -f "$css" ]] && ! [[ "$css" == *"/archive/"* ]]; then
    echo "WARN: legacy BEM file still at $css (should be archive-only)"
  fi
done
active_css=$(find "$ROOT/marketing/css" "$ROOT/app/css" -maxdepth 1 -name '*.css' ! -name 'marketing-effects.css' ! -name 'app-effects.css' 2>/dev/null || true)
for css in $active_css; do
  if grep -q '\.mkt-' "$css" 2>/dev/null; then
    echo "FAIL: active CSS contains .mkt- selectors: $css"
    fail=1
  fi
done
if [[ "$fail" -eq 0 ]]; then
  echo "OK: D-2 scope — no canonical BEM body stylesheet import; active CSS free of .mkt-"
fi
exit "$fail"
