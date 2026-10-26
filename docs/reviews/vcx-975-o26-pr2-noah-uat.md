# VCX-975 O26-PR2 — UAT closure (Noah)

**PR:** [#980](https://github.com/hangndat/ticket-solution/pull/980) · **Code SHA:** `af6374bd06b19469cd3e2454819b28f9a6785404`

## Verdict: **FAIL** (F01 product — drawer placement)

DOM-only PASS **revoked** after visual verify. Screenshot review + bounding rects: drawer `open` but panel **off-screen** (`x: -240`, `transform: matrix(1,0,0,1,-240,0)`); only ~8px strip visible; **0** menu items in viewport.

| Evidence | Role |
| --- | --- |
| [`f01-visual-verify.json`](evidence/vcx-975/o26-pr2-noah/f01-visual-verify.json) | Canonical F01 measurement |
| [`f01-drawer-visual-390x844.png`](evidence/vcx-975/o26-pr2-noah/f01-drawer-visual-390x844.png) | Post-animation screenshot |
| [`f01-drawer-open-390x844.png`](evidence/vcx-975/o26-pr2-noah/f01-drawer-open-390x844.png) | **Invalid** for acceptance (DOM-only false PASS) |

### F01 metrics (after animation @ 390×844)

| Field | Value |
| --- | --- |
| `wrapper.width` | 240 |
| `wrapper.x` | **-240** |
| `wrapper.transform` | `translateX(-240)` |
| `visibleClickableMenuItems` | **0** |
| `menu.x` | -240 |
| `productF01Verdict` | **FAIL** |

### Higo — action required

Fix **CSS/placement** for `portal-shell-nav-drawer` / antd Drawer `placement="left"`: open state must bring `ant-drawer-content-wrapper` into viewport (translate **0**), menu readable and clickable. Re-UAT with **visual** + rect check, not `open` class alone.

### Other scope (secondary)

- 1024/1440 shell smoke previously **PASS** ([`pr2-closure-af6374.json`](evidence/vcx-975/o26-pr2-noah/pr2-closure-af6374.json)) — unchanged; **does not** close F01.
- Locale / unsaved: one-shot **GAP** (harness/fixture); not re-run.

**PR2 acceptance:** blocked on **F01 visual FAIL** @ `af6374bd`.
