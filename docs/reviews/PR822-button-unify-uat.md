# PR822 — WP-4 Button unify UAT

**SHA (pre-commit base):** `cda20b2498b4` — update to PR tip after push.

## Orca browser UAT

- Worktree: `/Users/admin/orca/workspaces/main/uif-822-button-unify`
- Server: `pnpm start` on `apps/web` (production build)
- Page id: `1c89cfd0-09f7-497f-9d4b-9907cab0b56d`
- Command: `node scripts/capture-pr822-uat.mjs` (+ extra focus on interest submit)

## Assets (`docs/reviews/assets/PR822/`)

| File | MD5 | Route / state |
|------|-----|----------------|
| mkt-1280-default | 9a3ef8025fed0d4a528d27ba79a847f1 | `/marketing#top` 1280 default |
| mkt-390-default | e87594e1d49b28c7463764f779dd6888 | `/marketing#top` 390 default |
| mkt-1280-hover-demo | 3a352abbcf27ffc99da19e32dd79c97d | hero demo CTA hover |
| mkt-1280-focus-demo | 1531a5f0437a92a2630663f759ca8b6a | hero demo CTA focus |
| mkt-390-disabled-interest | 588839546e8a939668b242eff5491c04 | interest section 390 |
| mkt-390-disabled-submit | c8a3cd07595769bcd880c06edb9cc73f | interest submit focus 390 |
| attendee-1280-default | 1b97cc55355dd4a8b5cc4e6aa9c63182 | `/redeem` 1280 |
| attendee-390-default | 4b8e7677ef743cf0d1f8d216306323ec | `/redeem` 390 |

**Note:** `/redeem` without session shows auth gate (no submit); attendee focus/hover screenshots match default until OIDC stub session is available.

## DoD commands

```bash
grep -cE '^\.(mkt-)?btn|cta' apps/web/app/*.css   # all 0
node scripts/ui-budget.mjs                         # web.css_lines 6038 → 5713
pnpm --filter @ticket/ui test
pnpm --filter @ticket/web typecheck lint test test:routes
```
