# PR #833 / Issue #833 — claim + invite + lp-* shell migration evidence

| Field | SHA |
| --- | --- |
| Base (`main`) | `ccde6338b6f7f02df1ff0243a2a41fe3ba103bd1` |
| Visual capture (PR) | `ca18f38e3d8198fed995a35eb23251aa4d80f4e2` |
| Evidence commit (scripts + assets) | see PR tip after push |

**Stack:** `docker compose up -d postgres redis keycloak`; `./scripts/fe-uat-stack.sh bootstrap`; `./scripts/fe-uat-stack.sh print-env`; API `:3001`; web `next dev` `http://localhost:3000` (`NODE_ENV=development` — Secure cookies block OIDC on `next start` over HTTP). Login `attendee@example.com` / `attendee-demo`.

**Invite seed:** `createMembershipInvite` via `apps/web/scripts/pr833-seed-invite-token.mjs` (staff actor, no SQL bypass). Pending → `demo-studio`; consumed “đã dùng” → `mfest-demo`.

## Visual (@390 / @1280)

Script: `node apps/web/scripts/pr833-claim-invite-evidence.mjs <baseUrl> before|after <sha>`

| State | Before `before-ccde6338b6f7/` | After `after-ca18f38e3d81/` |
| --- | --- | --- |
| claim-empty | ✓ | ✓ |
| invite-empty | ✓ | ✓ |
| invite-token-invalid | ✓ | ✓ |
| invite-already-used | ✓ | ✓ |
| claim-token-invalid | ✓ | ✓ |
| redeem-guest, redeem-form-empty | ✓ | ✓ |
| not-found | ✓ | ✓ |

Per-state md5: `docs/reviews/assets/PR833/*/*.png.md5.txt`.

**Skipped (documented):** `app/error.tsx` (no stable public throw route); `invite-accept-success` full-page capture duplicates `invite-already-used` outcome chrome — accept path covered by seed + `fe-uat-stack check-ui` / invite flow.

**Parity:** Layout states match main for guest shells; Tailwind migration intentionally updates surfaces (md5 differs on claim/invite/redeem chrome vs legacy).

## axe (wcag2a/2aa/21aa)

`node apps/web/scripts/pr833-claim-invite-a11y.mjs http://localhost:3000 ca18f38e3d8198fed995a35eb23251aa4d80f4e2`

- **serious/critical = 0** on `/claim` and `/invite` (2 viewports × default + `prefers-reduced-motion: reduce`, animation settle).
- Summary: `docs/reviews/assets/PR833/a11y-ca18f38e3d81/summary.json`

## Lighthouse mobile `/claim` (390×844, 3-run median)

| Label | Perf median | A11y median |
| --- | --- | --- |
| `main-ccde6338` | 74 | 100 |
| `pr-ca18f38e` | 75 | 100 |

Δ perf median = **+1** (≤3 regression threshold); a11y unchanged. Artifacts: `docs/reviews/assets/PR833/lighthouse/`.

## Scripts added/updated

- `apps/web/scripts/pr833-claim-invite-evidence.mjs`
- `apps/web/scripts/pr833-claim-invite-a11y.mjs`
- `apps/web/scripts/pr833-claim-invite-lighthouse.mjs`
- `apps/web/scripts/pr833-seed-invite-token.mjs`

## Checks (worker)

```bash
pnpm --filter @ticket/web typecheck lint test
node scripts/ui-budget.mjs
```
