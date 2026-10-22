# UIF-811 WP-7 — test migration evidence

Cặp **before** (`origin/main` trước PR) / **after** (branch `hangndat/uif-811-tests-no-css-regex`) — UI giữ nguyên; chỉ đổi assertion test.

| File | Route | Viewport | Locale / state |
| --- | --- | --- | --- |
| `marketing-vi-390-nav-closed.png` | `/marketing` | 390×844 | VI, menu đóng |
| `marketing-vi-390-nav-open.png` | `/marketing` | 390×844 | VI, menu mở |
| `marketing-en-1280-header.png` | `/marketing/en` | 1280×800 | EN, desktop nav |
| `marketing-vi-1280-bento.png` | `/marketing` | 1280×800 | VI, bento in view |
| `attendee-claim-390-footer.png` | `/claim` | 390×844 | attendee footer (full page) |

Chạy evidence:

```bash
pnpm --filter @ticket/web build
pnpm --filter @ticket/web start &
node apps/web/tests/uif-811-wp7-evidence.mjs http://127.0.0.1:3000 docs/reviews/assets/uif-811-wp7/after
node apps/web/tests/marketing-mobile-nav-viewport.mjs http://127.0.0.1:3000
node apps/web/tests/marketing-bento-reduced-motion.mjs http://127.0.0.1:3000
bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/uif-811-wp7/after
```
