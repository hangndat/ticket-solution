# @ticket/ui tree-shaking fix — bundle + LCP re-measurement at SHA f2e04cc6

Context: Issue #1099. PR #1091's investigation (Linh) flagged that every `apps/web` route pulled
a single ~830KB JS chunk because `@ticket/ui` builds to CommonJS, so bundlers cannot drop unused
named exports — a page importing only `Button` still bundled `Sheet`/`Dialog`/`Tabs`/`DropdownMenu`/
`Popover`/`Tooltip`/`sonner` and the entire `lucide-react` icon set pulled in through them.

## Root cause (confirmed on main @ f2e04cc6)

- `packages/ui/tsconfig.json` uses `module: NodeNext`, but `packages/ui/package.json` had no
  `"type"` field, so Node/tsc treats the package as CommonJS and `tsc` emits
  `"use strict"; Object.defineProperty(exports, ...)` — not ESM — for every file under `dist/`.
- `apps/web/src/site-chrome.tsx` (used on nearly every route via `app/(consumer)/layout.tsx`) and
  several marketing components import from the `@ticket/ui/client` subpath barrel
  (`packages/ui/src/client.ts`), which re-exports `Sheet`, `Dialog`, `Tabs`, `DropdownMenu`,
  `Popover`, `Tooltip`, `Toaster` (sonner), `CatalogEventCard`, `UiMotionProvider` from one file.
- Because the compiled module is CommonJS, a bundler can't statically tell that a route only
  touches `Sheet` — the whole `client.js` module (and the full `lucide-react` icon set re-exported
  through it, confirmed via `grep -c "Icon"` on the shipped chunk: ~1600 icon names) gets included.
- Verified directly: on main, `.next/static/chunks/<hash>.js` referenced by `/experience` was
  812KB and contained `DropdownMenu`, `Popover`, `Sheet`, `TooltipProvider`, `sonner`, and every
  lucide icon (`AArrowDownIcon` … `ZoomOutIcon`), even though `/experience` never renders a
  dropdown, popover, or toast.

## Fix

Smallest change that restores tree-shaking: add `"type": "module"` to `packages/ui/package.json`.
`tsconfig.json`'s `module`/`moduleResolution: NodeNext` already matched ESM conventions (all
internal imports already use explicit `.js` extensions), so this flips `tsc`'s emit for the whole
package from CJS to native ESM with no source changes. Confirmed no other workspace package
depends on `@ticket/ui` besides `apps/web` (`apps/mobile`/`apps/portal` do not import it), so the
ESM switch carries no Metro/other-bundler risk.

No UI behavior, `AUTH-07`, lead API, or header-consumer contract changes — package/build
config only.

## Bundle size (sum of JS chunks referenced by `/experience`'s rendered HTML, production build)

| | Before (CJS, main @ f2e04cc6) | After (`"type":"module"`) | Delta |
|---|---|---|---|
| Total JS for `/experience` | 1976 KB | 880 KB | **-1096 KB (-55%)** |
| Largest single chunk | 812 KB (barrel: Sheet+Dialog+Tabs+DropdownMenu+Popover+Tooltip+sonner+all lucide icons) | 228 KB | -584 KB |

## LCP (Lighthouse CLI v13.6.0, same method as `.uat-artifacts/journey-lcp-863c389e/README.md`)

- Headless Chrome (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`).
- `--screenEmulation.mobile=true --screenEmulation.width=390 --screenEmulation.height=844 --screenEmulation.deviceScaleFactor=3 --form-factor=mobile`.
- `--throttling-method=simulate` (RTT 150ms, ~1.6Mbps down, CPU 4x slowdown).
- Target: `next build && next start --port 3911` (production build), not dev server.
- 3 runs per page, both against the **same SHA (f2e04cc6)** — before run used a temporary local
  revert of the `"type":"module"` change only, to isolate this fix's effect from unrelated changes.
- Threshold: LCP "good" <= 2500 ms.

| Page | Before (ms) | After (ms) | Delta |
|---|---|---|---|
| `/experience` (VI) — runs | 5717.1, 7307.9, 7310.4 | 5264.4, 4668.8, 5265.7 | |
| `/experience` median | **7307.9** | **5264.4** | -2043.5 ms (-28.0%) |
| `/en/experience` (EN) — runs | 7308.1, 7307.9, 7306.6 | 5407.1, 5257.7, 5258.1 | |
| `/en/experience` median | **7307.9** | **5258.1** | -2049.8 ms (-28.0%) |

Both the before and after numbers here were freshly re-measured at the same commit for this task
(not reused from the earlier `863c389e` artifact), isolating this fix's effect.

## Result vs. target

Target <= 2500 ms **not met**. Real numbers reported above, not estimated. Per
`lcp-breakdown-insight`/`lcp-discovery-insight` on the after-fix run (see
`experience-after-run1-sample.report.json`), the LCP image
(`/marketing/journey/ticket-night-1536.avif`) already has `fetchpriority="high"`, is eagerly
loaded and discoverable in the initial HTML — the JS-bundle root cause this task targeted is
fixed, but ~5.2-5.4s of simulated-mobile LCP remains, which this insight attributes mostly to
`elementRenderDelay`/resource weight under 4x CPU + throttled network rather than to blocking JS
chunks. That is outside this task's scope (`packages/ui` build/tree-shaking) and should be
tracked as follow-up: likely hero image weight/format tuning or further JS reduction on the
`/experience` route itself.

## Files

- `experience-after-run1-sample.report.json` — one representative after-fix Lighthouse report
  (VI page, run 1). Other runs' raw JSON/HTML are not committed (ephemeral); the full numeric
  table above is the durable record.
