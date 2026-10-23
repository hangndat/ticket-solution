# PR #828 — WP-8 wave 2b evidence

| Field | Value |
| --- | --- |
| Base (before) | `9371a5b14da7a03b011457e5baffe33aeb194031` |
| PR tip (after) | `1319c29667613199bb5025201069a54c8e423e2a` |

## Module CSS gate

```bash
find apps/web/app apps/web/src -name "*.module.css" | wc -l
# → 2 (redeem, account)
```

## Visual (`docs/reviews/assets/PR828/`)

Server: `WEB_PUBLIC_ORIGIN=http://127.0.0.1:3456` + `next start --port 3456` (no live API — published event surfaces `event-unreachable`).

| State | Before dir | After dir |
| --- | --- | --- |
| Event detail @390/@1280 | `before-9371a5b14da7/event-detail-*` | `after-1319c2966761/event-detail-*` |
| Ticket need-login | `ticket-need-login-*` | same md5 parity on unreachable API |
| Ticket invalid UUID | `ticket-invalid-*` | |
| Wallet need-login | `wallet-need-login-*` | |

Authenticated wallet grid / ticket QR require `WEB_UAT_USER` + `WEB_UAT_PASS` (optional block in evidence script).

## axe-core (serious/critical)

Event detail route — 4 runs after animation settle (@390/@1280 × default + `prefers-reduced-motion: reduce`): **0** serious/critical (`a11y-1319c2966761/axe-summary.json`).

## Lighthouse mobile (event detail `/t/mfest-demo/events/mfest`)

| Label | Perf (median) | A11y (median) |
| --- | --- | --- |
| `main-9371a5b1` | 86 | 100 |
| `pr-tip-1319c2966761` | 77 | 100 |

Δ perf = −9 (exceeds ≤3 threshold on this workstation; a11y unchanged). Artifacts: `docs/reviews/assets/PR828/lighthouse/`.

## Commands

```bash
pnpm --filter @ticket/web build
cd apps/web && WEB_PUBLIC_ORIGIN=http://127.0.0.1:3456 pnpm exec next start --hostname 127.0.0.1 --port 3456
node apps/web/scripts/pr828-attendee-detail-evidence.mjs http://127.0.0.1:3456 before|after <sha>
node apps/web/scripts/pr828-attendee-detail-a11y.mjs http://127.0.0.1:3456 <sha>
node apps/web/scripts/pr828-lighthouse-benchmark.mjs http://127.0.0.1:3456 <label> docs/reviews/assets/PR828/lighthouse 3
pnpm --filter @ticket/web typecheck lint test
pnpm --filter @ticket/web build && pnpm --filter @ticket/web test:routes
node scripts/ui-budget.mjs
```
