# PR #846 — D-7 cutover evidence

| Field | Value |
| --- | --- |
| Issue | [#846](https://github.com/hangndat/ticket-solution/issues/846) |
| Branch | `hangndat/web-846-d7-cutover` |
| PR | [#852](https://github.com/hangndat/ticket-solution/pull/852) |
| SHA | `89348c82c70abf60d232e741b5979ce50f2411bc` |

## Checks (local)

```bash
test ! -e apps/web/app/live-pulse-legacy.css
test ! -d apps/web/app/admin && test ! -d apps/web/app/platform
node scripts/ui-budget.mjs
pnpm --filter @ticket/web typecheck lint test
pnpm --filter @ticket/web build && pnpm --filter @ticket/web test:routes
pnpm --filter @ticket/portal test  # includes load-shell-context.test.ts
```

## UAT (G-791-5)

Headless stack: `./scripts/fe-uat-stack.sh` — redirect `/admin`·`/platform`, POST legacy BFF → 410, attendee spot-check, portal Notify/Operator scripts under `apps/portal/scripts/`. Assets: `docs/reviews/assets/PR846/` (coordinator fill after stack run).

## Scope notes

- Shared modules moved out of deleted trees: `event-scope`, `config-schema`, `platform-contracts`, `me-shape`, etc.
- ADR-22 marked **Done: legacy removed** in `docs/ops/ADR-22-WEB-DS-ACETERNITY.md`.
