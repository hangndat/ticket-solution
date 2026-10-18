# DoD review — PR #462 / Issue #432 (GET `/platform/tenants` H-P1)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca Dispatch `ctx_6457347ae4c3` · Task `task_b44fda135f35` · Role `reviewer-dod` · Agent Cursor · terminal `term_067059bb-b2a1-4a15-86b3-e823da6f6d50` (≠ implementer wt `portal-backend-platform-432`) |
| Scope | Issue #432 · PR #462 · BE (`apps/api`, `packages/backend`) · H-P1 platform tenant list |
| Commit SHA | `6c6779c97ce95a3d6c8cb620e3632bc8000bacdb` |
| Architecture impact | Không (endpoint list; vẫn kiểm authz deny-by-default) |
| Verdict | **PASS** |

## Checklist

| Gate | Kết quả | Evidence |
| --- | --- | --- |
| Exact SHA khớp tip PR | PASS | `git rev-parse` = `6c6779c97ce95a3d6c8cb620e3632bc8000bacdb` = `headRefOid` PR #462 |
| CI tip xanh | PASS | `backend`, `database-isolation (… platform.test.cjs …)`, `ci`, `changes` = SUCCESS trên SHA trên ([run 39142851475](https://github.com/hangndat/ticket-solution/actions/runs/39142851475)) |
| Authz deny-by-default non-operator | PASS | `listPlatformTenants` → `withPlatformRole` + `requireActivePlatformOperator`; stranger → `PLATFORM_OPERATOR_REQUIRED` (test H-P1) |
| Platform MFA audience (không attendee OIDC) | PASS | Controller/service dùng `platformActor`; unit test `listTenants keeps platform MFA verifier` assert `used === 'platform'` + `MFA_REQUIRED` |
| OpenAPI khớp H-P1 / contract | PASS | `GET /v1/platform/tenants` + `PortalPlatformTenantSummaryDto` fields `tenantId,slug,name,status,version,createdAt` khớp `PortalPlatformTenantSummary` + handoff H-P1 |
| Projection không lộ cross-tenant sâu | PASS | List chỉ metadata tenant; không members/limits/usage/PII ngoài slug/name/status; intentional platform-wide cho operator |
| Tests platform | PASS | `packages/backend/test/platform.test.cjs` cursor pagination + deny + invalid cursor; `apps/api/test/platform-self-actor.test.cjs` MFA path; CI xanh trên SHA |
| Ownership paths only | PASS | Diff 7 files trong `apps/api` + `packages/backend` (+ export `listPlatformTenants`) |

## Findings

### Blocker
Không có.

### Should-fix
Không có.

### Nit (không chặn PASS)
1. OpenAPI `createdAt` thiếu `format: date-time` (runtime ISO string ổn; đồng bộ schema sau nếu muốn chặt contract).
2. Worktree review này không có `node_modules` — không chạy lại Docker isolation local; dựa CI exact-SHA (đủ cho DoD khi tip xanh).

## Checks đã chạy / xác minh trên SHA

```text
git rev-parse HEAD
# 6c6779c97ce95a3d6c8cb620e3632bc8000bacdb

gh pr view 462 / gh pr checks 462
# backend SUCCESS; database-isolation (platform.test.cjs …) SUCCESS; ci SUCCESS

# Local attempt (limitation):
cd packages/backend && node --test test/platform.test.cjs
# MODULE_NOT_FOUND: pg (no node_modules in this review worktree)
```

Review source: diff `main...6c6779c`, `listPlatformTenants` / `PlatformController.listTenants`, OpenAPI schemas, CI rollup tip.

## Limitations

- Không merge / deploy (ngoài phạm vi reviewer).
- Không re-run DB isolation local; evidence CI trên exact SHA.
- Security-sensitive authz đã kiểm trong checklist DoD; không thay gate `reviewer-security` riêng nếu coordinator spawn thêm.

## Verdict

**PASS** — H-P1 `GET /v1/platform/tenants` đúng SHA, CI xanh, deny-by-default non-operator, MFA platform audience, OpenAPI/contract khớp, tests đủ. Coordinator có thể merge sau khi được ủy quyền integration.
