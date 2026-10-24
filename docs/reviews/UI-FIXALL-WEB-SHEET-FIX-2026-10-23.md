# UI-FIXALL — Shared Sheet width + runtime re-check (#859 / F-WEB-05, F-WEB-04)

| Mục | Giá trị |
| --- | --- |
| Worker | Higo · web · `task_52e3c16cd66f` / `ctx_3ae9361faad6` |
| Base commit | `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` (dirty, uncommitted) |
| Diagnosis input | [UI-FIXALL-WEB-SHEET-DIAG-2026-10-23.md](./UI-FIXALL-WEB-SHEET-DIAG-2026-10-23.md) |
| Runtime | Orca embedded browser · `http://localhost:3000` · `@ticket/web` dev |

## Source freeze (blast radius)

| Path | SHA256 |
| --- | --- |
| `packages/ui/src/components/ui/sheet.tsx` | `868394be232360aabde907ed37524243505827054887357eae32d2dad80e677b` |
| `apps/web/src/site-chrome.tsx` | `44c4b9569c21d11134c6e453769073172cc400360f0ee4c952fe5d990a2b3414` (unchanged this dispatch) |
| `apps/web/src/marketing/marketing-mobile-nav-menu.tsx` | unchanged — consumes shared `SheetContent` |

### Contract correction (F-WEB-05)

`sheet.tsx` right-side panel width:

- **Before:** `w-[min(100vw-3rem,20rem)]` → invalid; Orca computed `8px`, rect ~`41px` stripe.
- **Attempt 1:** `w-[min(calc(100vw-3rem),20rem)]` — Tailwind v4 still emitted `width: min(100vw - 3rem, 20rem)`; Orca runtime **still** `8px` computed despite `CSS.supports('min(calc(...))') === true`.
- **Shipped:** `w-[calc(100vw-3rem)] max-w-[20rem]` (drops `min()` / duplicate `max-w-sm`).

`pnpm --filter @ticket/ui build` then dev reload before capture.

## Runtime evidence

Pack: [assets/UI-FIXALL-WEB-SHEET-FIX-2026-10-23/](assets/UI-FIXALL-WEB-SHEET-FIX-2026-10-23/)

| Capture | Width computed | rectWidth | narrowStripe | Esc focus |
| --- | --- | --- | --- | --- |
| consumer 320/360/390 | 272 / 312 / 320 px | 305 / 345 / 353 | false | trigger |
| marketing 320/360/390 | same | same | false | trigger |
| consumer/marketing 1024 | n/a (toggle hidden) | n/a | false | n/a |
| consumer/marketing 390 **reduced motion** | 320 px | 353 | false | trigger, `animCount=0` |

Probes: `probe-sheet-width.js`, `probe-sheet-escape-focus.js`; batch driver `capture-sheet-fix.sh`.

```bash
bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/UI-FIXALL-WEB-SHEET-FIX-2026-10-23
# OK: 21 file, không trùng nội dung.
pnpm --filter @ticket/web typecheck   # pass
```

## Findings

| ID | Verdict | Notes |
| --- | --- | --- |
| **F-WEB-05** | **PASS** (local runtime) | Shared sheet width readable at 320–390; no 41px stripe; PNG `*-open.png` align with probes. |
| **F-WEB-04** | **PASS with monitoring** | Eight fresh-tab open → Escape cycles (normal + reduced @390): `focusInClosedDialog=false`, `focusOnTrigger=true`, dialog unmounted. No `animation.finish()` / CSS injection. Intermittent stuck-animation case from diag **not reproduced** this batch; retain coordinator note if single long-lived tab regresses. |

## Checks

- No lockfile, brand, API, or portal changes.
- No commit / deploy (coordinator integration).
- Consumer `onCloseAutoFocus` retained from prior FA-WEB round; not modified blindly for this dispatch.

## Handoff

Update coordinator handoff: [.orca-metrics/fix-all/REPORT-WEB.md](../.orca-metrics/fix-all/REPORT-WEB.md).
