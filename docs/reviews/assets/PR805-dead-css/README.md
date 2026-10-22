# PR #793 — dead CSS removal visual evidence

Base URL: `http://127.0.0.1:3048` (`next start` after `pnpm --filter @ticket/web build`).

| File pattern | Route | Viewport |
| --- | --- | --- |
| `marketing-home-vi-{1280,390}.png` | `/marketing` (vi) | desktop / mobile |
| `marketing-home-en-{1280,390}.png` | `/marketing/en` | desktop / mobile |
| `catalog-home-{1280,390}.png` | `/` (attendee catalog) | desktop / mobile |
| `event-detail-*` | `/t/mfest-demo/events/mfest` | desktop / mobile |
| `ticket-detail-*` | `/t/uat-device/tickets/97f77680-4d65-4b6d-baf3-b3f699a006a6` | desktop / mobile |
| `wallet-*` | `/wallet` | desktop / mobile |
| `redeem-*` | `/redeem` | desktop / mobile |
| `account-*` | `/account` | desktop / mobile |
| `privacy-*` | `/privacy` | desktop / mobile |
| `claim-*` | `/claim` | desktop / mobile |
| `invite-*` | `/invite` | desktop / mobile |

- `before/` — `origin/main` CSS (three uplift/legacy sheets) at same app commit.
- `after/` — branch with dead CSS removed.
- `diff-summary.json` — pixel diff counts (`pixelmatch` threshold 0.1). Expect **0** diff pixels on all pairs.

Capture:

```bash
node apps/web/tests/uif-793-dead-css-visual.mjs capture <dir> http://127.0.0.1:3048
node apps/web/tests/uif-793-dead-css-visual.mjs compare before after diff-summary.json
```
