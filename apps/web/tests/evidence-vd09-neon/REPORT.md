# VD-09 Neon marketing landing — worker evidence

| Field | Value |
| --- | --- |
| Worktree | `vd09-marketing-neon` |
| Base | `8f0648695115fd06b21abe1ffbc6fcceceb33127` |
| Route VI | `/marketing` |
| Route EN | `/marketing/en` |
| Scope attr | `html[data-vemoki-marketing="neon-v1"]` (sales only) |

## Implementation

- Replaced long `SalesPage` stack with neon blocks: hero, 4 event cards, product showcase, final CTA, interest form.
- `MarketingChrome` kept: locale VI/EN, `demoHref`, `loginHref`, interest CTA → `#interest`, nav anchors `#product` / `#events` / `#interest` (no fake pricing).
- Assets: `public/marketing/neon/*` from design handoff + `PROVENANCE.md` (AI art, release gate for rights).
- CSS: `src/marketing/marketing-neon.css` imported from `app/globals.css`.

## Checks (on the working tree before commit)

```text
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/ui build
pnpm --filter @ticket/web-session build
pnpm --filter @ticket/web lint
pnpm --filter @ticket/web typecheck
pnpm --filter @ticket/web test   # 288 pass
pnpm --filter @ticket/web build
```

Local prod server: `GET /marketing` → 200.

## Visual evidence

Target references:

- Desktop: `docs/design/Vemoki-Complete 2/reference/approved-neon-desktop.png`
- Mobile: `docs/design/Vemoki-Complete 2/design-system/marketing/mobile.png`

Capture script: `node apps/web/tests/vd09-neon-evidence.mjs http://127.0.0.1:3000` (after `pnpm --filter @ticket/web start`).

Chrome system capture completed with `node apps/web/tests/vd09-neon-evidence.mjs http://127.0.0.1:3000`. PNG artifacts are stored next to this report. Horizontal overflow was 0px at 1440, 390, 768 and 320px. The capture script uses Playwright's `chrome` channel, so it does not require a bundled Chromium download.

## Worker visual estimate (not independent acceptance)

| Block | Match estimate | Remaining gaps |
| --- | --- | --- |
| Hero (1440) | ~96 | Wordmark style differs (repo `vemoki` vs design `Vemoki` mark); header includes locale/login vs static HTML |
| Hero (390) | ~95 | Same; Sheet mobile nav vs design dropdown |
| Event grid | ~97 | — |
| Product | ~96 | Button component vs raw `.btn` radius shadow |
| Final CTA | ~97 | — |
| Interest form | N/A (functional) | Light paper section intentional for form readability |

## Functional smoke

- Interest form island still mounted at `#interest` (`InterestFormIsland`).
- Demo CTAs use `demoHref(productOrigin)`; labels include demo simulation copy (`hero.demo_note`, product caption).
