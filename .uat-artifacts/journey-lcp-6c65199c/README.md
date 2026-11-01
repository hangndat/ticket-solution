# Journey mobile LCP investigation — SHA 6c65199c (PR #1091)

Follow-up to `.uat-artifacts/journey-lcp-863c389e/` (baseline: VI median 7391ms,
EN median 7462ms, both ~3x the 2.5s "good" threshold). This round investigates
root cause and attempts an in-scope fix before reporting back.

## Tool / method (same as baseline, for a clean before/after)
- Lighthouse CLI v13.6.0 (`npx lighthouse`), headless Chrome.
- `--screenEmulation.mobile=true --screenEmulation.width=390 --screenEmulation.height=844 --screenEmulation.deviceScaleFactor=3 --form-factor=mobile`.
- `--throttling-method=simulate` (RTT 150ms, ~1.6Mbps down, CPU 4x — confirmed per report's `configSettings`).
- Target: local production build (`next build && next start --port 3911`).
- 3 runs per page, median reported.

## Investigation

Checked the Lighthouse `metrics` audit (the authoritative simulated LCP
breakdown — the separate `lcp-breakdown-insight` audit reports the
*unthrottled/observed* trace, which is misleadingly small and not the same
number series as the official metric):

| Subpart | ms (run, VI) |
|---|---|
| TTFB | 454 |
| LCP load delay | 411–1097 |
| LCP load duration | 541–879 |
| **Element render delay (by elimination)** | **~3200–6000** |

`lcp-discovery-insight` confirms the hero image is already optimal:
`fetchpriority=high` applied, discoverable in the initial document, not
lazy-loaded, 0ms estimated savings. `network-requests` confirms the SSR HTML
contains the real `<img>`/`<picture>` with the correct inline
`opacity:1`/`transform:none` style — the element is visually complete in the
raw HTML, not gated behind client JS/hydration for its *visibility*.

**Hypotheses tested:**
1. **StillJourney→ScrollJourney hydration swap** (the page renders a
   reduced-motion-safe SSR default, then may swap to the full scroll-driven
   tree once the client determines `prefers-reduced-motion` doesn't apply).
   Tested by patching `useScrollMode`'s SSR snapshot to already match the
   client's typical (non-reduced) value, removing the swap entirely for this
   test build. **Result: no meaningful change** (LCP stayed ~5.5s vs ~5.8s
   baseline in the same run) — ruled out.
2. **Framer Motion bundle weight blocking the main thread.** The journey
   route pulls in Framer Motion's full `motion.*` component (gesture/layout/
   drag machinery) even though this code only ever uses the lower-level
   `style={{...MotionValue}}` API with no `animate`/gesture props. Converted
   all `motion.div`/`motion.section`/`motion.span` usages in
   `journey-experience.tsx`, `scenes.tsx`, `ticket.tsx`, `plate.tsx` to the
   lighter `m.*` API under a single `<LazyMotion features={domAnimation} strict>`
   boundary in `JourneyExperience`. Typecheck/lint/tests/build all pass.
   **Result: no meaningful change** (median stayed in the 6–8.5s band,
   within run-to-run noise) — this was legitimate bundle hygiene but not the
   bottleneck.
3. **Root cause, confirmed:** the Lighthouse network-requests + build output
   show a ~830KB and ~320KB JS chunk present on **every route in the app**
   (`/experience`, `/account`, `/claim`, `/wallet`, consumer routes, etc. —
   not journey-specific), containing, among other things, a large
   unshaken `lucide-react` icon surface (thousands of `<path>`/`<circle>`
   elements) pulled in transitively because `@ticket/ui`'s package build
   emits CommonJS (`dist/index.js` starts with `"use strict"` +
   `Object.defineProperty(exports, ...)`), which defeats bundler
   tree-shaking of its barrel `index.ts` re-exports (Button, Card,
   BentoGrid, etc., alongside Sheet/Dialog/Dropdown's lucide icon imports
   that unrelated pages never render). Under the Lighthouse 4x-CPU +
   throttled-network *simulation* (Lantern), this sitewide JS weight is what
   Lantern attributes the multi-second "element render delay" to — even
   though the real (observed/unthrottled) trace paints the hero image at
   ~98ms, since the image itself is already complete in the SSR HTML and
   doesn't depend on this JS to become visible.

## Results (LCP, ms) — after `m.*`/LazyMotion fix only

| Page | Run 1 | Run 2 | Run 3 | Median | Baseline median (863c389e) |
|---|---|---|---|---|---|
| `/experience` (VI) | 5716 | 7765 | 8585 | **7765 ms** | 7391 ms |
| `/en/experience` (EN) | 8582 | 7310 | 8587 | **8582 ms** | 7462 ms |

No improvement outside run-to-run noise. The in-scope, journey-only fix
(LazyMotion) is kept because it's a correct, zero-risk reduction in unused
Framer Motion surface, but it does not move the measured metric.

## Why 2.5s isn't reachable within this task's scope

The dominant cost is **sitewide** framework/vendor JS (the ~830KB CJS-barrel
chunk), not journey-specific code. Fixing it requires one of:

1. **Fix `@ticket/ui` tree-shaking** — change its build to emit ESM (or add
   `"sideEffects": false` + per-component subpath exports so bundlers can
   drop unused Sheet/Dialog/Dropdown/lucide-react code for pages that only
   import `Button`). This is a `packages/ui` change: affects every consumer
   (web, portal, possibly mobile), is architecturally significant, and is
   outside this task's `apps/web` scope and "Architecture impact: Không"
   declaration.
2. **Stop importing the `@ticket/ui` barrel from `MarketingChrome`** (used
   by every marketing page, not just journey) and/or `MarketingMobileNavMenu`
   (which pulls in `Sheet`/Radix Dialog + `XIcon`). This is explicitly
   out of bounds per the task's "không đổi ... header consumer" constraint.
3. **Reduce root-layout global JS** (`apps/web/app/layout.tsx` and its
   providers) — also broader than journey, carries sitewide regression risk,
   not attempted here.

None of these are safe to do unilaterally within "Scope apps/web /
marketing/journey, không đổi header consumer, #1096". Flagging to
coordinator for a decision: accept the current Lighthouse-lab number with a
documented reason (real-world/observed LCP is ~98ms; the lab number is a
Lantern-simulation artifact of sitewide bundle weight), or scope a follow-up
task against `@ticket/ui`'s build output / root layout with the right
owner(s).

## Files
- `experience-run2.report.json` — one retained Lighthouse sample for the VI median.
- The other raw reports remain available in the Git history of PR #1091; the results table above records all six runs.
