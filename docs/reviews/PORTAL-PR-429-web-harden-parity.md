# Evidence — Issue #429 / T-WEB-HARDEN (parity + filters + a11y sample)

| Trường | Giá trị |
| --- | --- |
| Implementer | Orca Cursor worker · Role `web` · task `task_e184f10da3d6` · dispatch `ctx_a946df3650a7` · Run `run_34fde1e32ed1` |
| Scope | `apps/portal` (+ artifact này) — **không** `apps/api` / `packages/backend` |
| Architecture impact | **Có** — ADR-20 portal parity/a11y/filters (G-R1/G-N1/G-E1 consumer) |
| Deps | #420 T-WEB-PREP · #425 T-WEB-OPS · #428 T-BE-FILTERS (merged) |

## BA checklist (CS / export / import / staff / notify / report / config)

| Surface | Route | Evidence UI | Nest route (không mock PASS) |
| --- | --- | --- | --- |
| CS | `/t/{t}/e/{e}/support` | `CsPanel` | `GET/POST …/tickets*` via BFF |
| Export | `/guests#export` + `/audit#jobs` | `ExportPanel` + G-E1 status filter | `GET/POST …/exports` |
| Import | `/guests#import` | `ImportInvitationsPanel` | multi-step imports BFF |
| Staff | `/t/{t}/members` | members/invites tables | H-M* members/invites |
| Notify | `/guests#notifications` | `NotificationsOpsPanel` + G-N1 | `GET …/notifications` |
| Report | `/e/{e}` overview + `/gate` | O12 asOf + deep-links | `GET …/report` |
| Config | `/e/{e}/config` | versions/preview/rollback | config-versions BFF |

**Thiếu Nest route → không mock PASS:** interpreters trả `unknown` / UI Alert `warning` — không map thành success (xem `exportAlertType`, pending/notify unknown).

## Filter UI ↔ BE #428

| Gap | UI | BFF allowlist | Contract |
| --- | --- | --- | --- |
| G-R1 | Pending: source / type Select (catalog) + `q` requestId | `sourceId,ticketTypeId,q` | `PortalPendingQuery` |
| G-N1 | Notify: state + channel Select | `state,channel` | `PortalNotificationQuery` |
| G-E1 | Export history: status Select | `status` | `PortalExportQuery` |

## A11y / keyboard sample

- Skip link `#portal-main` + `portal-skip-link` (shell)
- Filter toolbars: `role="search"` + `aria-label` trên Apply
- Fixture: `apps/portal/tests/fixtures/filter-toolbar-a11y.html`
- Contracts: `apps/portal/src/ops/a11y-contracts.ts`
- `axe-core` import smoke trong `tests/ops-filters.test.ts` (không claim WCAG toàn app)
- Full headless Playwright axe = `T-UAT-PORTAL` (#439)

## unknown ≠ success

- `exportAlertType` / panel Alerts: `unknown`→warning, `rejected`→error
- History list fail-closed nếu row có `downloadUrl`/`objectKey`/`url`

## Permission tightening (vs PR #463 known gap)

- Guests tabs: chỉ mount khi có perm tương ứng (`inventory.import` / `redemption.approve` / `notify.send` / `export.*`)
- Export CTA gated `export.create` / `export.download`

## Checks

```text
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/web-session build
pnpm --filter @ticket/portal test
pnpm --filter @ticket/portal typecheck
```

| Tip SHA (behavior) | `4c9599198d1e31cf09016a0197d4fa522386aedc` |
| Local checks | `pnpm --filter @ticket/portal test` → 69/69 PASS; typecheck PASS; lint PASS |

Revalidation bắt buộc nếu có commit hành vi mới sau SHA này.
