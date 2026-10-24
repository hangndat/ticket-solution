# Mockup refresh — independent UI/UX review (MR-REVIEW)

| Field | Value |
| --- | --- |
| Issue | [#859](https://github.com/hangndat/ticket-solution/issues/859) |
| Run | `run_2c9e147d89e6` |
| Reviewer | Mira · `reviewer-uiux` |
| Independence | ≠ PD implementer (Liv / MR-* PD wave) |
| Base anchor SHA | `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` |
| Source provenance | `docs/design/current-mockups-2026-10-23/source-manifest.json` · **`dirty: true`** |
| Method | Impeccable `critique` (single-context) · Orca embedded browser · `ui-chrome-wrap-probe.js` · `d2-scope-check.sh` |
| Fix rounds reviewed | **2 / 2** (+ MR-SHEET-EXCEPTION runtime fix verified in revalidation) |
| DoD / pilot | **Not claimed** — prototype acceptance only |

## Review passes

| Pass | Dispatch | Verdict |
| --- | --- | --- |
| **Lượt 0** (pre-fix) | `ctx_68d58f842400` | **FAIL** — blockers MR-R01–R04 |
| **Lượt 2/2** (revalidation, pre-sheet) | `ctx_d8d5d8dd30ab` | **FAIL** — MR-R04 module load (superseded by sheet-exception fix) |
| **Lượt 2/2** (revalidation, fix1/2 + sheet-exception) | `ctx_ff78a5fb12b6` | **PASS with known gap** — see below |

---

## Authority checked

- Canonical index: `docs/design/current-mockups-2026-10-23/README.md` + `source-manifest.json`
- PD reports (reference only): `.orca-metrics/mockup-refresh/REPORT-{D2-COMPLETE,FIX1-*,MR-*}*.md` · `docs/reviews/REPORT-SHEET-EXCEPTION.md`
- Coordinator: `.orca-metrics/mockup-refresh/resume-review-guidance.md`
- O22 / M07 / M10: `docs/plans/mobile-production-refactor/PD-HANDOFF.md` § O22
- D-2: `docs/ops/ADR-22-WEB-DS-ACETERNITY.md`
- Portal pack: `docs/design/portal-audit-fix-2026-10-23/README.md` (#838)

## Source hash — before (lượt 0) → after (lượt 2/2 revalidation)

Fingerprints: `docs/reviews/assets/MR-REVIEW-2026-10-23/fingerprint-before.json` · live `sha256sum` @ `ctx_ff78a5fb12b6`.

| Artifact | SHA256 lượt 0 | SHA256 lượt 2/2 (local dirty) |
| --- | --- | --- |
| A-MKT-01 `marketing/index.html` | `1db19c1d…ce0e` | `d2cea9a7…e476` |
| A-APP-01 `app/index.html` | `51ffb320…3a06` | `5ab88476…b076` |
| A-IOS-01 `full-prototype.html` | `ec133400…8f6` | `f5570df3…1d19e` |
| A-POR-01 `portal-full-specimen.html` | `ad55da4a…ce1` | `16f42847…b73f6` |
| `sheet-nav.js` | `54b387c3…388c` (custom trap) | `c87b75ec…bb5ec` (provenance stub) |
| `sheet-nav-radix.mjs` | — | `7c69738b…41e6` (esm.sh `deps=`, no `external=`) |
| `source-manifest.json` (on disk) | — | `0840ca38…9650` |

**Note:** `indexArtifacts` lists only `index.html` + `README.md` (no self-entry); prior MR-R10 stale self-hash **closed** on tip manifest.

---

## Lượt 2/2 — journey / viewport matrix (live Orca, `ctx_ff78a5fb12b6`)

Runner: `http://127.0.0.1:57277`. Summary: `docs/reviews/assets/MR-REVALIDATION-3-2026-10-23/probe-summary.json`.

| Surface | Viewports probed | Mandatory checks | Result |
| --- | --- | --- | --- |
| Marketing | **320**, 390, 1024, **1280** | 8 sections; D-2 scope; Radix sheet | `d2-scope-check.sh` OK; Radix sheet opens @390, focus in dialog |
| App | **320**, 390, 1024, **1280** | Terms guard EN; consumer chrome; Radix sheet | `Confirm terms` @390 EN; sheet Radix @390 |
| iOS | **390** full viewport | Offline recover D7 | Live: «Đối soát cục bộ» + `toast warn` @390 |
| Portal | 390, **1024**, **1280** | Audit route + PA fixture | `page=audit` + `[data-testid=audit-log-panel]` @1024 `innerWidth` 1024 |
| Index / legacy | 390 (reuse FIX1) | Superseded banner | PNG **390×844** + sidecar `innerWidth` 390 |

**Evidence reuse (unchanged source, re-verified):** MR-FIX1-IDX (R02) · MR-FIX1-WEB PNG R01 · MR-FIX1-IOS R07 PNG/JSON · MR-SHEET-EXCEPTION pack (`ui-evidence-check.sh` OK) + live Radix re-probe. **Not reused without live check:** MR-D2-COMPLETE PNG batch (scripts only).

```bash
bash docs/design/ui-uplift-2026-10/scripts/d2-scope-check.sh
# → OK: D-2 scope — no canonical BEM body stylesheet import; active CSS free of .mkt-
```

---

## Verdict by surface (lượt 2/2 · `ctx_ff78a5fb12b6`)

| MR / surface | Lượt 0 | **Lượt 2/2** | Notes |
| --- | --- | --- | --- |
| **MR-IDX** | FAIL | **PASS** | MR-R02 closed — true 390×844 banner PNG + probe |
| **MR-MKT-WEB** | FAIL | **PASS** | MR-R03/R04 closed — Tailwind canonical + Radix sheet runtime |
| **MR-IOS** | PASS w/ gap | **PASS with known gap** | MR-R05/R07 closed; HTML prototype ≠ native UAT |
| **MR-PORTAL** | PASS w/ gap | **PASS with known gap** | MR-R08 closed — `audit` in `PAGES`; AntD specimen only |
| **MR-FINALIZE** | FAIL | **PASS** | Manifest v2 tip hashes + `indexArtifacts` hygiene |

**Wave overall (#859 mockup acceptance):** **PASS with known gap** — all mandatory MR-R01–R08 met on canonical four surfaces; gaps are prototype-only (iOS HTML, portal specimen), not waived blockers.

---

## Findings MR-R01..R08 (IDs retained)

| ID | Lượt 0 | **Lượt 2/2** | Type | Evidence (lượt 2) |
| --- | --- | --- | --- | --- |
| **MR-R01** | Blocker | **Closed** | copy/locale | PNG `app-redeem-terms-390-en.png` + live `choose('user','redeem-terms')` → «Confirm terms» @390 |
| **MR-R02** | Blocker | **Closed** | lệch mẫu/AC | `o13-index-superseded-banner-390.png` 390×844; sidecar `innerWidth` 390 |
| **MR-R03** | Blocker | **Closed** | lệch mẫu/AC | `d2-scope-check.sh` OK; Tailwind CDN on A-MKT-01 + A-APP-01; archived BEM |
| **MR-R04** | Blocker | **Closed** | a11y / lệch mẫu | MR-SHEET-EXCEPTION: `sheet-nav-radix.mjs` full URL imports; live `VemokiSheetNav` + dialog open/focus @390 mkt+app; no custom trap in `sheet-nav.js` |
| **MR-R05** | Major | **Closed** | lệch mẫu/AC | `gateOffline` + `result('recover')` → «Đối soát cục bộ» / `toast warn` @390 |
| **MR-R06** | Minor | **Closed** | chrome | Marketing @1280: 0 wrap issues |
| **MR-R07** | Major | **Closed** | lệch mẫu/AC | `MR-IOS-fullviewport-390x844.png` + JSON `r07.match` true |
| **MR-R08** | Minor | **Closed** | IA | `portal-full-specimen.html` `page=audit` → `[data-testid=audit-log-panel]` |

### Additional (non-blocking)

| ID | Type | Finding |
| --- | --- | --- |
| **MR-R09** | chrome | Marketing/app @**320** `frameWidth` ~280: nav labels 2-line wrap (`ui-chrome-wrap-probe`); polish if 320 is in-scope |
| **MR-R10** | lệch mẫu/AC | **Closed** on tip — manifest no longer embeds stale self-SHA in `indexArtifacts` |

---

## Lượt 0 findings archive (baseline — do not inherit PASS)

<details>
<summary>Original batch 0/2 FAIL table (ctx_68d58f842400)</summary>

Wave overall was **FAIL** on MR-R01–R04 blockers (mislabeled PNGs, BEM tier-1, custom focus trap, Radix load). Substantive fixes verified in lượt 2/2 rows above; pre-sheet revalidation (`ctx_d8d5d8dd30ab`) correctly failed MR-R04 until MR-SHEET-EXCEPTION landed.

</details>

---

## Checks run (lượt 2/2 · `ctx_ff78a5fb12b6`)

```bash
git rev-parse HEAD   # b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37
bash docs/design/ui-uplift-2026-10/scripts/d2-scope-check.sh
bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/MR-SHEET-EXCEPTION-2026-10-23
bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/MR-FIX1-IDX-2026-10-23
bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/MR-FIX1-WEB-2026-10-23
# → OK (no duplicate PNG content)
```

## Limitations

- Prototype HTML only — no `apps/web` / `apps/mobile` / `apps/portal` runtime.
- MR-D2-COMPLETE: no frozen PNG batch; D-2 judged via scope script + live probes.
- Radix depends on esm.sh CDN (verified on tip imports, not offline/air-gapped).
- Physical SR / every review-bar preset × locale not exhausted.
- **Known gaps (accepted in scope):** iOS full-prototype HTML; portal Ant Design specimen — do not imply pilot-ready device UAT.

## Coordinator next steps (not executed)

1. Coordinator may close #859 mockup acceptance on this artifact + exact dirty-tree hashes (no commit required by review task).
2. Optional: 320px chrome polish (MR-R09).
3. Production slice: port D-2 + sheet patterns into `apps/web` under separate tasks.

---

*Reviewer: Mira · Revalidation dispatch `ctx_ff78a5fb12b6` · Anchor `b2faa48a1ce4` + dirty tree · Evidence: `docs/reviews/assets/MR-REVALIDATION-3-2026-10-23/` · **Verdict: PASS with known gap***
