#!/usr/bin/env bash
# Batch 2/2 acceptance captures — fixture portal-fix-838, Orca browser only.
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
CAPTURE_SHA="$(git -C /Users/admin/orca/workspaces/main/portal-audit rev-parse HEAD)"

mkdir -p "$ROOT/evidence"

unwrap_py() {
  python3 -c '
import json,sys
d=json.load(sys.stdin)
r=d.get("result",d)
if isinstance(r,dict) and "result" in r:
    r=r["result"]
if isinstance(r,str):
    try: r=json.loads(r)
    except: pass
print(json.dumps(r))
'
}

ensure_auth() {
  local page="$1" return_path="$2"
  orca exec --page "$page" --command "goto $BASE/api/auth/login?return=$return_path" --json >/dev/null
  sleep 2
  python3 "$LOGIN_FIXTURE" --page "$page" >/dev/null 2>&1 || true
  sleep 2
  orca exec --page "$page" --command "goto $return_path" --json >/dev/null
  sleep 2
}

set_locale_storage() {
  local page="$1" loc="$2"
  local js="document.cookie='vemoki_portal_locale=${loc};path=/;SameSite=Lax';localStorage.setItem('vemoki_portal_locale','${loc}');location.reload();"
  local b64
  b64=$(printf '%s' "$js" | base64 | tr -d '\n')
  orca exec --page "$page" --command "eval -b $b64" --json >/dev/null
  sleep 2
}

assert_before_shot() {
  local page="$1" expect_loc="$2" expect_path="$3" w="$4" h="$5"
  local js="JSON.stringify({pathname:location.pathname,htmlLang:document.documentElement.lang,w:innerWidth,h:innerHeight,cookie:(document.cookie.match(/vemoki_portal_locale=([^;]+)/)||[])[1],ls:localStorage.getItem('vemoki_portal_locale'),hasStrip:!!document.querySelector('[data-testid=portal-context-strip]'),hasAccount:!!document.querySelector('[data-testid=account-menu]')})"
  local b64 raw obj
  b64=$(printf '%s' "$js" | base64 | tr -d '\n')
  raw=$(orca exec --page "$page" --command "eval -b $b64" --json | unwrap_py)
  obj=$(echo "$raw" | python3 -c 'import json,sys; print(json.dumps(json.loads(sys.stdin.read())))')
  python3 - "$obj" "$expect_loc" "$expect_path" "$w" "$h" <<'PY'
import json, sys
o=json.loads(sys.argv[1])
exp_loc, exp_path, ew, eh = sys.argv[2:6]
errs=[]
from urllib.parse import urlparse
want = urlparse(exp_path).path
if o.get("pathname") != want:
    errs.append(f"path {o.get('pathname')} != {want}")
if o.get("w")!=int(ew) or o.get("h")!=int(eh):
    errs.append(f"viewport {o.get('w')}x{o.get('h')} != {ew}x{eh}")
if o.get("cookie")!=exp_loc and o.get("ls")!=exp_loc:
    errs.append(f"locale storage cookie={o.get('cookie')} ls={o.get('ls')} expected {exp_loc}")
if o.get("htmlLang")!=exp_loc:
    errs.append(f"htmlLang={o.get('htmlLang')} expected {exp_loc}")
if not o.get("hasStrip") or not o.get("hasAccount"):
    errs.append("missing strip/account")
if errs:
    print("ASSERT_FAIL", "; ".join(errs), file=sys.stderr)
    sys.exit(1)
print(json.dumps(o))
PY
}

run_probes_merged() {
  local page="$1" out="$2"
  local pr ch
  pr=$(mktemp); ch=$(mktemp)
  orca exec --page "$page" --command "eval -b $PROBE_B64" --json > "$pr"
  orca exec --page "$page" --command "eval -b $CHROME_B64" --json > "$ch"
  python3 - "$pr" "$ch" "$out" <<'PY'
import json, sys
def u(path):
    d=json.load(open(path)); r=d.get("result",d)
    if isinstance(r,dict) and "result" in r: r=r["result"]
    if isinstance(r,str):
        try: return json.loads(r)
        except: return {"raw":r}
    return r
payload={"pa01":u(sys.argv[1]),"chrome":u(sys.argv[2])}
json.dump(payload, open(sys.argv[3],"w"), indent=2)
PY
  rm -f "$pr" "$ch"
}

