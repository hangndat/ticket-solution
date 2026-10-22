# Marketing UI uplift — implementation evidence · 2026-10-22

| Trường | Giá trị |
| --- | --- |
| Epic | [#770](https://github.com/hangndat/ticket-solution/issues/770) |
| Prototype | `docs/design/ui-uplift-2026-10/marketing/` |
| Slice | Hero EOS ink + ProductPreviewFrame, nav locale-sync, ink/paper rhythm, Trust 5-up, StepsTimeline, Outcomes ink + chart |

## Checks (local)

```bash
pnpm --filter @ticket/ui test
pnpm --filter @ticket/web lint
pnpm --filter @ticket/web typecheck   # sau build @ticket/contracts + @ticket/web-session
pnpm --filter @ticket/web test
NODE_OPTIONS='--max-old-space-size=4096' node --test apps/web/tests/routes.integration.mjs
pnpm --filter @ticket/web build
```

## Visual evidence

Chạy server prod local rồi capture (Playwright):

```bash
pnpm --filter @ticket/web build && pnpm --filter @ticket/web start
node apps/web/tests/marketing-uplift-evidence.mjs http://127.0.0.1:3000
```

Output: `docs/reviews/assets/ui-uplift-marketing-impl/*.png` (1280 + 390, VI + EN).

So sánh cạnh prototype: `docs/reviews/assets/ui-uplift-marketing/`.
