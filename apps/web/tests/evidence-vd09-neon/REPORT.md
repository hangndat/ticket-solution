# VD-09 Neon marketing landing — worker evidence (fix batch 2/2)

| Field | Value |
| --- | --- |
| Worktree | `vd09-marketing-neon` |
| Review base | `c3a1da5ccfdf7f75895a1b0e0dbe9d0d691e4a14` (UI/UX review FAIL 94/90) |
| Route VI | `/marketing` |
| Route EN | `/marketing/en` |
| Scope attr | `html[data-vemoki-marketing="neon-v1"]` (sales only) |

## Changes (batch 2/2)

- **F09:** Root cause — same-document `#interest` updates via `history.pushState` (Next/App Router) do not emit `hashchange`, so dialog state never synced on CTA click. Fixed with `InterestCtaLink`/`InterestCtaAnchor`, capture-phase delegation, `setInterestHashInHistory()` + synthetic `hashchange`, and `popstate` sync.
- **F08:** Mobile final CTA — inset rounded card with concentric neon ripples (mock `mobile.png`); desktop keeps full-bleed crowd band.
- **F10 / desktop ≥95:** Decorative script flourish on final crowd band (`Good Events` / `Brighter Together`).
- Playwright click-path: `apps/web/tests/vd09-neon-interest-click.mjs` (hero, final, nav, deep link, Escape, form inputs).

## Checks

```text
pnpm --filter @ticket/web typecheck
pnpm --filter @ticket/web test
pnpm --filter @ticket/web build
node apps/web/tests/vd09-neon-interest-click.mjs http://127.0.0.1:3000
node apps/web/tests/vd09-neon-evidence.mjs http://127.0.0.1:3000
bash docs/agents/tools/ui-evidence-check.sh apps/web/tests/evidence-vd09-neon
```

Chrome channel Playwright; horizontal overflow **0px** at 1440, 390, 768, 320.

## Visual self-score (worker, not independent acceptance)

| Viewport | Score | Notes |
| --- | ---: | --- |
| Desktop 1440 | **95/100** | Crowd CTA + script flourish; product nav/chrome unchanged |
| Mobile 390 | **96/100** | Inset ripple final card; hero stack unchanged |

EN captures: `marketing-en-1440-full.png`, `marketing-en-390-full.png`.

## References

- Desktop: `docs/design/vemoki-unified-v1/reference/approved-neon-desktop.png`
- Mobile: `docs/design/vemoki-unified-v1/design-system/marketing/mobile.png`
