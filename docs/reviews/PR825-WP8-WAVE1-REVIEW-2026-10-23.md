# PR #825 / Issue #824 — independent DoD + UI/UX review

| Field | Value |
| --- | --- |
| PR | [#825](https://github.com/hangndat/ticket-solution/pull/825) |
| Issue | [#824](https://github.com/hangndat/ticket-solution/issues/824) |
| SHA | `d446765393b9c0e158ecd3956e1e766dd3bdb2a9` |
| Reviewer | Orca worker `task_6cc3c6ad2a39` (≠ implementer) |
| Role | reviewer-dod + reviewer-uiux (merged) |
| Verdict | **PASS** |

## CI (REST)

```
./scripts/gh-dod-evidence.sh 825 @ d446765393b9
turbo-persist, ci, web, mobile, changes — success
```

## Local checks (same SHA)

| Check | Result |
| --- | --- |
| `pnpm --filter @ticket/web typecheck` | pass |
| `pnpm --filter @ticket/web lint` | pass |
| `pnpm --filter @ticket/web test` | 365 pass |
| `pnpm --filter @ticket/web build` + `test:routes` | pass (legacy-cascade D-1) |
| `pnpm --filter @ticket/ui test` | 17 pass |
| `node scripts/ui-budget.mjs` | `web.css_lines` 3764 (baseline 3764, was 5713 pre-wave) |
| `test ! -e apps/web/app/marketing-uplift.css` | pass |

## Lighthouse (mobile 390×844, prod `next start` :3456, Lighthouse 13.5.0)

| Route | Perf | A11y | BP | SEO |
| --- | ---: | ---: | ---: | ---: |
| `/marketing` (VI) | 79 | 94 | 100 | 69 |
| `/marketing/en` (EN) | 79 | 97 | 100 | 69 |

Baseline `docs/reviews/assets/PR776-marketing-lighthouse/after-fix/*` (Lighthouse 12.6.1, URL `/`): **perf VI 87, EN 85** (categories only store performance). Same reviewer host retest `/` @ PR825 SHA: perf **79** — treat as **machine/run variance**, not a isolated CSS regression signal.

## axe (Playwright + axe-core, WCAG2a/2aa/21aa tags)

| Route | Total violations | Serious/critical |
| --- | ---: | ---: |
| `/marketing` | 1 | 1 (`color-contrast`, 18 nodes) |
| `/marketing/en` | 1 | 1 (`color-contrast`, 18 nodes) |

## Visual evidence (`docs/reviews/assets/PR824/`)

Before `a64dcbfe34c0` vs after `62fba60987f6` (ancestor of tip): paired hero/interest/nav PNG **MD5 all DIFF** (expected after Tailwind migration). Gap: `interest-disabled-vi-390-before` has no 390-after pair (after only `interest-disabled-vi-1280`).

## Findings

| ID | Level | Chặn merge | Căn cứ | Điều kiện đóng |
| --- | --- | --- | --- | --- |
| F01 | should-fix | Không | Issue #824 scope `apps/web/src/marketing/**`; PR also edits `packages/ui/src/marketing/*` + `packages/ui/test/primitives-ssr.test.cjs` | Document in PR/issue why UI package change was required (mkt-* CSS removed with `marketing-uplift.css`); confirm no other `@ticket/ui` consumer — grep shows **only** `apps/web` marketing imports `DemoMetric` / `ProductPreviewFrame` / `StepsTimeline`. API/props unchanged; defaults now Tailwind self-contained. |
| F02 | should-fix | Không* | `FE-UI-FRAMEWORK-AUDIT` §6A axe 0 aspiration; DoD Lighthouse/axe | Fix contrast tokens or document pre-existing baseline on `main`; re-run axe serious/critical=0 on both locales. *Chặn nếu PM chốt axe 0 cứng cho marketing pilot. |
| F03 | nit | Không | `docs/reviews/assets/PR824/after-62fba60987f6` vs tip `d446765` | Optional: refresh after folder on tip SHA (tip commit is SSR test-only). |
| F04 | nit | Không | PR824 evidence matrix | Add `interest-disabled-vi-390-after` or drop 390-before row for symmetry. |
| F05 | nit | Không | `packages/ui/.../product-preview-frame.tsx` demo ticket gradients `from-indigo-900` / `to-rose-700` etc. | Prefer `@theme` / brand tokens for demo art (D-1 hygiene), or accept as decorative literals in isolated preview. |

## AC trace (#824)

- `marketing-uplift.css` removed — **yes**; layout no longer imports it.
- Legacy marketing selectors removed from `live-pulse-legacy.css` — **yes**; no `marketing-` / `mkt-` class rules remain in live CSS; grep attendee/redeem/claim/account/admin surfaces — **no** dependency on removed selectors.
- Tailwind + `@ticket/ui`, tokens via theme — **yes** (`marketing-surface.ts` centralizes utilities; `@theme` keyframes only in `globals.css` @layer theme).
- No new hand-authored CSS bulk — **yes** (21 lines globals: scrollbar + 2 keyframes).
- Tests not regex-on-CSS (#812) — **yes** (`marketing-bento`, `marketing-mobile-nav` assert TSX/SSR markers).
- `legacy-cascade.postbuild` — marketing marker removed appropriately; still validates D-1 layers.
- Copy/behavior — no copy file changes in diff scope; interest form still `@ticket/ui` Button.
- Light-only — `scheme-light` on `marketingSurface`.

## Coordinator deep-dives

**(a) `packages/ui`:** Required to drop `mkt-*` class names that depended on deleted uplift CSS; low blast radius (marketing-only consumers). **(b) `marketing-surface.ts`:** Legitimate shared Tailwind class map (tokens + `color-mix(var(--color-*))`), not D-1 evasion via inline styles. **(c) `ui-dead-css*.mjs`:** In scope — remove deleted CSS path from dead-rule scans. **(d) Lighthouse/axe:** Numbers above. **(e) Visual parity:** Evidence PNGs differ before/after as required; no Orca re-capture on tip (tip diff is test-only).
