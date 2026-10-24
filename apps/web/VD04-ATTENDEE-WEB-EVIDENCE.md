# VD-04 attendee web — phase 2 evidence (Issue #881)

**Scope:** Consumer routes only (`event detail`, `redeem`, `wallet`, `ticket/QR`). Marketing neon phase 1 (#887) untouched.

## Exact SHA

`2ac5a7ba6d4b5f7615b1b72dc0184c8d3c551648` (branch `hangndat/vd04-attendee-web`; feature commit — if amended, re-run `git rev-parse HEAD`)

## Delta delivered

| Area | Change |
| --- | --- |
| Atmosphere | `attendeeProductAtmosphere` on home, event, redeem, wallet, ticket mains (light radial wash; not marketing neon). |
| COPY-GUIDE | Central `attendee-copy.ts`; redeem eyebrow «Nhập mã mời»; unknown issuance copy; offline QR label. |
| Ticket / QR | White card retained; metadata labels ≥12px (`0.75rem` dt); `OwnerTicketQrPanel` + session cache; offline banner when `navigator.onLine === false`. |
| States | Distinct `forbidden` vs `missing` on owner ticket; redeem unknown message aligned with COPY-GUIDE (no fake ticket). |
| Shell | `ConsumerPageShell`, skeletons, OIDC gates unchanged. |

## Checks (local)

| Command | Result |
| --- | --- |
| `pnpm --filter @ticket/contracts --filter @ticket/ui --filter @ticket/web-session build` | pass |
| `pnpm --filter @ticket/web lint` | pass |
| `pnpm --filter @ticket/web typecheck` | pass |
| `pnpm --filter @ticket/web test` | 291 pass |
| `node --test apps/web/tests/routes.integration.mjs` | pass |
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

1. **Cold offline ticket deeplink:** SSR still requires network for first paint; session cache only helps re-read after a successful online visit (banner shows when browser goes offline on an already-rendered ticket).
2. **Full responsive matrix (320/768/1024/1440)** not re-captured in Orca this run (screenshot gate above).
3. **Independent reviewer + `dod+ux`** not in worker scope.

## Routes exercised (manual / integration)

- `/` catalog + COPY «Khám phá sự kiện»
- `/t/mfest-demo/events/mfest` (integration test tenant isolation)
- `/redeem` (eyebrow + auth gate)
- `/wallet`, `/t/{tenant}/tickets/{id}` (states + QR panel)
