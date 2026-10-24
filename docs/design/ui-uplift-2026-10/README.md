# UI uplift 2026-10 — canonical marketing + consumer web mockups

| Surface | Path | Runner URL (docs server `:57277`) |
| --- | --- | --- |
| Marketing | `marketing/index.html` | `/design/ui-uplift-2026-10/marketing/index.html` |
| Consumer app | `app/index.html` | `/design/ui-uplift-2026-10/app/index.html` |
| Mobile header spec | `../ui-framework-2026-10/prototype/header-mobile-sheet.html` | cross-reference #789 |

## D-2 stack (handoff)

- **Tier 2 chrome:** Tailwind CDN + token colors from `brand/vemoki/tokens.json` — mobile Sheet (`sheet-nav-loader.mjs` → **Radix Dialog** `@radix-ui/react-dialog@1.1.4` / shadcn Sheet pattern), form errors, staff D-6 callouts.
- **Tier 1 body:** Tailwind CDN utility classes on marketing + consumer surfaces per [PROTOTYPE-GUIDE.md](../ui-framework-2026-10/PROTOTYPE-GUIDE.md). `.mkt-*` / legacy semantic hooks remain **JS-only** (no BEM stylesheet import). Archived BEM: `marketing/css/archive/marketing-bem.css`, `app/css/archive/app-uplift-bem.css`. Active CSS: `css/prototype-frame.css`, `marketing/css/marketing-effects.css`, `app/css/app-effects.css` (keyframes / art only).

## Sheet provenance

| Piece | Version / path |
| --- | --- |
| React | 18.3.1 (esm.sh) |
| Radix Dialog | 1.1.4 (esm.sh) |
| Loader | `docs/design/ui-framework-2026-10/prototype/sheet-nav-loader.mjs` |

## Mockup states (consumer app)

Review bar presets cover: guest/user catalog, detail, redeem flow (form → terms → success | error | **pending** | **offline**), claim (≠ redeem), wallet / empty, ticket QR, account (privacy/delete), loading, error, gate toast (wallet only — **not** staff web gate SoT).

## Personas

- **Guest:** no wallet nav, no owned strips; login preserves redeem intent.
- **Verified user:** wallet + owned counts; full account privacy/delete.

## Evidence

| Pack | Path |
| --- | --- |
| MR-MKT-WEB (baseline) | `docs/reviews/assets/MR-MKT-WEB-2026-10-23/` |
| MR-FIX1-WEB (Issue #859 batch 1) | `docs/reviews/assets/MR-FIX1-WEB-2026-10-23/` |

PD report: `.orca-metrics/mockup-refresh/REPORT-FIX1-WEB-2026-10-23.md` · Base review SHA `b2faa48a1ce4` + dirty `source-manifest.json`.
