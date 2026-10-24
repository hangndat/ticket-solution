# Mockup vs production diff — #859 (MR-PROD-DIFF)

| Field | Value |
| --- | --- |
| Issue | [#859](https://github.com/hangndat/ticket-solution/issues/859) |
| Run | `run_2c9e147d89e6` |
| Reviewer | Mira · `reviewer-uiux` |
| Dispatches | `ctx_77ab6cbe4e11` · `ctx_5cdf9a69daaa` · **`ctx_0f3e8690e2b5` (report final 2/2)** |
| Prerequisite | Mockup **PASS with known gap** — `MOCKUP-REFRESH-2026-10-23.md` |
| Mockup manifest | `0840ca38ceadedb1ddf2051d30868e65254b223b035c317e7106fabadb509650` |
| Prod deploy SHA | **unknown** |
| Evidence capture (UTC) | Initial PNG batch **2026-10-23T11:21:33Z–11:21:37Z** (file mtime) · mkt after-menu-attempt PNG **2026-10-23T11:28:06Z** · handoff **2026-10-23T11:28:58Z** |
| DoD / pilot | **Not claimed** |

## Report passes

| Pass | Dispatch | Focus |
| --- | --- | --- |
| Initial | `ctx_77ab6cbe4e11` | Public prod probes + PNG batch |
| Correction | `ctx_5cdf9a69daaa` | Outcome vs prototype globals; section count |
| **Final 2/2** | **`ctx_0f3e8690e2b5`** | Provenance: rename mislabeled captures; remove claims contradicted by evidence |

**Final correction reason:** `prod-mkt-390-after-menu-attempt.png` still shows menu **closed**; probe `expanded: false`, `overlay: false`. DOM `navItems` lists do **not** prove visible nav. MP-PD-01 / R-03 menu-open **behavior** → **Chưa xác minh**. Observations `role=dialog` false / `aria-expanded` false retained without inferring missing feature or deploy parity.

---

## Scope

| Surface | Production URL | Mockup canonical | This pass |
| --- | --- | --- | --- |
| Marketing | `https://vemoki.com/` | A-MKT-01 | Public @390 / @1280 |
| Consumer web | `https://app.vemoki.com/` | A-APP-01 | Public guest @390 / @1280 |
| Portal | `https://portal.vemoki.com/` | A-POR-01 | Anonymous @1024 → Keycloak |
| iOS native | — | A-IOS-01 (HTML) | **Chưa xác minh** |

**READONLY** — no new captures in final pass; metadata/docs only.

---

## Top findings (IDs retained)

| ID | Severity | Owner | Headline |
| --- | --- | --- | --- |
| **MP-PD-01** | **Chưa xác minh** | — | Mobile menu **open behavior** @390 (mkt/app) — automated click + PNG do not show opened menu |
| **MP-PD-02** | **N/A** | — | Expected format difference (docs HTML vs Next deploy); no fix proposed |
| **MP-PD-03** | **Medium** | Portal | Portal specimen **Chưa xác minh** (auth redirect) |
| **MP-PD-04** | **Info** | — | Public VI hero H1 aligns mkt + app guest (initial probe) |
| **MP-PD-05** | **Chưa xác minh** | Mobile | Native iOS |
| **MP-PD-06** | **Chưa xác minh** | Web | Auth journeys (redeem terms, wallet, offline) |

**Probe-only (not findings):** `role=dialog` false, `aria-expanded` false after menu-attempt on mkt — no parity / missing-feature conclusion drawn.

---

## Requirement matrix

| Req | Mockup ref | Prod observation | Result | Notes |
| --- | --- | --- | --- | --- |
| **R-01** 8-section IA | A-MKT-01 | DOM id checklist **8/8** @390 | **Khớp** | `prod-mkt-sections-390.json` |
| **R-02** `#interest` VI/EN | MR-FIX1-WEB | `#interest` scroll; VI field labels in probe | **Partial** | EN toggle **Chưa xác minh**; no submit |
| **R-03** Mobile nav @390 | A-MKT-02 | Menu-attempt PNG/JSON | **Chưa xác minh** | Open state not shown; see after-menu-attempt artifacts |
| **R-04** Terms before issue | A-APP-01 | Guest surface only | **Chưa xác minh** | |
| **R-05** No gate SoT on apex | MR-IDX | Public mkt spot check | **Khớp** | |
| **R-06** Portal PA pack | A-POR-01 | Keycloak | **Chưa xác minh** | |
| **R-07** D-2 handoff | ADR-22 (mockup) | — | **N/A** | Format handoff |
| **R-08** offline / denied | mockup | — | **Chưa xác minh** | |
| **R-09** Catalog time filter | MR-MKT-WEB | Tabs + click probe | **Partial** | Filter outcome **Chưa xác minh** |
| **R-10** Token SoT | `tokens.json` | `data-branding-source=vemoki-default`, `--ink:#0B1220` probe only | **Partial** | Token observation only — not full token parity |

---

## Evidence (scrubbed)

`docs/reviews/assets/MR-PROD-DIFF-2026-10-23/`

| File | Viewport | Actual state (labeled) |
| --- | --- | --- |
| `prod-vemoki-marketing-390.png` | 390×844 | Home @11:21:33Z UTC |
| `prod-mkt-390-after-menu-attempt.png` | 390×844 | **After menu click attempt** — visually menu closed (not “open”) |
| `prod-mkt-390-after-menu-attempt.json` | — | `expanded:false`, `overlay:false`, `dialog:false` |
| `prod-vemoki-marketing-1280.png` | 1280×900 | Desktop |
| `prod-app-390.png` | 390×844 | Guest home |
| `prod-app-390-after-menu-attempt.json` | — | Post-click probe; **no** distinct PNG (**Chưa xác minh** visually) |
| `prod-app-1280.png` | 1280×900 | Desktop |
| `prod-portal-1024.png` | 1024×900 | Keycloak redirect |
| `prod-mkt-sections-390.json` | — | R-01 |
| `prod-mkt-interest-readonly.json` | — | R-02 |
| `prod-app-catalog-filter-readonly.json` | — | R-09 |
| `prod-probes.json` | — | Provenance index |

```bash
bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/MR-PROD-DIFF-2026-10-23
```

**Viewport note:** Some PNGs may clip header/hero; cause **chưa định nguyên nhân** (not attributed to Orca chrome without proof).

---

## Limitations

- Deploy / runtime SHA **unknown**.
- Auth, portal shell, native iOS **Chưa xác minh**.
- Mockup **PASS** ≠ prod deploy parity.
- No source, apps, commit, or deploy actions in this wave.

---

*Reviewer: Mira · MR-PROD-DIFF final 2/2 · **Outcome: evidence-aligned public diff; menu-open behavior unverified***
