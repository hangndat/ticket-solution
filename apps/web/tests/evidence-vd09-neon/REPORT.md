# VD-09 Neon marketing — logo user correction (filled ribbon V)

| Field | Value |
| --- | --- |
| Worktree | `vd09-marketing-neon` |
| Task | User correction: match isolated icon PNG (filled ribbons, not stroke outline) |
| Reference (session) | Orca paste `orca-paste-1792908528274-96498a72-b8c4-4904-b643-ab908460f4c6.png` |
| Component | `apps/web/src/marketing/marketing-neon-logo.tsx` |
| Route VI / EN | `/marketing`, `/marketing/en` |

## Change

- Replaced `stroke` + `strokeLinecap="round"` ribbon paths with **closed filled paths** (semicircular capsule tops via elliptical arcs).
- Left gradient: magenta → violet → blue; right: orange → pink → blue-violet at overlap (right path painted above left).
- Wordmark link, white **Vemoki** text, and `marketing-neon.css` lockup sizes unchanged.

## Checks

```text
pnpm --filter @ticket/web exec tsc --noEmit
pnpm --filter @ticket/web build
node apps/web/tests/vd09-logo-icon-preview.mjs
node apps/web/tests/vd09-neon-evidence.mjs http://127.0.0.1:3000
```

Horizontal overflow **0px** @ 1440, 390, 768, 320.

## Evidence artifacts

| File | Purpose |
| --- | --- |
| `logo-mark-34px.png` | Isolated mark @ ~header size |
| `logo-mark-102px-3x.png` | Isolated mark @ 3× for silhouette compare |
| `logo-1440-wordmark.png` | Desktop header crop |
| `logo-390-wordmark.png` | Mobile header crop |
| `logo-320-wordmark.png` | Crispness @ 320 |
| `logo-1440-mark-only.png` | Mark in header context |
| `marketing-vi-1440-full.png` | Full page desktop |
| `marketing-vi-390-full.png` | Full page mobile |

Exact commit SHA: see `docs/reviews/VD09-LOGO-FILLED-USER-2026-10-25.md` and worker_done body.
