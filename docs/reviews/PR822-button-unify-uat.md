# PR822 — WP-4 Button unify UAT

**Code SHA (captures):** `fd082fabb2ba` (`git rev-parse HEAD` immediately before evidence-only commit).

**Evidence tip SHA:** see latest commit on `hangndat/uif-822-button-unify` (docs/assets may be one commit after code SHA).

## Orca browser UAT

- Worktree: repo root (`ORCA_WORKTREE` / `path:<abs>` from script)
- Server: `pnpm --filter @ticket/web build && PORT=3000 pnpm --filter @ticket/web start` (`.env.example` OIDC vars)
- Page id: `UAT_PAGE_ID` (Orca `browserPageId`)
- Command: `UAT_PAGE_ID=<id> node apps/web/scripts/capture-pr822-uat.mjs`

## Assets (`docs/reviews/assets/PR822/` — suffix `fd082fabb2ba`)

| File | MD5 | Route / state |
|------|-----|----------------|
| mkt-1280-default | 9d6996e0ffd521987bee3ace63fd3d59 | `/marketing#top` 1280 default |
| mkt-390-default | d41db77b429dade026b5951c1a86a2a0 | `/marketing#top` 390 default |
| mkt-1280-hover | 2af3fa3bcc663328ae670ddb89502d85 | hero `cta-demo` hover |
| mkt-1280-focus | 9708993043cf5b8d1d3fd9fb85a7add1 | hero `cta-demo` focus |
| mkt-1280-disabled | b8ee6737af5816c2d5605a2ce0564c89 | `#interest` submit `disabled` |
| attendee-1280-default | e3bc1c3f620dbc3300d456eac1891912 | `/redeem` 1280 guest gate |
| attendee-390-default | 12e7d8e41d085faecba890103fbceb1b | `/redeem` 390 guest gate |
| attendee-1280-hover | 206df1120a1b5518290f22627c02402d | `/wallet` 1280 primary CTA hover (guest) |
| attendee-1280-focus | e429f12c25527e5de668cdbbd35692ed | `/redeem` gate primary focus |
| attendee-1280-disabled | 2055b38a91012e61f1da1204b7ea4fa6 | `/invite` 1280 submit disabled (no token) |

Script asserts distinct MD5 within marketing @1280 (default/hover/focus/disabled) and attendee @1280 (same four). Exits non-zero on Orca failure or MD5 collision.

## DoD commands

```bash
grep -cE '^\.(mkt-)?btn|cta' apps/web/app/*.css   # all 0
node scripts/ui-budget.mjs
pnpm --filter @ticket/ui test
pnpm --filter @ticket/web typecheck lint test
pnpm --filter @ticket/web build && pnpm --filter @ticket/web test:routes
```
