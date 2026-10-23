# PR #835 / Issue #835 — Account Tailwind wave 3c evidence

| Field | Value |
| --- | --- |
| Base (main) | `35dba0c20cb36d30b3bc7157d4292e32560ff93b` |
| Visual capture SHA (after) | `e1dc26620cb36d30b3bc7157d4292e32560ff93b` (UI); tip may include a11y/contrast fix |
| Stack | `docker compose up -d postgres redis keycloak`; `./scripts/fe-uat-stack.sh bootstrap`; API `:3001`; web `next start` `http://localhost:3000` |
| Login | `attendee@example.com` / `attendee-demo` |

## Visual (@390 / @1280)

Script: `node apps/web/scripts/pr835-account-evidence.mjs <baseUrl> before|after <sha>`

| State | Before dir | After dir |
| --- | --- | --- |
| account-signed-out, account-signed-in, account-deletion, privacy, account-after-logout | `docs/reviews/assets/PR835/before-35dba0c20cb3/` | `docs/reviews/assets/PR835/after-e1dc26620cb3/` |

**Parity:** signed-out + after-logout md5 match before/after (guest). signed-in, deletion, privacy differ (expected Tailwind shell). **Skip:** multi-session list (≥2 devices) — no session-list UI on `/account` (only `SessionPanel`); see `SKIP-NOTES.md` in each capture dir.

## axe (wcag2a/2aa/21aa)

Script: `node apps/web/scripts/pr835-account-a11y.mjs http://localhost:3000 <sha>`

| Build | serious/critical |
| --- | --- |
| main `35dba0c20cb3` | **0** (`docs/reviews/assets/PR835/a11y-35dba0c20cb3/axe-summary.json`) |
| PR (post contrast fix on active nav) | **0** (`docs/reviews/assets/PR835/a11y-d24418f461e8/axe-summary.json` — re-run on tip after nav token tweak) |

12 runs each: 3 states × 2 viewports × 2 motion modes; animation settle + `prefers-reduced-motion: reduce`.

## Lighthouse mobile `/account` (390×844, signed-in, median 3 runs)

Script: `node apps/web/scripts/pr835-account-lighthouse.mjs http://localhost:3000 <label> docs/reviews/assets/PR835/lighthouse 3`

| Label | Perf median | A11y median |
| --- | --- | --- |
| `main-35dba0c2` | 84 | 100 |
| `pr-d24418f` | 84 | 100 |

Δ perf median = **0** (≤3); a11y unchanged at 100. Artifacts: `docs/reviews/assets/PR835/lighthouse/`.

## Checks (worker)

```bash
find apps/web/app apps/web/src -name '*.module.css' | wc -l   # → 0
pnpm --filter @ticket/web typecheck lint test
pnpm --filter @ticket/web build && pnpm --filter @ticket/web test:routes
node scripts/ui-budget.mjs   # web.module_css_files = 0
```

Legacy: account-only rules removed from `live-pulse-legacy.css`; admin/platform unchanged.
