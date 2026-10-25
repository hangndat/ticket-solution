# VD-09 Neon marketing — user V mark PNG (definitive asset)

| Field | Value |
| --- | --- |
| Branch | `hangndat/vd09-marketing-neon` |
| Asset | `public/marketing/neon/vemoki-v-mark.png` (128×121 RGBA, ~12KB) |
| Component | `apps/web/src/marketing/marketing-neon-logo.tsx` |
| Header/footer | `data-testid="mkt-wordmark"` / `mkt-footer-wordmark` |

## Change

- Replaced inline SVG ribbon paths with optimized transparent PNG from user-supplied source (broad rounded base, capsule arms).
- `next/image` with `sizes` for 34–40px header lockup; CSS `object-fit: contain`, no opaque backing.
- Footer sales chrome repeats neon wordmark lockup.

## Checks (local)

- `pnpm --filter @ticket/web typecheck` — pass
- `pnpm --filter @ticket/web build` — pass
- Focused marketing tests — pass
- `vd09-neon-interest-click.mjs` — pass
- Locale select from `/marketing#interest` → `/en#interest` (hash preserved)

## Screenshots

| File | Viewport |
| --- | --- |
| `logo-1440-wordmark.png` | 1440 header lockup |
| `logo-390-wordmark.png` | 390 header lockup |
| `logo-320-wordmark.png` | 320 header lockup |
| `logo-mark-34px.png` | Isolated mark @ 34px (shape gate) |
