# #838 Web B — PA-01 header + acceptance handoff

**Branch:** `hangndat/portal-fix-838-web` (local commits; Web A + Web B)  
**PD handoff:** `../portal-fix-838-pd/docs/design/portal-audit-fix-2026-10-23/README.md` (also on `portal-audit` root integration)  
**Web A baseline commit:** `15f0c930be16b602f4a04c3ef254fa3ddd17d32e` (PA-02–06)

## PA-01 implementation

- **Two-tier chrome** per PD: Tier A = `ProLayout` brand + account only (`headerContentRender={false}`); Tier B = new `PortalContextStrip` (tenant/event selects + gate iOS hint when `showGateScanHint`).
- **Styles:** `app/globals.css` — `.portal-brand-link` nowrap/ellipsis; `.portal-context-strip` responsive stack ≥768 side-by-side.
- **Semantics:** Same `router.push` navigation and `data-testid` switchers as incumbent; hint moved out of `actionsRender`.

## Runtime (fixture #838)

| Service | Endpoint | PID / note |
| --- | --- | --- |
| API | `http://127.0.0.1:3418` | `76023` (coordinator) |
| Portal | `http://127.0.0.1:3413` | `45219` (session) / node `45221` — log `/tmp/portal-fix-838-runtime/portal-3413.log` |
| Env file | `/tmp/portal-fix-838-runtime/env.json` | **do not commit** |
| Stop portal | `kill $(cat /tmp/portal-fix-838-runtime/portal.pid)` or `kill $(lsof -t -iTCP:3413 -sTCP:LISTEN)` | after coordinator reviews screenshots |

Build/start (this worktree): `pnpm --filter @ticket/contracts build && pnpm --filter @ticket/web-session build && pnpm --filter @ticket/portal build` then `next start` with env from `env.json` and `NODE_ENV=production`.

## Checks (worktree SHA at commit)

| Check | Result |
| --- | --- |
| `pnpm lint` (portal) | PASS |
| `pnpm test` (portal) | PASS 134/134 |
| `pnpm --filter @ticket/portal build` | PASS |

## UI evidence (authenticated D9)

**SHA:** `efeffdbb98cb2617a21f3035048ed7e56537ceeb` (Web B); Web A `15f0c930be16b602f4a04c3ef254fa3ddd17d32e`.  
**Assets:** `docs/reviews/assets/portal-fix-838/web/` (+ `evidence/*.json` probes).  
**Capture:** `capture-pa01.sh` (Orca browser); auth via `/api/auth/login?return=…` on coordinator page `86376346-cb83-496f-977f-502ed17795c3`.

| Capture | Viewport | Route | Probe highlights |
| --- | --- | --- | --- |
| `runtime-header-vi-guests-390x844.png` | 390×844 | Guests | `brandLines=1`, `stacked=true`, `chrome.issues=[]` |
| `runtime-header-en-guests-390x844.png` | 390×844 | Guests | EN locale toggle |
| `runtime-header-vi-guests-430x932.png` | 430×932 | Guests | mobile stack |
| `runtime-header-vi-gate-1024x900.png` | 1024×900 | Gate (hint on) | `sideBySide=true`, hint 1 line |
| `runtime-header-vi-gate-1440x1000.png` | 1440×1000 | Gate | desktop layout |

PNG hashes differ (`shasum` in capture log); probes stored under `evidence/`.

## Acceptance matrix (PA-01–06)

| Item | Checked | Notes |
| --- | --- | --- |
| PA-01 header 390/430/1024/1440 VI+EN | **Yes** | Probes above; brand 1 line, no `chrome` wrap issues on samples |
| PA-01 keyboard full journey | **Partial** | Tab order not instrumented; controls present in DOM (`account-menu`, switchers) |
| PA-01 long org/event names | **Partial** | Fixture MFest labels; no dedicated ultra-long seed |
| PA-02 copy VI/EN ops | **Web A** | Preserved; notifications `Kiểu` column label fix in Web B i18n dedupe |
| PA-03 import filters in tab | **Web A** | Unchanged |
| PA-04 locale as-of UTC | **Web A** | Spot not re-probed this pass |
| PA-05 export accessible name | **Web A** | Spot not re-probed |
| PA-06 reduced motion spinner | **Web A** | Spot not re-probed |
| Tenant/event switch tenant2 | **No** | Not exercised |
| MFA / destructive / export download / role matrix | **No** | Out of scope per task |
| Full MFA production policy | **No** | Fixture TOTP enrolled for staff demo only |

## Gaps

- First capture pass without session was invalid (sign-in wall); superseded by authenticated re-capture.
- 768px viewport not separately shot (1024 covers desktop strip).
- Coordinator: review top PNGs then stop portal PID as above.
