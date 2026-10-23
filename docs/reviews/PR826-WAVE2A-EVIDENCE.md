# PR #826 — WP-8 wave 2a evidence

| Field | Value |
| --- | --- |
| Base (before) | `bbf9f48ce60da0d25f361b036a58dbaeb69beeb0` |
| PR tip (after) | `0fa69c644ef787183ccb639d85d3600160c7f5df` |

## Visual (`docs/reviews/assets/PR826/`)

- Before: `before-bbf9f48ce60d/` — home header + nav sheet @390/@1280
- After: `after-0fa69c644ef7/` — same states; MD5 sidecars per PNG

## axe-core (serious/critical)

4 runs on `/` after animation settle: @390/@1280 × default + `prefers-reduced-motion: reduce` — **0** serious/critical (`a11y-0fa69c644ef7/axe-summary.json`).

## Lighthouse mobile (attendee home `/`)

| Label | Perf (median) | A11y (median) |
| --- | --- | --- |
| `main-bbf9f48c` | 70 | 100 |
| `pr-tip-0fa69c644ef7` | 67 | 100 |

Δ perf = −3 (within ≤3 threshold). Artifacts: `docs/reviews/assets/PR826/lighthouse/`.

## Commands

```bash
pnpm --filter @ticket/web start --port 3456
node apps/web/scripts/pr826-attendee-evidence.mjs http://127.0.0.1:3456 before|after <sha>
node apps/web/scripts/pr826-attendee-a11y.mjs http://127.0.0.1:3456 <sha>
node apps/web/scripts/pr826-lighthouse-benchmark.mjs http://127.0.0.1:3456 <label> docs/reviews/assets/PR826/lighthouse 3
```
