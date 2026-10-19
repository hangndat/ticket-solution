# DoD review — PR #526 / Issue #520 (revalidation sau merge main)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor `reviewer-dod` · `term_ec951144-1a07-4df6-9937-fc73483b1bc6` · dispatch `ctx_b5caaa4e6e5d` · task `task_7969b9581b1a` (≠ implementer) |
| Role | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` |
| Scope | Issue [#520](https://github.com/hangndat/ticket-solution/issues/520) · PR [#526](https://github.com/hangndat/ticket-solution/pull/526) · ownership BE (`apps/api`, `packages/backend`, contracts/OpenAPI) |
| Exact SHA | `eff5f90d274840a2460a02ca3a4f90371a70f229` |
| Prior SHA (không kế thừa) | PASS DoD trên `01a66d0b15e6367b2a26987ec06b99cbb573c051` — **revalidation bắt buộc** sau merge `origin/main` |
| Architecture impact | Có — `POST /v1/public/tenant-registrations` → tenant `PENDING` (P2-ONBOARD-PENDING / ADR §8) |
| Decision IDs | P2-ONBOARD-PENDING · SEC-526-1 (advisory lock) |
| Verdict | **PASS** |
| Merge từ reviewer | **Không** |

## Revalidation checklist (spec)

| Gate | Kết quả | Evidence |
| --- | --- | --- |
| MERGEABLE | **PASS** | `mergeable=MERGEABLE`, `mergeStateStatus=CLEAN` |
| CI isolation xanh trên tip | **PASS** | Actions run [39196344260](https://github.com/hangndat/ticket-solution/actions/runs/39196344260) · `headSha=eff5f90d274840a2460a02ca3a4f90371a70f229` · `database-isolation (rls, … rls-catalog)` **SUCCESS** + toàn bộ isolation matrix SUCCESS · `ci` SUCCESS |
| Catalog `tenant_registrations` | **PASS** | `DEFINER_OWNER_TABLES` + required tables list trong `packages/backend/test/rls-catalog.test.cjs` (giữ cả `role_presets` sau conflict resolve) |
| Advisory lock SEC-526-1 | **PASS** | Migration `202610190003_…/migration.sql` L92–94: `pg_advisory_xact_lock(872350, hashtext(p_actor_user_id::text))` **trước** rate / max-PENDING counts; concurrent race test trong `tenant-registration.test.cjs` |
| AC prior (PENDING) | **PASS** | Xem bảng AC bên dưới — đối chiếu source trên exact SHA |

## AC / correctness (đối chiếu source trên exact SHA)

| AC | Verdict | Notes |
| --- | --- | --- |
| `POST /v1/public/tenant-registrations` → status `PENDING` + Owner; không auto-ACTIVE | PASS | SQL `register_pending_tenant` + API DTO `status: 'PENDING'`; response asserts `out_status === 'PENDING'` |
| Email verified bắt buộc; Bearer auth | PASS | Service `actor()` requires Bearer; unverified → `INVALID_INPUT` (test) |
| Idempotency-key + rate / max PENDING | PASS | Unique `(actor_user_id, client_key)`; rate + pending-owned counts sau advisory lock |
| Không trả secrets / invite raw | PASS | Response shape không có `rawInviteToken` / `ownerInviteId` (test) |
| Audit + FORCE RLS trên `tenant_registrations` | PASS | Migration ENABLE+FORCE RLS + owner policy; catalog allow-list |
| Operator ACTIVE via `setTenantStatus` | PASS | Test activate path; PENDING blocks `createEvent` → `TENANT_PENDING` |
| OpenAPI documented | PASS | `apps/api/openapi.json` path `/v1/public/tenant-registrations` |
| Merge main không phá must-keep | PASS | Tip `eff5f90` = merge main; `package.json` `test:db` giữ cả `tenant-registration.test.cjs` + `role-presets.test.cjs` |

## Checks chạy / dùng trên SHA

1. **CI (primary):** run `39196344260` trên `eff5f90d274840a2460a02ca3a4f90371a70f229` — SUCCESS (isolation + backend + portal + ci).
2. **Source review:** migration advisory lock + catalog allow-list + `tenant-policy` PENDING + API/OpenAPI wiring.
3. **Local isolation:** không chạy được trong worktree review (`MODULE_NOT_FOUND: pg` / deps chưa cài) — **limitation**; dựa CI isolation trên exact SHA + source.

## Findings

- **Blocker:** không.
- **Should-fix:** không (trong scope DoD must-keep).
- **Known gap (không blocker merge DoD này):** SEC-526-2 Low — `updateTenantBranding` chưa freeze status PENDING (đã ghi ở security review trước; ngoài must-fix catalog/lock).
- **Coordinator follow-up:** Issue #520 yêu cầu `reviewer-security` trên tip mới — security PASS trước đó là `01a66d0…`; **không kế thừa** cho `eff5f90…`. DoD PASS ≠ security PASS trên SHA này.

## Limitations

- Graph MCP `detect_changes` stale (built_at khác HEAD worktree) — review dựa source + CI exact-SHA.
- Không merge; không đổi Project Status sang Hoàn thành (coordinator).

## History (không kế thừa verdict)

| SHA | DoD | Notes |
| --- | --- | --- |
| `a42df3ae…` | FAIL | thiếu `tenant_registrations` trong `DEFINER_OWNER_TABLES` |
| `01a66d0b…` | PASS | catalog + advisory lock; CI `39191396065` |
| `eff5f90d…` | **PASS** (this) | sau merge main; CI `39196344260`; must-keep còn nguyên |