capture_pa01() {
  local name="$1" w="$2" h="$3" loc="$4" url="$5"
  echo "==> PA01 $name $w x $h $loc"
  local tab page
  tab=$(orca tab create --url "$url" --json)
  page=$(echo "$tab" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("result",d).get("browserPageId") or d.get("browserPageId",""))')
  ensure_auth "$page" "$url"
  set_locale_storage "$page" "$loc"
  orca exec --page "$page" --command "goto $url" --json >/dev/null
  sleep 1
  orca exec --page "$page" --command "set viewport $w $h" --json >/dev/null
  sleep 0.8
  assert_before_shot "$page" "$loc" "$url" "$w" "$h" > "$ROOT/evidence/${name}-assert.json"
  run_probes_merged "$page" "$ROOT/evidence/${name}.json"
  python3 - "$ROOT/evidence/${name}.json" "$CAPTURE_SHA" "$loc" "$url" <<'PY'
import json,sys
p=sys.argv[1]; sha,loc,url=sys.argv[2:5]
d=json.load(open(p))
d.update({"captureSHA":sha,"requestedLocale":loc,"route":url})
json.dump(d,open(p,"w"),indent=2)
PY
  local shot src
  shot=$(orca exec --page "$page" --command screenshot --json)
  src=$(echo "$shot" | python3 -c 'import json,sys; d=json.load(sys.stdin); r=d.get("result",d); print(r.get("path") or r.get("screenshotPath") or "")')
  cp "$src" "$ROOT/${name}.png"
  orca tab close --page "$page" --json >/dev/null 2>&1 || true
}

GUESTS1="$BASE/t/$T1/e/$E1/guests"
GATE1="$BASE/t/$T1/e/$E1/gate"
GUESTS2="$BASE/t/$T2/e/$E2/guests"

capture_pa01 "final-pa01-vi-guests-390x844" 390 844 vi "$GUESTS1"
capture_pa01 "final-pa01-vi-guests-430x932" 430 932 vi "$GUESTS1"
capture_pa01 "final-pa01-vi-guests-768x1024" 768 1024 vi "$GUESTS1"
capture_pa01 "final-pa01-en-guests-390x844" 390 844 en "$GUESTS1"
capture_pa01 "final-pa01-vi-guests-1024x900" 1024 900 vi "$GUESTS1"
capture_pa01 "final-pa01-vi-gate-1024x900" 1024 900 vi "$GATE1"
capture_pa01 "final-pa01-vi-gate-1440x1000" 1440 1000 vi "$GATE1"
capture_pa01 "final-pa01-vi-tenant2-guests-390x844" 390 844 vi "$GUESTS2"

# Language journey (hover submenu)
tab=$(orca tab create --url "$GUESTS1" --json)
page=$(echo "$tab" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("result",d).get("browserPageId") or "")')
ensure_auth "$page" "$GUESTS1"
set_locale_storage "$page" en
orca exec --page "$page" --command "goto $GUESTS1" --json >/dev/null
sleep 1
click_acct_b64=$(printf "document.querySelector('[data-testid=account-menu]').click();" | base64 | tr -d '\n')
orca exec --page "$page" --command "eval -b $click_acct_b64" --json >/dev/null
sleep 0.5
snap=$(orca snapshot --page "$page" --json)
lang_ref=$(echo "$snap" | python3 -c 'import json,sys,re; d=json.load(sys.stdin); t=json.dumps(d); m=re.search(r"@(e\d+)[^\n]*Language|Ngôn ngữ", t); print(m.group(1) if m else "")' || true)
if [[ -n "$lang_ref" ]]; then
  orca hover --page "$page" --element "@$lang_ref" --json >/dev/null 2>&1 || true
  sleep 0.4
