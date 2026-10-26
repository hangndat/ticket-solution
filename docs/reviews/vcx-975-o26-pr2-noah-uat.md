# VCX-975 O26-PR2 — UAT closure (Noah)

**PR:** [#980](https://github.com/hangndat/ticket-solution/pull/980) · **Product SHA (F01 pass):** `ebb2fa3fdbdd4dc7d6ec4e38466e2a0e42f39bbc`

## Verdict: **PASS** (F01 visual + nav @ 390×844)

| Check | Result |
| --- | --- |
| Panel `wrapper.width` | **240** |
| `wrapper.x` (after animation) | **0** |
| `visibleClickableMenuItems` | **5** |
| Nav click | **PASS** — `Tổng quan tổ chức` → tenant overview |
| Screenshot | [`f01-drawer-visual-390x844-ebb2fa3f.png`](evidence/vcx-975/o26-pr2-noah/f01-drawer-visual-390x844-ebb2fa3f.png) |
| Measurement | [`f01-visual-verify-ebb2fa3f.json`](evidence/vcx-975/o26-pr2-noah/f01-visual-verify-ebb2fa3f.json) |

### Historical (failed / invalid — do not use for acceptance)

| Artifact | SHA | Note |
| --- | --- | --- |
| [`f01-visual-verify-af6374bd-fail.json`](evidence/vcx-975/o26-pr2-noah/f01-visual-verify-af6374bd-fail.json) | `af6374bd` | Off-screen panel `x: -240` |
| [`f01-drawer-visual-390x844-af6374bd-fail.png`](evidence/vcx-975/o26-pr2-noah/f01-drawer-visual-390x844-af6374bd-fail.png) | `af6374bd` | ~8px strip |
| [`f01-drawer-open-390x844.png`](evidence/vcx-975/o26-pr2-noah/f01-drawer-open-390x844.png) | `af6374bd` | DOM-only false PASS |
| `final-shell-*.png` | `af6374bd` | Desktop smoke only — not drawer proof |

Provenance: [`evidence-provenance.md`](evidence/vcx-975/o26-pr2-noah/evidence-provenance.md).

### Other scope

- 1024/1440 shell smoke @ `af6374bd`: **PASS** ([`pr2-closure-af6374.json`](evidence/vcx-975/o26-pr2-noah/pr2-closure-af6374.json) desktop section) — unchanged.
- Locale / unsaved: **inconclusive** ([`gap-probe-manual.json`](evidence/vcx-975/o26-pr2-noah/gap-probe-manual.json)).

**PR2 acceptance:** **PASS** — [`pr2-closure-ebb2fa3f.json`](evidence/vcx-975/o26-pr2-noah/pr2-closure-ebb2fa3f.json).
