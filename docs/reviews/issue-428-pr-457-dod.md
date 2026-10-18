# DoD review — Issue #428 / PR #457 (T-BE-FILTERS)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS with known gap** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_ec3abbe9-2450-4c86-a34a-f78c7b3dbe70` · Task `task_70c21677d1ad` · Dispatch `ctx_d6005db0f331` · Run `run_34fde1e32ed1` · **≠** implementer `ctx_c2a55cfd5861` / `term_6d4159d9-703a-4b7e-be4c-a9505d545fd2` |
| Scope | Epic [#406](https://github.com/hangndat/ticket-solution/issues/406) · Story [#426](https://github.com/hangndat/ticket-solution/issues/426) · Issue [#428](https://github.com/hangndat/ticket-solution/issues/428) · PR [#457](https://github.com/hangndat/ticket-solution/pull/457) · ownership **backend** (`apps/api`, `packages/backend`) · G-R1 / G-N1 / G-E1 |
| Commit SHA | `569e25eaeab07b88a52041d84813545e2eae7265` (exact PR `headRefOid`) |
| Behavior SHA (ancestor) | `6b5a24bba9d518b992a7dff787325638cc11a3d2` — tip after behavior is docs-only handoff commits |
| Architecture impact | **Không** (additive filters theo contract #427 / ADR-20) — không drift thiết kế mới |
| Decision IDs | ADR-20 (portal/auth/API additive filters); contract Task #427 closed |

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse` / PR head | `569e25eaeab07b88a52041d84813545e2eae7265` khớp |
| Diff scope `origin/main...569e25e` | 13 files — `apps/api` + `packages/backend` + CI shard + handoff doc; không đụng web/mobile/lockfile secrets |
| Secret scan (diff) | Không thấy credential / private key / `.env` thật |
| CI Run | [39139902822](https://github.com/hangndat/ticket-solution/actions/runs/39139902822) trên headSha `569e25eaeab07b88a52041d84813545e2eae7265` — **success** |
| `backend` | PASS |
| `database-isolation` shard `portal-filters` (`test/portal-filters.test.cjs`) | PASS |
| `database-isolation` shard `rls` | PASS |
| Remaining database-isolation / web / mobile / portal / changes / turbo-persist | PASS (d5-* skipped) |
| Graph `detect_changes_tool` | Risk score inflated (stale graph build SHA ≠ PR head); **source/diff thắng** — review theo code + test + CI |

## AC mapping (G-R1 / G-N1 / G-E1)

Neo: `packages/contracts/src/portal-admin.ts` (`PortalPendingQuery` / `PortalNotificationQuery` / `PortalExportQuery` + `PortalExportsPage`) và `docs/plans/PORTAL-BACKEND-GAPS.md` §3.2.

| ID | Kỳ vọng | Evidence trên SHA |
| --- | --- | --- |
| **G-R1** | Optional `sourceId` / `ticketTypeId` / `q` (exact request UUID); omit = legacy pending list; masked email | `listStaffPendingRedemptions` + API query wiring; test lọc source/type/q + omit list 3 items + outsider `AuthzError` |
| **G-N1** | Optional `state` / `channel`; omit = legacy | `listEventNotifications` SQL additive AND; test state/channel/combo |
| **G-E1** | Export history cursor list + optional `status`; **không** object key / download URL | `listExportJobs` SELECT không lấy `object_key`; test assert không `objectKey`/`object_key`; cursor page + `INVALID_CURSOR`; outsider deny |
| Authz | `requireTenantPermission` deny-by-default | Pending + export outsider rejects; notify path vẫn gọi permission (thiếu assert riêng — xem gap) |
| RLS / isolation | Tenant-scoped SQL + CI RLS | Mọi query bind `tenant_id`; CI `rls` + `portal-filters` PASS trên exact SHA |

## Findings

### Blocker

Không có.

### Known gap (không hạ FAIL — không nuốt AC runtime)

1. **OpenAPI `GET …/exports` response schema lệch CursorPage.** Runtime + contract trả `{ items, nextCursor }` (`PortalExportsPage` / `ExportJobsPage`), nhưng `apps/api/openapi.json` + `@ApiOkResponse({ type: ExportJobSummaryDto, isArray: true })` mô tả **array** thuần. Item schema (không object key) đúng; wrapper sai. Follow-up: sửa Nest DTO page + regen OpenAPI (có thể gắn issue nhỏ / cùng Epic). **Không** chặn AC G-E1 runtime đã test.

### Should-fix / nit (không blocker)

1. OpenAPI đánh dấu nhiều query optional (`sourceId`, `cursor`, …) là `required: true` — pattern Nest sẵn có trên redemptions/notifications; consumer nên tin contract #427.
2. `portal-filters.test.cjs` không assert outsider deny cho `listEventNotifications` (code vẫn `requireTenantPermission`); nên bổ sung đối xứng pending/export.
3. Không có fixture cross-tenant B riêng trong shard filters — chấp nhận nhờ SQL `tenant_id` + CI `rls` xanh.

## Limitations (reviewer)

- Không re-run Docker isolation local trong session này; tin CI exact-SHA shards `portal-filters` + `rls`.
- Không UAT web/iOS (ngoài scope backend filters).
- Graph CRG stale relative to PR tip — verdict neo source + CI, không neo graph risk 1.00.

## Verdict

**PASS with known gap** — G-R1/G-N1/G-E1 runtime + authz deny + privacy (q UUID-only, export list không leak object key) + CI (backend, portal-filters, rls) xanh trên exact SHA `569e25eaeab07b88a52041d84813545e2eae7265`. Gap: OpenAPI list exports mô tả array thay vì CursorPage — follow-up docs/codegen, không FAIL AC.

Coordinator: được merge khi đã ủy quyền integration (CI đã xanh). Project `Hoàn thành` sau merge + integrated evidence theo `github-project-tracking.mdc`. Không đánh Hoàn thành Epic #406 chỉ vì Task này.
