# VD-09 marketing logo — user correction (filled ribbon V)

| Field | Value |
| --- | --- |
| Worker | Higo (`web`), dispatch `task_d6e8b90dda0e` |
| Reference | User-supplied isolated icon (Orca session attachment) — “vầy mới đúng” |
| Scope | `apps/web/src/marketing/marketing-neon-logo.tsx`, evidence PNGs, preview script |
| **Exact SHA** | `git rev-parse HEAD` on branch `hangndat/vd09-marketing-neon` after this change lands |

## Visual compare

| Asset | Path |
| --- | --- |
| Reference | Session PNG (filled capsule ribbons, overlap blue-violet base) |
| Mark @ 34px | `apps/web/tests/evidence-vd09-neon/logo-mark-34px.png` |
| Mark @ 3× | `apps/web/tests/evidence-vd09-neon/logo-mark-102px-3x.png` |
| Desktop lockup | `apps/web/tests/evidence-vd09-neon/logo-1440-wordmark.png` |
| Mobile lockup | `apps/web/tests/evidence-vd09-neon/logo-390-wordmark.png` |

## Implementation notes

- Prior SVG used thick **strokes** (outline-like V with round caps). Correction uses two **filled** closed paths with `A` arc pairs for capsule tops.
- Transparent exterior preserved (`fill="none"` on root SVG; paths use gradient fills only).
- `chrome.tsx` link + `aria-label` unchanged; decorative lockup remains `aria-hidden`.

## Checks

| Check | Result |
| --- | --- |
| `tsc --noEmit` (@ticket/web) | Pass |
| `pnpm --filter @ticket/web build` | Pass |
| Overflow 320 / 390 / 1440 | **0px** (`vd09-neon-evidence.mjs`) |
