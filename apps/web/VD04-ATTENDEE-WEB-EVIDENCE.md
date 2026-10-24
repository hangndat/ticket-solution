# VD-04 attendee web — phase 2 evidence (Issue #881)

**Scope:** Consumer routes only (`event detail`, `redeem`, `wallet`, `ticket/QR`). Marketing neon phase 1 (#887) untouched.

## Exact SHA

**Fix round 1 (this branch):** `git rev-parse HEAD` on `hangndat/vd04-attendee-web` after worker handoff (see `worker_done` / coordinator for pinned full SHA).

**PR #888 James review baseline:** `6c8236d1ef35454527823b6f8e5e08dc0f2c6e07`

## Delta delivered

| Area | Change |
| --- | --- |
| Atmosphere | `attendeeProductAtmosphere` on home, event, redeem, wallet, ticket mains (light radial wash; not marketing neon). |
| COPY-GUIDE | Central `attendee-copy.ts`; redeem eyebrow «Nhập mã mời»; unknown issuance copy; offline QR banner (no persistence claim). |
| Ticket / QR | White card retained; metadata labels ≥12px (`0.75rem` dt); `OwnerTicketQrPanel` shows SSR/hydrated QR; offline banner when `navigator.onLine === false` (no sessionStorage cache). |
| States | Distinct `forbidden` vs `missing` on owner ticket; redeem unknown message aligned with COPY-GUIDE (no fake ticket). |
| Shell | `ConsumerPageShell`, skeletons, OIDC gates unchanged. |

## James review fix round 1 (F01–F06)

| ID | Action |
| --- | --- |
| F01/F02 | Removed write-only `display-cache.ts`; offline UX keeps hydrated QR only. |
| F03 | `unknownIssuance` aligned to COPY-GUIDE («Vui lòng kiểm tra vé…»). |
| F04 | Tests: `loadOwnerTicket` 403 → `forbidden`; `OwnerTicketQrPanel` / `readBrowserOffline`. |
| F05 | `redeemEyebrow` `0.75rem` (12px @ 16px root). |
| F06 | Evidence documents PR head + post-fix SHA (this file). |

## Checks (local, fix round 1)

| Command | Result |
| --- | --- |
| `pnpm --filter @ticket/contracts --filter @ticket/ui --filter @ticket/web-session build` | pass |
| `pnpm --filter @ticket/web lint` | pass |
| `pnpm --filter @ticket/web typecheck` | pass |
| `pnpm --filter @ticket/web test` | 293 pass |
| `node --test apps/web/tests/routes.integration.mjs` (from `apps/web`) | pass |
| `pnpm --filter @ticket/web build` | pass |
| `node scripts/ui-budget.mjs` | pass |

## UAT (Orca browser)

| Attempt | Outcome |
| --- | --- |
| `orca tab create` → `http://127.0.0.1:3456/redeem` | tab `61dd5677-67d8-490e-97f4-2c5a574cd465` opened |
| `orca exec screenshot` @ redeem | **Failed** — CDP `Page.captureScreenshot` timeout (no frame drawn) |
| Viewport resize via `viewport` agent command | **Unsupported** (`Unknown command: viewport`) |

**Limitation:** No runtime screenshot artifact this dispatch; coordinator may re-run `apps/web/scripts/pr828-attendee-detail-evidence.mjs` after merge or retry Orca capture on headed runtime.

## Residual acceptance gaps

1. **Cold offline ticket deeplink:** SSR still requires network for first paint; no session cache — user must load ticket online once, then QR stays visible if the tab goes offline.
2. **Full responsive matrix (320/768/1024/1440)** not re-captured in Orca this run (screenshot gate above).
3. **Independent re-review** after fix commit not in worker scope (coordinator / James revalidation).

## Routes exercised (manual / integration)

- `/` catalog + COPY «Khám phá sự kiện»
- `/t/mfest-demo/events/mfest` (integration test tenant isolation)
- `/redeem` (eyebrow + auth gate)
- `/wallet`, `/t/{tenant}/tickets/{id}` (states + QR panel)
