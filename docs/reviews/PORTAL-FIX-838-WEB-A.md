# #838 Web A — PA-02–06 handoff (Higo · web)

**Branch:** `hangndat/portal-fix-838-web` (local commit only; coordinator integrates)  
**Base:** `hangndat/portal-audit` @ `7dc042f`  
**Scope:** `apps/portal/**` — PA-01 / header **not** touched (PD / Web B).

## PA map

| ID | Summary | Primary paths |
| --- | --- | --- |
| PA-02 | Ops copy VI/EN; table column labels i18n; less API jargon on main flows | `src/i18n/messages.ts`, `src/ops/panels/*` |
| PA-03 | Source/ticket-type selectors only in Import tab | `app/t/.../guests/page.tsx` |
| PA-04 | `formatReportAsOf(asOf, locale)` + callsites | `src/ops/report.ts`, event home / gate / analytics pages |
| PA-05 | Export job ID accessible name + placeholder | `src/ops/panels/export-panel.tsx`, messages |
| PA-06 | Reduced-motion override for CSS spinner | `app/globals.css` |

## Checks (worktree)

| Check | Result |
| --- | --- |
| `pnpm lint` (portal) | PASS |
| `pnpm test` (portal) | PASS after `pnpm install --frozen-lockfile` + build `@ticket/contracts` + `@ticket/web-session` |
| `pnpm --filter @ticket/portal build` | PASS (with workspace packages built) |
| Browser UAT | **Not run** — coordinator fixture auth for Web B / acceptance |

## Tests added

- `tests/ops-report.test.ts` — `formatReportAsOf` vi/en + invalid date
- `tests/guests-import-filters.test.ts` — import filters scoped to Import tab
- `tests/globals-reduced-motion.test.ts` — `prefers-reduced-motion` CSS

## Gaps / notes

- PA-01 header unchanged by design.
- Some ops status strings still use machine enums in cells (by design); labels/placeholders/guides are operational.
- Ready for coordinator auth fixture when Web B needs rendered VI/EN evidence on Guests/CS/Export.

## Commit

`3d0a2867c31c85280572e2e3a3d1dfea76295150` — `fix(portal): PA-02–06 ops copy, import filters, locale as-of (#838)` (local only).
