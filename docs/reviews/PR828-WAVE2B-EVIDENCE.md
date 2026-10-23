# PR #828 — WP-8 wave 2b evidence

| Field | Value |
| --- | --- |
| Base (before) | `9371a5b14da7a03b011457e5baffe33aeb194031` |
| PR tip (after) | `f84b7e6549117a38e55fcbd75c19d971b3214c5f` |

## Module CSS gate

```bash
find apps/web/app apps/web/src -name "*.module.css" | wc -l
# → 2 (redeem, account)
```

## Visual (`docs/reviews/assets/PR828/`)

Stack: `docker compose up -d postgres redis keycloak` → `./scripts/fe-uat-stack.sh bootstrap` → API `:3001` + `next start` `:3000` with `print-env` (OIDC). Login: `WEB_UAT_USER=attendee@example.com` `WEB_UAT_PASS=attendee-demo` via `http://localhost:3000/api/auth/login` (Keycloak `#kc-login`).

| State | Before (`9371a5b1`) | After (PR tip) |
| --- | --- | --- |
| Guest routes @390/@1280 | `before-9371a5b14da7/*` | `after-f84b7e654911/*` |
| Wallet có vé (đăng nhập) | `wallet-ready-*-before.png` | `wallet-ready-*-after.png` |
| Ticket QR (đăng nhập) | `ticket-ready-*-before.png` | `ticket-ready-*-after.png` |

MD5 authenticated states **khác** guest-only; wallet/ticket before vs after so sánh parity visual wave 2b.

## axe-core (serious/critical)

Script `apps/web/scripts/pr828-attendee-detail-a11y.mjs` — event + wallet/ticket (guest + đăng nhập) @390/@1280 × default + `prefers-reduced-motion: reduce`. **0** serious/critical (`a11y-f84b7e654911/axe-summary.json`, 20 runs).

## Lighthouse mobile (event detail `/t/mfest-demo/events/mfest`)

| Label | Perf (median) | A11y (median) |
| --- | --- | --- |
| `main-9371a5b1` | 86 | 100 |
| `pr-tip-1319c2966761` | 77 | 100 |

Δ perf implementer = −9 (reviewer paired 77/77 Δ0 — xem PR #829). Artifacts: `docs/reviews/assets/PR828/lighthouse/`.

## Commands

```bash
./scripts/fe-uat-stack.sh bootstrap
# API + web shells: ./scripts/fe-uat-stack.sh print-env
pnpm --filter @ticket/web build
cd apps/web && NODE_ENV=production pnpm exec next start --hostname 127.0.0.1 --port 3000
WEB_UAT_USER=attendee@example.com WEB_UAT_PASS=attendee-demo \
  node apps/web/scripts/pr828-attendee-detail-evidence.mjs http://localhost:3000 before|after <sha>
WEB_UAT_USER=attendee@example.com WEB_UAT_PASS=attendee-demo \
  node apps/web/scripts/pr828-attendee-detail-a11y.mjs http://localhost:3000 <sha>
pnpm --filter @ticket/web typecheck lint test
env -i HOME="$HOME" PATH="$PATH" pnpm --filter @ticket/web test:routes
node scripts/ui-budget.mjs
```
