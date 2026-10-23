# #838 Web A — PA-02–06 handoff (Higo · web)

**Branch:** `hangndat/portal-audit` (local commits only; coordinator integrates)  
**Implementation SHA (Web A baseline):** `15f0c930be16b602f4a04c3ef254fa3ddd17d32e` (PA-02–06 first land)  
**Batch 2/2:** copy F02 + test cleanup F03 on integration branch — see `PORTAL-FIX-838-BATCH-2.md` for exact tip SHA.  
**Scope:** `apps/portal/**` — PA-01 / header owned by Web B slice.

## PA map

| ID | Summary | Primary paths |
| --- | --- | --- |
| PA-02 | Ops copy VI/EN; table column labels i18n; less API jargon on main flows | `src/i18n/messages.ts`, `src/ops/panels/*` |
| PA-03 | Source/ticket-type selectors only in Import tab | `app/t/.../guests/page.tsx` |
| PA-04 | `formatReportAsOf(asOf, locale)` + callsites | `src/ops/report.ts`, event home / gate / analytics pages |
| PA-05 | Export job ID accessible name + placeholder | `src/ops/panels/export-panel.tsx`, messages |
| PA-06 | Reduced-motion override for CSS spinner | `app/globals.css` |

## Checks (integration worktree — batch 2)

| Check | Result |
| --- | --- |
| `pnpm lint` (portal) | PASS |
| `pnpm test` (portal) | PASS 131/131 (removed 3 structural mirror tests per F03) |
| `pnpm --filter @ticket/portal build` | PASS |
| Browser UAT | Batch 2 final assets `docs/reviews/assets/portal-fix-838/final/` |

## Tests retained

- `tests/ops-report.test.ts` — `formatReportAsOf` vi/en + invalid date

## Superseded

- `tests/globals-reduced-motion.test.ts`, `tests/guests-import-filters.test.ts`, `tests/portal-pa01-header.test.ts` — removed batch 2/2 (browser/CSS proof thay thế).

## Gaps / notes

- PA-01 header unchanged by Web A.
- Some ops status strings still use machine enums in cells (by design).
