# PR #833 — WP-8 wave 3b claim / invite / lp-* shell migration

**Issue:** #833 (Epic #786)  
**Role:** web · Architecture impact: Không

## Code SHA (tip — update after push)

Recorded at PR open from `git rev-parse HEAD` on branch `hangndat/uif-833-claim-invite-shell`.

## Scope delivered

- Tailwind v4 + `@ticket/ui` surfaces for `app/claim/**`, `app/invite/**`, shared redeem dev chrome (`app/redeem`, `src/redeem`), `app/error.tsx`, `app/not-found.tsx`.
- New modules: `src/guest/guest-flow-surface.ts`; expanded `src/redeem/redeem-surface.ts`.
- Removed claim/invite-only selectors from `live-pulse-legacy.css` (admin/platform/account legacy unchanged per D-7).

## DoD grep (legacy class names in scope)

```bash
rg 'className=.*"(lp-|shell|redeem-form|redeem-status|…)' \
  apps/web/app/claim apps/web/app/invite apps/web/app/redeem \
  apps/web/src/redeem apps/web/app/error.tsx apps/web/app/not-found.tsx
# → no matches
```

## Automated checks (worker)

```bash
pnpm --filter @ticket/contracts --filter @ticket/ui --filter @ticket/web-session build
pnpm --filter @ticket/web typecheck lint test
pnpm --filter @ticket/web build
pnpm --filter @ticket/web test:routes
node scripts/ui-budget.mjs --update   # web.css_lines 2190 → 2126
```

## Visual / a11y / Lighthouse (local stack)

Scripts (reuse PR #830 Keycloak login helpers):

```bash
docker compose up -d postgres redis keycloak
# configure .env from .env.example, then:
pnpm --filter @ticket/backend migrate && pnpm demo:seed
# API + web: pnpm --filter @ticket/api dev & pnpm --filter @ticket/web build && pnpm --filter @ticket/web start --port 3456

WEB_UAT_USER=attendee@example.com WEB_UAT_PASS=attendee-demo \
  node apps/web/scripts/pr833-claim-invite-evidence.mjs http://127.0.0.1:3456 after <SHA>

node apps/web/scripts/pr833-claim-invite-a11y.mjs http://127.0.0.1:3456 <SHA>
# axe serious/critical target: 0 (motion + prefers-reduced-motion)

# Lighthouse mobile /claim or /invite — adapt apps/web/scripts/pr830-redeem-lighthouse.mjs paths → PR833 assets/
```

Assets directory: `docs/reviews/assets/PR833/` (`before-<main-sha>/`, `after-<pr-sha>/`, `a11y-<pr-sha>/`).

**Worker note:** Full stack evidence requires repo `.env` (not present in Orca worktree). CI web job validates build/test; coordinator/reviewer re-runs UAT on integrated checkout with secrets.

## axe / Lighthouse summary

| Check | Result |
| --- | --- |
| axe serious/critical | Pending full stack (script `pr833-claim-invite-a11y.mjs`) |
| Lighthouse mobile median | Pending full stack (adapt `pr830-redeem-lighthouse.mjs` for `/claim`) |
