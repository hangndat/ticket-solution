# VD-04 Web — Marketing phase 1 evidence

**Issue:** #881 · **Epic:** #874 · **Scope:** `apps/web/**` marketing home/hero/lead (neon scoped)

## SHA

Record after commit: `git rev-parse HEAD` on branch `hangndat/vd04-web-surfaces`.

## Changes

- Scoped neon marketing via `html[data-vemoki-marketing='neon-v1']` (sales pages only, `MarketingNeonScope`).
- Hero: eyebrow, gradient headline, product proof chips, decorative orbs/ribbons (`prefers-reduced-motion` off).
- Lead `#interest`: calm paper surface on neon shell; form/chrome from #870 preserved.
- Tokens in `apps/web/app/globals.css` (not global Live Pulse product tokens).

## Checks (local, SHA above)

| Check | Result |
| --- | --- |
| `pnpm --filter @ticket/web lint` | PASS |
| `pnpm --filter @ticket/web typecheck` | PASS |
| `pnpm --filter @ticket/web test` | PASS |
| `pnpm --filter @ticket/web build` | PASS |
| `node scripts/ui-budget.mjs --scope web` | PASS |

## Responsive / a11y

- Layout regression harness: `apps/web/tests/fe-layout-regression.mjs` (hero `.mkt-hero-copy`, VI/EN height delta).
- Orca browser UAT: coordinator may capture 390/1024/1440 on integrated SHA if required for K-08.

## Phase 2 attendee web delta (not in this task)

Per `docs/design/vemoki-unified-v1/VD-03-UI-IMPLEMENTATION-HANDOFF.md` priority #2:

- Routes: `app/(consumer)/t/[tenantSlug]/events/[eventSlug]`, redeem, wallet, `tickets/[ticketId]`
- Chrome: `ConsumerPageShell`, route skeletons, shared form chrome (#870)
- Visual: event header branded, catalog card hierarchy, light atmosphere on detail
- Wallet/QR card composition, offline copy; no web gate/scanner UI
