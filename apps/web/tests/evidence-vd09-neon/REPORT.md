# VD-09 Neon — locale toggle + edge decor evidence

| Field | Value |
| --- | --- |
| Branch | `hangndat/vd09-marketing-neon` |
| Scope | VI/EN header toggle (rightmost), edge ribbons/spheres, no header advisory CTA |

## Checks (local)

- `pnpm --filter @ticket/web typecheck` — pass
- `pnpm --filter @ticket/web build` — pass
- Focused marketing + layout regression tests — pass
- Playwright evidence — overflow 0px at 1440/768/390/320

## Screenshots

| File | Notes |
| --- | --- |
| `marketing-vi-1440-full.png` | Desktop VI full page |
| `marketing-en-1440-full.png` | Desktop EN full page |
| `marketing-vi-768-overflow.png` | Tablet viewport |
| `marketing-vi-390-full.png` | Mobile VI |
| `marketing-en-390-full.png` | Mobile EN |
| `marketing-vi-320-overflow.png` | Narrow mobile |
| `locale-toggle-vi-1440.png` | VI active toggle crop |
| `locale-toggle-en-390.png` | EN active toggle crop (mobile) |
| `mobile-nav-open-390.png` | Mobile sheet (no header advisory CTA) |

## Hash (PD F3)

`mkt-locale-en` href from `/marketing#interest` → `/en#interest` (verified via Playwright `getAttribute('href')`).
