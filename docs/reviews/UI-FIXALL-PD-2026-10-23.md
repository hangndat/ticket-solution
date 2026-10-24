# UI review · MR-R09 chrome fix (Issue #859)

| Field | Value |
| --- | --- |
| Reviewer | Mira (`reviewer-uiux`) · `task_ef4a57cf3efc` → `task_5c5ea39da7dc` → **revalidate `task_c81be1de0a52`** / `ctx_479df5fb2d1d` |
| Independence | Review-only; implementer PD (Liv) / `ctx_dd2a452cad1d` |
| Anchor SHA | `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` (`dirty: true` — hashes below are working tree, not commit) |
| Scope | `docs/design/ui-uplift-2026-10/marketing/`, `app/`, `css/prototype-frame.css`, `sheet-nav-loader.mjs`, `ui-chrome-wrap-probe.js` |
| Mẫu | `docs/design/current-mockups-2026-10-23/` |
| Runner | `http://127.0.0.1:57277` (docs `python3 -m http.server`) |
| Implementer handoff | `.orca-metrics/fix-all/REPORT-PD.md` (round2 `ctx_fc5dfd25a8ac`), canonical pack `docs/design/assets/UI-FIXALL-PD-2026-10-23/` |
| Review evidence | `docs/reviews/assets/UI-FIXALL-PD-REVIEW-2026-10-23/` (+ **`revalidate-r2/`** round2 probes) |
| Methods | Orca browser UAT, `probe-menu-contrast.js`, `ui-chrome-wrap-probe.js`, sheet keyboard smoke |
| Verdict | **PASS** (Issue #859 prototype MR-R09 + round2 A11Y revalidation, runtime-checked) |
| Fix rounds | Prior wave **2/2 + exception** unchanged; **round2 source fix 1/1** closed blocking findings (no new blockers) |

## Source fingerprints (PD round2 freeze — reviewer verified, no edits)

| Path | SHA256 |
| --- | --- |
| `docs/design/current-mockups-2026-10-23/source-manifest.json` | `ee0f85838fd12d97086a4b1a073696a457256ba7a4d879fb59adc0c13dddf247` |
| `docs/design/ui-uplift-2026-10/marketing/index.html` | `eefb3fb9dc1a1628003b0d7d50b40c437da584428e0c31ab268ece1abc80746e` |
| `docs/design/ui-uplift-2026-10/marketing/css/marketing-effects.css` | `ce17040719bb1155cee502e0ce6ea3e11c5c6bdcfef9eb286e7756b60d35e5a5` |
| `docs/agents/tools/ui-chrome-wrap-probe.js` | `5b429d7ee6e5d1069c1ec2f41152305888dc57c332f83669962eff852fa13c83` (unchanged) |
| Prior manifest (MR-R09 round1) | `3870caedbf49a9bae04b1fc1fd8ed7599d21219e92c1354aa1bbe1b732c9ab85` |

## Checks performed

### Chrome wrap (header / nav / tab / form)

- Orca `set viewport <W> <H>` at **320 / 360 / 390 / 1024 / 1280** × **VI + EN** × **marketing + app** (40 runs).
- Device mode: `device('mobile')` / `setView('mobile')` when `W < 520`; desktop restore at 1024+.
- `ui-chrome-wrap-probe.js` via `orca exec --command "eval -b …"` — **0 issues** every cell (`probe-summary-review.json`).
- Sample `frameWidth` at true viewport: marketing @320 → **300**; app @390 mobile → **390**; marketing @1024 → **984** (desktop frame in window).
- Visual cross-check: implementer PNGs under `UI-FIXALL-PD-2026-10-23/` (e.g. `marketing-mobile-320-vi`, `marketing-interest-form-desktop-1280-en`, `app-redeem-terms-390-en`) — no header/nav wrap, cut, or overlap observed.

### Probe diff (masking risk — coordinator follow-up)

- Shipped probe diff vs anchor: global `nav/button/label` → **header + `nav[aria-label]` + form chrome** (`form.mkt-form`, `.formCard`).
- Reviewer comparison (`probe-coverage-compare.json`, marketing @320/390/1024):
  - **current** vs **expanded** (adds `#site .btn` + `visibility`/`opacity` filter + skip closed dialog): **same counts** (all 0 on sampled widths).
  - **legacy** @1024 once reported **2** hits; rerun **0**; detailed legacy pass with `inSite`/`inBrowser` flags showed intermittent hits on **prototype review toolbar** controls outside `#site`, not product header — explains false positives legacy probe allowed.
- Conclusion: zero on shipped probe is **not** solely from dropping controls; expanded coverage with visibility gating still 0. Recommend future probe add visibility filter (coordinator note) without re-expanding to all `body button` (sheet false positives).

### Round2 revalidation (`task_c81be1de0a52`) — Menu contrast + evidence + chrome subset

**Menu contrast (independent Orca, actual `set viewport` 320/390 VI+EN, ≥2.2s settle):**

| State | 320/390 VI/EN contrast vs effective bg | WCAG AA |
| --- | --- | --- |
| Normal | **18.72:1** (`rgb(11,18,32)` on white) | pass |
| Hover (`orca hover #mkt-sheet-trigger`) | **17.28:1** (ink on `rgba(11,18,32,0.05)`) | pass |

Evidence: `revalidate-r2/revalidate-summary.json`, `revalidate-r2/probes/menu-contrast-rev-*.json`; PD pack `menu-contrast-mkt-*.json` aligns.

**Canonical pack visual (`UI-FIXALL-PD-2026-10-23`):** `marketing-mobile-320-vi.png` — hero settled, **Menu** dark-on-white readable; sidecar `marketing-mobile-320-vi.json.meta` → `viewport` **320×844**, `locale` **vi**, `frameWidth` **300**, `dpr` **1**. `ui-evidence-check.sh` on pack → **OK (68 files)**.

**Marketing chrome wrap (affected widths only):** 320 / 360 / 390 / 1024 → **0** issues (`revalidate-r2/probes/chrome-mkt-*.json`). App / 1280 matrix unchanged from prior PASS — not re-run.

**Sheet keyboard smoke:** marketing VI + app EN — Tab/Shift+Tab in dialog, Esc → trigger id, reopen in dialog (`revalidate-r2/probes/kb-*.json`).

**Focus visible:** Trigger declares `focus-visible:ring-2` + `marketing-effects.css` guard; programmatic `focus()` in Orca does not set `:focus-visible` (limitation). Contrast/hover states measured; no blocking focus regression observed in smoke.

### Prior failure record (`task_5c5ea39da7dc`) — superseded by round2

- Pre-fix: contrast **~1.08:1** (paper text on white chip). **Closed** by PD `text-ink` + effects guard (`task_4fd3af116333`).

### Sheet regression (Radix loader)

| Surface | Locale | Closed dialog | Open + links | Tab → in-dialog focus | Esc → trigger | Reopen |
| --- | --- | --- | --- | --- | --- | --- |
| Marketing | VI / EN | `dialogPresent: false` | `open`, title Menu, 7 links | Tab cycle through ≥7 in-dialog targets | Esc → trigger; reopen `open` | `open` |
| App | VI / EN | `dialogPresent: false` | `open`, 4 nav buttons | Tab cycle Explore→…→Close (EN after `#locale-en`) | Esc → trigger; reopen `open` | `open` |

Evidence: `probes/sheet-*.json`, **`probes/kb-cycle-marketing-390-vi.json`**, **`probes/kb-cycle-app-390-en.json`** (10× Tab + 10× Shift+Tab, Esc, reopen).

### EN lower / form / terms / offline

- **Terms (EN):** fresh `captures/app-redeem-terms-390-en-settled.png` (post-load, no fade dependency).
- **Interest form (EN):** `captures/marketing-interest-form-1280-en-settled.png` (#interest, desktop, `#locale-en`).
- **Offline (EN):** prior `captures/app-offline-390-en.png` — copy present; locale pill quirk via `choose()` preset unchanged.
- Implementer EN PNGs in `UI-FIXALL-PD-2026-10-23/` **not** used as sole evidence for this pass.

### Automation

```bash
bash docs/design/ui-uplift-2026-10/scripts/d2-scope-check.sh          # OK (prior)
bash docs/agents/tools/ui-evidence-check.sh docs/design/assets/UI-FIXALL-PD-2026-10-23  # OK: 68 files (round2 pack)
# round2 reviewer: revalidate-r2/revalidate-summary.json (Orca :57277)
```

## Findings

| ID | Loại | Mức | Status | Evidence / closure |
| --- | --- | --- | --- | --- |
| **MR-R09-A11Y-MENU-CONTRAST** | a11y | block | **Closed** round2 | Independent **18.72:1** normal / **17.28:1** hover @320/390 VI+EN; manifest `eefb3fb9…` + `ce170407…`. |
| **MR-R09-EVID-320** | evidence | low | **Closed** round2 | Pack `marketing-mobile-320-vi.png` + meta 320/vi/frame300; fade settle in `capture-fixall-pd.sh`. |
| MR-R09-PROBE-SHELL | chrome (tooling) | info | open | Optional probe visibility filter; non-blocking. |

### Known gaps (non-blocking, documented)

| ID | Loại | Ghi chú |
| --- | --- | --- |
| GAP-R09-CDN | dependency | Radix sheet via esm.sh (REPORT-PD) — prototype only. |
| GAP-R09-519 | scope | `@media (max-width:519px)` chrome is prototype-frame; `apps/web` port separate. |
| GAP-LOCALE-PRESET | copy/locale | `setLocale('en')` via `eval` without clicking `#locale-en` can leave **VI** labels in sheet chrome while main copy is EN; **user path** (`click #locale-en` then sheet) shows EN nav (`Explore`, `Redeem`, …). Not introduced by MR-R09; preset/evidence limitation. |
| GAP-FADE-CAPTURE | evidence | Interest-form / hero captures should wait for `data-fade-in` or honor `prefers-reduced-motion` in capture scripts. |

## Limitations

- Prototype HTML only — not `apps/web` / `apps/portal` acceptance.
- No production login / cookies.
- MR-R01–R08 / R10 unchanged per coordinator; this review targeted **MR-R09** + sheet/chrome regression listed in task.
- Review did not commit or mutate implementation files.

## Conclusion

After PD round2 (`task_4fd3af116333`), independent revalidation (`task_c81be1de0a52`) confirms **marketing Menu contrast ≥4.5:1** (normal/hover), **settled 320 evidence** and **chrome wrap** on affected marketing widths, and **sheet keyboard smoke** unchanged. Blocking findings **MR-R09-A11Y-MENU-CONTRAST** and **MR-R09-EVID-320** are **closed**. **Verdict: PASS** for Issue #859 prototype scope at manifest `ee0f8583…` (dirty tree). Reviewer did not modify frozen source or canonical pack. Portal / production remain out of scope.
