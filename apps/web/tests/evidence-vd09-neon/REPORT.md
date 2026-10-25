# VD-09 Neon marketing landing — worker evidence (fix batch 1/2)

| Field | Value |
| --- | --- |
| Worktree | `vd09-marketing-neon` |
| Review base | `ab3c1b0bce13174e74c7e845d18f1bee2ba9967b` |
| Route VI | `/marketing` |
| Route EN | `/marketing/en` |
| Scope attr | `html[data-vemoki-marketing="neon-v1"]` (sales only) |

## Changes (batch 1/2)

- Final CTA: full-bleed crowd band using `final-cta-crowd-v2.png` with left scrim + readable CTAs.
- Hero desktop: `hero-composite-v2.png` layered visual; mobile keeps `hero-figure.png`.
- Interest form: dialog (desktop) / bottom sheet (mobile) via `MarketingInterestProvider`; no permanent light lead section.
- Header wordmark: gradient **V** mark + `emoki`; nav anchors remain truthful (`#product`, `#events`, `#interest`).
- Fourth hero trust chip: `Check-in QR` / `QR check-in` (product capability, not a stat).
- `PROVENANCE.md` documents both 2026-10-25 OpenAI imagegen originals.

## Checks

```text
pnpm --filter @ticket/web typecheck
pnpm --filter @ticket/web test   # 288 pass
pnpm --filter @ticket/web build
node apps/web/tests/vd09-neon-evidence.mjs http://127.0.0.1:3000
```

Chrome channel Playwright; horizontal overflow **0px** at 1440, 390, 768, 320.

Full-page scroll height (prod, post-fix): ~2488px desktop / ~2583px mobile (vs pre-fix ~3505 / ~3785); reference artboards ~1536 / ~2329 — remaining delta is product chrome (header, demo note, footer), not interest form.

## Visual self-score (worker, not independent acceptance)

| Viewport | Score | Notes |
| --- | ---: | --- |
| Desktop 1440 | **94/100** | Crowd CTA + composite hero close to approved art; locale/login chrome and hero composite framing still differ slightly from static mock |
| Mobile 390 | **96/100** | Stack, crowd CTA, and subject hero align well; extra demo-note line vs static PNG |

EN captures: `marketing-en-1440-full.png`, `marketing-en-390-full.png`.

## References

- Desktop: `docs/design/Vemoki-Complete 2/reference/approved-neon-desktop.png`
- Mobile: `docs/design/Vemoki-Complete 2/design-system/marketing/mobile.png`
