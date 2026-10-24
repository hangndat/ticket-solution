# Mockup canonical index — 2026-10-23 (MR-R09 chrome + D-2)

**Run:** `run_2c9e147d89e6` · **Issue:** [#859](https://github.com/hangndat/ticket-solution/issues/859)\
**Base SHA (review anchor):** `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37`\
**Manifest:** [`source-manifest.json`](./source-manifest.json) — `dirty: true` (local tree after PD + D-2 + IDX evidence; **do not** map hashes to `baseSha` commit)\
**Visual index:** [`index.html`](./index.html)

Wave: **MR-IDX** + **MR-MKT-WEB** + **MR-IOS** + **MR-PORTAL** → **MR-FIX1-FINALIZE** (this index). Fix round **MR-R09** (chrome 320/360/390 + 1024 nowrap) + **MR-R09-round2** (`MR-R09-A11Y-MENU-CONTRAST`: `text-ink` on `#mkt-sheet-trigger`, fade-settle captures) + prior **2/2** IDX/D-2 + Sheet exception history unchanged. Evidence: `docs/design/assets/UI-FIXALL-PD-2026-10-23/` (+ `menu-contrast-mkt-*.json`). Next: **independent regression review** revalidate contrast (not acceptance PASS from this doc).

---

## Runner (docs-only, port 57277)

```bash
# Từ repo root — chỉ serve docs/
python3 -m http.server 57277 --bind 127.0.0.1 --directory docs
```

| Mục | URL (base `http://127.0.0.1:57277`) |
| --- | --- |
| **Index** | `/design/current-mockups-2026-10-23/index.html` |
| Marketing | `/design/ui-uplift-2026-10/marketing/index.html` |
| Consumer web | `/design/ui-uplift-2026-10/app/index.html` |
| iOS | `/plans/mobile-production-refactor/full-prototype.html` |
| Portal (full) | `/design/portal-audit-fix-2026-10-23/prototype/portal-full-specimen.html` |
| Portal PA-01 strip | `/design/portal-audit-fix-2026-10-23/prototype/header-specimen.html` |
| Header Sheet chrome | `/design/ui-framework-2026-10/prototype/header-mobile-sheet.html` |

D-2: `docs/design/ui-framework-2026-10/PROTOTYPE-GUIDE.md`.

---

## Four surfaces — canonical entry

| Surface | ID | Canonical | Handoff / evidence |
| --- | --- | --- | --- |
| **Marketing** | A-MKT-01 | [`ui-uplift-2026-10/marketing/`](../ui-uplift-2026-10/marketing/index.html) | D-2 Tailwind · `MR-MKT-WEB` · `MR-D2-COMPLETE` |
| **Consumer web** | A-APP-01 | [`ui-uplift-2026-10/app/`](../ui-uplift-2026-10/app/index.html) | Same uplift slice |
| **iOS** | A-IOS-01 | [`full-prototype.html`](../../plans/mobile-production-refactor/full-prototype.html) | `PD-HANDOFF.md` · `MR-IOS-O22-2026-10-23/` |
| **Portal** | A-POR-01 | [`portal-full-specimen.html`](../portal-audit-fix-2026-10-23/prototype/portal-full-specimen.html) | Pack README · `MR-PORTAL-2026-10-23/` |

**Chrome (shared):** A-MKT-02 [`header-mobile-sheet.html`](../ui-framework-2026-10/prototype/header-mobile-sheet.html) + Radix loader (`sheet-nav-loader.mjs` / `sheet-nav-radix.mjs`). Sheet exception fix: [`REPORT-SHEET-EXCEPTION.md`](../../reviews/REPORT-SHEET-EXCEPTION.md) · evidence `MR-SHEET-EXCEPTION-2026-10-23/`.

**Reference (not a fourth product surface):** A-REF-01 [`d11-prototype/`](../d11-prototype/) — redeem/gate semantics.

---

## Legacy (superseded — banner on load)

| ID | Path | Redirect |
| --- | --- | --- |
| S-O13-HTML | `o13-platform-sales/prototype/*.html` | → A-MKT-01; evidence banner @390: `MR-IDX-2026-10-23/o13-index-superseded-banner-390.png` |
| S-WEB-LEG | `web-prototype.html` | → A-APP-01; gate → A-IOS-01; admin → A-POR-01 |

---

## Requirement coverage (fix 2/2)

| Req | Summary | Status | Report / evidence |
| --- | --- | --- | --- |
| R-01 | Marketing 8 section Event OS | **Met** | MR-MKT-WEB · D-2 probe |
| R-02 | `#interest` form VI/EN | **Met** | MR-MKT-WEB / MR-FIX1-WEB |
| R-03 | Sheet header @390 MKT + app | **Met** | MR-D2-COMPLETE · Radix |
| R-04 | Terms before ticket issue | **Met** | MR-FIX1-WEB EN capture |
| R-05 | No web gate/admin SoT | **Met** | MR-IDX O13 banner + MKT D-6 |
| R-06 | Portal PA-01..06 | **Met** | MR-PORTAL |
| R-07 | D-2 handoff (Tailwind/token) | **Met** | MR-D2-COMPLETE · scope-check |
| R-08 | pending/denied/offline | **Met** | MR-MKT-WEB + MR-IOS |
| R-09 | Catalog time filter | **Met** | MR-MKT-WEB |
| R-10 | Token SoT | **Met** | `brand/vemoki/tokens.json` fingerprint in manifest |

**Frozen evidence (refresh only via new wave):**

- `docs/reviews/assets/MR-IDX-2026-10-23/` (+ MR-R02 JSON sidecar)
- `docs/reviews/assets/MR-FIX1-IDX-2026-10-23/`
- `docs/reviews/assets/MR-MKT-WEB-2026-10-23/` · `MR-FIX1-WEB-2026-10-23/`
- `docs/reviews/assets/MR-D2-COMPLETE-2026-10-23/`
- `docs/reviews/assets/MR-IOS-O22-2026-10-23/` · `MR-PORTAL-2026-10-23/`

PD / finalize reports: `.orca-metrics/mockup-refresh/REPORT-FIX1-FINALIZE.md` · D-2: `REPORT-D2-COMPLETE.md`.

---

## Authority (unchanged)

Prod snapshots and unbannered legacy HTML are **not** design authority. Order: `tokens.json` → ADR-22 / DECISION-LOG → Epics (#770, #789, #838, …) → PD specs → PRD M07/M10.