fi
vi_click_b64=$(printf "document.querySelector('[data-testid=portal-locale-vi]')?.click();" | base64 | tr -d '\n')
orca exec --page "$page" --command "eval -b $vi_click_b64" --json >/dev/null 2>&1 || true
sleep 1.2
orca exec --page "$page" --command "goto $GUESTS1" --json >/dev/null
sleep 1
lang_probe_b64=$(printf "JSON.stringify({htmlLang:document.documentElement.lang,cookie:(document.cookie.match(/vemoki_portal_locale=([^;]+)/)||[])[1],ls:localStorage.getItem('vemoki_portal_locale'),brand:document.querySelector('[data-testid=portal-brand]')?.textContent?.trim()})" | base64 | tr -d '\n')
orca exec --page "$page" --command "eval -b $lang_probe_b64" --json > "$ROOT/evidence/final-locale-journey-vi.json"
shot=$(orca exec --page "$page" --command screenshot --json)
src=$(echo "$shot" | python3 -c 'import json,sys; d=json.load(sys.stdin); r=d.get("result",d); print(r.get("path") or "")')
cp "$src" "$ROOT/final-locale-journey-vi.png" 2>/dev/null || true

# PA03 tabs + filters
tabs_b64=$(printf "JSON.stringify([...document.querySelectorAll('[role=tab]')].map(t=>({text:t.textContent?.trim(),selected:t.getAttribute('aria-selected')})))" | base64 | tr -d '\n')
orca exec --page "$page" --command "eval -b $tabs_b64" --json > "$ROOT/evidence/final-pa03-tabs-import.json"
import_tab_b64=$(printf "const tabs=[...document.querySelectorAll('[role=tab]')];const imp=tabs.find(t=>/Import|Nhập/i.test(t.textContent||''));imp?.click();JSON.stringify({clicked:!!imp,aria:imp?.getAttribute('aria-selected')})" | base64 | tr -d '\n')
orca exec --page "$page" --command "eval -b $import_tab_b64" --json > "$ROOT/evidence/final-pa03-click-import.json"
filters_b64=$(printf "JSON.stringify({importAria:document.querySelector('[data-testid=portal-import-catalog-filters]')?.getAttribute('aria-label'),exportFilters:!!document.querySelector('[data-testid=portal-export-panel] [aria-label*=catalog]')})" | base64 | tr -d '\n')
orca exec --page "$page" --command "eval -b $filters_b64" --json > "$ROOT/evidence/final-pa03-filters-visible.json"

# PA05 export tab
export_tab_b64=$(printf "const tabs=[...document.querySelectorAll('[role=tab]')];const ex=tabs.find(t=>/Export|Xuất/i.test(t.textContent||''));ex?.click();const inp=document.querySelector('input[aria-label]');JSON.stringify({tab:ex?.textContent?.trim(),ariaSelected:ex?.getAttribute('aria-selected'),inputAria:inp?.getAttribute('aria-label'),placeholder:inp?.getAttribute('placeholder')})" | base64 | tr -d '\n')
orca exec --page "$page" --command "eval -b $export_tab_b64" --json > "$ROOT/evidence/final-pa05-export-vi.json"

# PA04 gate as-of
orca exec --page "$page" --command "goto $GATE1" --json >/dev/null
sleep 1.2
gate_b64=$(printf "JSON.stringify({htmlLang:document.documentElement.lang,body:document.body.innerText.match(/UTC|Giờ|As of|Báo cáo[^\\n]{0,80}/gi)?.slice(0,3)})" | base64 | tr -d '\n')
orca exec --page "$page" --command "eval -b $gate_b64" --json > "$ROOT/evidence/final-pa04-gate-vi.json"

# PA06 reduced motion
orca exec --page "$page" --command "goto $GUESTS1" --json >/dev/null
sleep 0.8
orca exec --page "$page" --command 'set media reduced-motion reduce' --json >/dev/null
mm_b64=$(printf "JSON.stringify({reduce:matchMedia('(prefers-reduced-motion: reduce)').matches})" | base64 | tr -d '\n')
orca exec --page "$page" --command "eval -b $mm_b64" --json > "$ROOT/evidence/final-pa06-matchmedia-reduce.json"
spinner_b64=$(printf "const n=document.createElement('div');n.className='portal-surface-loading__spinner';document.body.appendChild(n);const s=getComputedStyle(n);const out={animationName:s.animationName,animationDuration:s.animationDuration};n.remove();JSON.stringify(out)" | base64 | tr -d '\n')
orca exec --page "$page" --command "eval -b $spinner_b64" --json > "$ROOT/evidence/final-pa06-spinner-css-fixture.json"
orca exec --page "$page" --command 'set media reduced-motion no-preference' --json >/dev/null

orca tab close --page "$page" --json >/dev/null 2>&1 || true

echo "Capture SHA $CAPTURE_SHA done -> $ROOT"
