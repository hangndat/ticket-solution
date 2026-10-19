# DoD revalidation — PR #526 self-serve tenant PENDING (P2-ONBOARD-PENDING)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca Cursor `reviewer-dod` · terminal `term_fc912819-7f98-4f8b-afdc-1d6a01c52be3` · task `task_dfddfbc2de5f` · dispatch `ctx_9ee3bb4be30a` · Run `run_d04055a8969b` · **≠** implementer / prior DoD FAIL session |
| Scope | PR [#526](https://github.com/hangndat/ticket-solution/pull/526) · Issue [#520](https://github.com/hangndat/ticket-solution/issues/520) · Story #493 · Epic #491 · backend ownership (`apps/api`, `packages/backend`, OpenAPI, migration) |
| Commit SHA | **`01a66d0b15e6367b2a26987ec06b99cbb573c051`** (PR tip; revalidation after catalog + SEC-526-1 fix) |
| Prior FAIL SHA | `a42df3aec0c62222f05235f8babf8f7dc7459a30` — blocker: `tenant_registrations` thiếu trong `DEFINER_OWNER_TABLES` → CI `database-isolation (rls / rls-catalog)` đỏ |
| Architecture impact | **Có** — `POST /v1/public/tenant-registrations` → tenant `PENDING` (P2-ONBOARD-PENDING / ADR §8); Operator ACTIVE reuse `setTenantStatus` |
| Decision IDs | **P2-ONBOARD-PENDING** · ADR §8 |
| Checks | Xem bảng dưới |
| Verdict | **PASS** |
| Merge | **Không** — reviewer không merge; còn gate `reviewer-security` revalidation trên cùng SHA |

## Tóm tắt nghiệm thu (VI)

Revalidation exact SHA `01a66d0b15e6367b2a26987ec06b99cbb573c051`: catalog `DEFINER_OWNER_TABLES` đã gồm `tenant_registrations`; CI `database-isolation (rls / rls-catalog)` và backend/ci **SUCCESS** trên tip (run `39191396065`). Prior AC PENDING (create PENDING + Owner, không auto-ACTIVE, email verified, idempotency/rate/audit, Operator `setTenantStatus`, `TENANT_PENDING` trên admin mutations, OpenAPI) vẫn khớp. Advisory lock SEC-526-1 có trong `register_pending_tenant` + concurrent race test. Không merge từ reviewer; chờ security reval độc lập.

## Checks (exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse` / PR `headRefOid` | `01a66d0b15e6367b2a26987ec06b99cbb573c051` |
| Diff scope vs base feature | Backend-only: `apps/api`, `packages/backend`, `packages/contracts`, OpenAPI, migration `202610190003_p2_onboard_pending_registration` |
| Catalog allow-list | `tenant_registrations` ∈ `DEFINER_OWNER_TABLES` (`packages/backend/test/rls-catalog.test.cjs`) — đóng blocker prior FAIL |
| CI [39191396065](https://github.com/hangndat/ticket-solution/actions/runs/39191396065) `headSha` = tip | **SUCCESS** — `backend`, `database-isolation (rls, test/rls.test.cjs test/rls-catalog.test.cjs)`, mọi shard isolation khác, `ci`, `turbo-persist` |
| Local `rls-catalog` / `tenant-registration` | **Không hoàn tất** trong worktree reviewer (thiếu deps / test Docker treo timeout) — dựa CI isolation trên cùng SHA (cùng pattern review #204) |
| Graph / source | CRG build tại SHA tip; đọc migration + `registerPendingTenant` + `assertTenantAllowsIssue` + OpenAPI path |
| OpenAPI | `POST /v1/public/tenant-registrations` documented |

## Revalidation — prior FAIL blocker

| Finding (FAIL trên `a42df3ae…`) | Trạng thái trên `01a66d0b…` |
| --- | --- |
| `unexpected owner policy on tenant_registrations` — thiếu `DEFINER_OWNER_TABLES` | **FIXED** — entry + comment P2-ONBOARD trong `rls-catalog.test.cjs` |
| CI `database-isolation (rls / rls-catalog)` đỏ | **FIXED** — job SUCCESS trên run 39191396065 |

## Acceptance mapping (Issue #520 / prior AC PENDING)

| AC | Verdict | Evidence trên SHA |
| --- | --- | --- |
| Authenticated `POST` tạo tenant **PENDING** + Owner; **không** auto-ACTIVE | **PASS** | SQL `INSERT … status 'PENDING'`; TS response `status: 'PENDING'`; rejects non-PENDING out row |
| Email verified bắt buộc | **PASS** | `registerPendingTenant` rejects `!emailVerified`; isolation test unverified |
| Idempotency-Key + conflict / rate / max PENDING | **PASS** | `requireIdempotencyKey`; SQL idempotency + counts; tests conflict/rate; **SEC-526-1** `pg_advisory_xact_lock(872350, hashtext(actor))` + concurrent race (exactly 1 win) |
| Audit `public.tenant.registration`; response không secrets | **PASS** | `platform_audit_logs.action`; response chỉ `registrationId/tenantId/status` |
| Operator ACTIVE via `setTenantStatus`; PENDING chặn admin (`TENANT_PENDING`) | **PASS** | `assertTenantAllowsIssue` / `assertTenantAllowsAdminMutation`; test `createEvent` → `TENANT_PENDING` rồi ACTIVE → createEvent OK |
| OpenAPI path | **PASS** | `/v1/public/tenant-registrations` in `openapi.json` + Nest controller |
| CI isolation xanh exact SHA | **PASS** | Run 39191396065 |

## Findings / limitations

| Mức | Item | Ghi chú |
| --- | --- | --- |
| — | Không blocker DoD mới trên tip | Catalog + CI + AC PENDING đóng |
| Known gap (ngoài must-fix wave này) | **SEC-526-2** (Low): `updateTenantBranding` không check tenant status — PENDING Owner vẫn ghi branding | Đã ghi ở security FAIL trước; **không** nuốt DoD PASS của AC PENDING; security reval quyết định riêng |
| Gate còn lại trước merge | `reviewer-security` revalidation trên **cùng** exact SHA `01a66d0b…` | Bắt buộc theo #520; DoD ≠ security |

## Verdict

**PASS** — DoD revalidation trên exact SHA `01a66d0b15e6367b2a26987ec06b99cbb573c051`.

Reviewer **không** merge; **không** set Project `Hoàn thành`. Coordinator: spawn/settle security reval → merge khi đủ DoD + security + CI.
