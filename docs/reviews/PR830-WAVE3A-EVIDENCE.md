# PR #830 / Issue #830 — Redeem Tailwind wave 3a evidence

| Field | Value |
| --- | --- |
| Base (main) | `b34187919ade8ab5e07efcab59ac0284097c663d` |
| PR tip | `7d3b8fa8d1cae47cb19141d737704db1cb3db791` |
| Stack | `docker compose` postgres/redis/keycloak; `./scripts/fe-uat-stack.sh bootstrap`; API `:3001`; web `next start` `http://localhost:3000` |
| Login | `attendee@example.com` / `attendee-demo` |

## Visual (@390 / @1280)

Script: `node apps/web/scripts/pr830-redeem-evidence.mjs <baseUrl> before\|after <sha>`

| State | Before dir | After dir |
| --- | --- | --- |
| guest, auth-gate, form-empty, validate-error, processing, success, server-error | `docs/reviews/assets/PR830/before-b34187919ade/` | `docs/reviews/assets/PR830/after-<pr-sha-12>/` |

Success uses tenant-pinned `/redeem?…mfest-demo/mfest` + fresh demo code; other authed states use global single-code `/redeem`. Per-state md5 files: `*.png.md5.txt`. Guest/auth/form-empty/validate/server-error md5 match before/after (parity); success differs (expected Tailwind outcome chrome).

## axe (wcag2a/2aa/21aa)

Script: `node apps/web/scripts/pr830-redeem-a11y.mjs http://localhost:3000 <sha>`

- **serious/critical = 0** (20 runs: 5 states × 2 viewports × 2 motion modes)
- Summary: `docs/reviews/assets/PR830/a11y-pending/axe-summary.json` (axe run on PR UI; rename to `a11y-7d3b8fa8d1ca` optional)

## Lighthouse mobile `/redeem` (390×844, LH 13.5.0, 3 runs median)

| Label | Perf median | A11y median |
| --- | --- | --- |
| `main-b3418791` | 84 | 100 |
| `pr` (6 runs: 79,79,84,84,84,84) | **84** | 100 |

Δ perf median = **0** (≤3); a11y unchanged at 100. Artifacts: `docs/reviews/assets/PR830/lighthouse/`.

## Checks (worker)

```bash
test ! -e apps/web/app/redeem/redeem-surface.module.css
find apps/web/app apps/web/src -name '*.module.css' | wc -l  # → 1 (account)
pnpm --filter @ticket/web typecheck lint test
pnpm --filter @ticket/web build && pnpm --filter @ticket/web test:routes
node scripts/ui-budget.mjs
```

Legacy: shared `.redeem-*` rules in `live-pulse-legacy.css` retained for claim/invite/platform (grep confirmed).
