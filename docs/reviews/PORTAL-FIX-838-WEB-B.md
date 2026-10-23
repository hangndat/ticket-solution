# #838 Web B — PA-01 header + acceptance handoff

**Branch:** `hangndat/portal-audit` (integration)  
**PD handoff:** `docs/design/portal-audit-fix-2026-10-23/README.md`  
**Web A implementation SHA:** `15f0c930be16b602f4a04c3ef254fa3ddd17d32e` (PA-02–06)  
**Web B provenance SHA (original capture tree):** `57ed772f9bde7ce0fb95ba0b291a826b5dc2e2e7` — **superseded for acceptance** by batch 2 final captures on tip SHA in `PORTAL-FIX-838-BATCH-2.md`.

## PA-01 implementation

- **Two-tier chrome** per PD: Tier A = `ProLayout` brand + account only (`headerContentRender={false}`); Tier B = `PortalContextStrip` (tenant/event selects + gate iOS hint when `showGateScanHint`).
- **Styles:** `app/globals.css` — `.portal-brand-link` nowrap/ellipsis; `.portal-context-strip` responsive stack ≥768 side-by-side.
- **Probe:** `docs/reviews/assets/portal-fix-838/web/probe-pa01-runtime.js` — `vemoki_portal_locale`, `meta.htmlLang`, layout metrics.

## Runtime (fixture #838)

| Service | Endpoint | PID / note |
| --- | --- | --- |
| API | `http://127.0.0.1:3418` | `76023` (coordinator) |
| Portal | `http://127.0.0.1:3413` | `47426` — log `/tmp/portal-fix-838-runtime/portal-3413.log` (rebuilt batch 2) |
| Env file | `/tmp/portal-fix-838-runtime/env.json` | **do not commit** |
| Stop portal | `kill $(cat /tmp/portal-fix-838-runtime/portal.pid)` | reviewer handoff |

Build/start (portal-audit worktree): `pnpm --filter @ticket/contracts build && pnpm --filter @ticket/web-session build && pnpm --filter @ticket/portal build` then `next start -p 3413` with env from `env.json`, `NODE_ENV=production`.

## Checks (batch 2 worktree)

| Check | Result |
| --- | --- |
| `pnpm lint` (portal) | PASS |
| `pnpm test` (portal) | PASS 131/131 |
| `pnpm --filter @ticket/portal build` | PASS |

## UI evidence

| Generation | Path | Notes |
| --- | --- | --- |
| **Superseded** (mislabeled VI, EN render) | `docs/reviews/assets/portal-fix-838/web/provenance-stale-en-rendered-*` | Cookie/probe showed `en`; không dùng làm AC pass |
| **Acceptance (batch 2)** | `docs/reviews/assets/portal-fix-838/final/` | Assert pre-shot + `htmlLang`/`locale` trong JSON |
| Reviewer FAIL history | `docs/reviews/assets/portal-fix-838/review/attempted-vi-rendered-en-*` | Giữ lịch sử diagnostic |

**Capture:** `final/capture-batch2-final.sh`; auth via `login-fixture.py`.

## Acceptance matrix (PA-01–06)

| Item | Batch 2 | Notes |
| --- | --- | --- |
| PA-01 header 390/430/768/1024/1440 VI+EN | **Captured** | `final-pa01-*` |
| PA-01 tenant2 long names | **Captured** | `final-pa01-vi-tenant2-guests-390x844` |
| PA-01 keyboard full journey | **Partial** | Tenant focus probe only |
| PA-02 copy | **Web A + batch 2** | Runtime import notice VI in messages |
| PA-03 import filters in tab | **Browser** | `final-pa03-filters-import-vi.json` |
| PA-04 gate as-of UTC | **Spot** | `final-pa04-gate-vi.json` |
| PA-05 export accessible name | **Browser** | `final-pa05-export-vi.json` |
| PA-06 reduced motion | **Browser** | `final-pa06-*` (CSS fixture documented) |

## Gaps

- Submenu locale UI journey requires hover (AntD); matrix locale uses storage setup + reload.
- MFA / destructive / full role matrix — out of scope.
