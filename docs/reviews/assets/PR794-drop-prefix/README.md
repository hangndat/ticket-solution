# PR #794 — drop `ui:` prefix + legacy layers (D-1, D-4)

Base URL: `http://127.0.0.1:3194` (`pnpm --filter @ticket/web build` then `pnpm start -p 3194` with `WEB_PUBLIC_ORIGIN` set).

| File pattern | Route | Viewport | Notes |
| --- | --- | --- | --- |
| `marketing-home-vi-{1280,390}.png` | `/marketing` | desktop / mobile | |
| `marketing-home-en-{1280,390}.png` | `/marketing/en` | desktop / mobile | |
| `marketing-home-*-390-dark.png` | marketing home | mobile | `prefers-color-scheme: dark` (D-4) |
| `catalog-home-*` | `/` | 1280 / 390 | |
| `event-detail-*` | `/t/mfest-demo/events/mfest` | | |
| `ticket-detail-*` | `/t/uat-device/tickets/97f77680-…` | | |
| `wallet-*` · `redeem-*` · `account-*` · `privacy-*` · `claim-*` · `invite-*` | paths as named | | |

- `before/` — `origin/main` production build.
- `after/` — branch `hangndat/uif-794-drop-prefix-layer`.
- `diff-summary.json` — `pixelmatch` threshold 0.1. Sau `@layer legacy` (lượt 1/2): attendee desktop 1280 band header ~367–418 px (giảm so ~395 px trước layer); marketing full-page height lệch ~12–14 px (trước ~26 px) — xem `diff-*.png`.

```bash
node apps/web/tests/uif-794-drop-prefix-visual.mjs capture <dir> http://127.0.0.1:3194
node apps/web/tests/uif-794-drop-prefix-visual.mjs capture-dark <dir> http://127.0.0.1:3194
node apps/web/tests/uif-794-drop-prefix-visual.mjs compare before after diff-summary.json
bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/PR794-drop-prefix/before
bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/PR794-drop-prefix/after
```
