# DoD + Security review — PR #261 / Issue #255

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca worker Cursor · `reviewer-dod` + `reviewer-security` · `task_bafd64a2be14` / `ctx_0d4601e82dad` |
| Implementer (≠ reviewer) | `task_5fc3edb85224` / `ctx_c56b54d0285c` |
| Scope | Epic [#254](https://github.com/hangndat/ticket-solution/issues/254) · Issue [#255](https://github.com/hangndat/ticket-solution/issues/255) · PR [#261](https://github.com/hangndat/ticket-solution/pull/261) · ownership BE (`apps/api`, `packages/backend`, `packages/contracts`) + ADR/docs |
| Commit SHA | `0dafbe82894ed96c30b6db5f463c6086722a72e7` (verified `gh pr view 261 --json headRefOid`) |
| Architecture | Đối chiếu [ADR-19](../ops/ADR-19-EVENT-SERVER-SOURCE.md) + [event-server-source.md](../architecture/event-server-source.md) |
| Verdict | **PASS** |
| Security verdict | **PASS** |

## Checklist

| # | Tiêu chí | Kết quả |
| --- | --- | --- |
| 1 | Nest `GET /v1/public/tenants/{tenantSlug}/events` + `.../{eventSlug}` chỉ PUBLIC + published; draft/unknown → 404 | **PASS** — `PublishedEventsController` unauthenticated; service maps `null` → `NOT_FOUND` 404. Query bắt buộc `visibility=PUBLIC`, `content_status=PUBLISHED`, `business_status=ACTIVE`, join `event_config_versions` với `published_at IS NOT NULL` và `version = published_config_version`. |
| 2 | DTO khớp `@ticket/contracts` / OpenAPI; không admin fields | **PASS** — `PublishedEventSummary` / `Detail` / `ListResponse` mirror iOS `apps/mobile/src/published/types.ts`; Nest DTO implement contracts; projection không có `contentStatus` / `revision` / lifecycle (assert trong test). OpenAPI paths có trong `apps/api/openapi.json`. |
| 3 | D9 seed publish marketing idempotent | **PASS** — `ensurePublishedMarketingConfig` skip khi `published_config_version` đã set; test assert re-seed `configsPublished=0` / `configsSkipped≥1`. |
| 4 | Tests + CI trên tip SHA | **PASS** — CI run [39079091241](https://github.com/hangndat/ticket-solution/actions/runs/39079091241) trên tip: `backend`, `database-isolation/*`, `ci` = SUCCESS. Evidence implementer: `test/published-events.test.cjs` (seed list/detail + 404 draft/unknown) + `health.test.cjs` OpenAPI paths. Worktree reviewer thiếu `node_modules` → không re-run local; dựa CI + đọc source. |
| 5 | Security: không lộ draft/internal; fail-closed; RLS/tenant | **PASS** — xem mục Security bên dưới. |
| 6 | ADR-19 / architecture handoff | **PASS** — ship khớp quyết định: PG published SoT, Nest public routes, contracts thống nhất, D9 seed marketing sections, fail-closed 404. Non-goals web/iOS consumer rewrite đúng ngoài #255. |

## Security (public projection / authz / no admin leak)

**Threat / abuse cases đã xét**

1. **Enumeration draft / UNLISTED / cancelled** — SQL filter + 404 thống nhất; draft test xác nhận `draft-only` unpublished → `null`.
2. **Cross-tenant slug** — resolve tenant ACTIVE theo slug (`withPlatformRole`), rồi `withTenant(tenant.id)` + `e.tenant_id = tenant.id`; event slug chỉ trong tenant đã bind.
3. **Auth bypass / privilege** — route public cố ý không Bearer (deny-by-default chỉ áp dụng admin paths; mỗi controller tự `verifyBearerToken`). Không global guard mở nhầm admin.
4. **Admin field leak** — SELECT cột hẹp + mapper whitelist; brand chỉ `primaryColor`/`organizationName` (+ optional URL/contact từ type, không map `fixture`); test assert không có `contentStatus`/`revision`.
5. **Injection** — parameterized `$queryRaw`; slug regex fail-closed; tenant UUID validated trong `withTenant`.
6. **RLS** — event reads trong `withTenant` (`set_config('app.tenant_id', …, true)`); tenant lookup platform-scoped tách biệt.

**Không blocker.** Hardening (không chặn merge): cursor UUID invalid có thể 500 thay vì 404; OpenAPI đánh dấu `cursor`/`limit` `required: true` dù handler optional; thiếu test tường minh UNLISTED/cross-tenant/Nest HTTP (logic đã cover).

## Findings

| Mức | Finding |
| --- | --- |
| — | Không có blocker / should-fix trước merge. |
| Nit | OpenAPI optional query `cursor`/`limit` hiện `required: true` (Swagger Nest). |
| Nit | Chưa có case test riêng visibility=UNLISTED hoặc Nest HTTP e2e (DB layer + CI đủ cho AC #255). |

## Limitations / ngoài phạm vi

- Consumer web/iOS rewrite, deploy prod, CDN — theo ADR-19 / Epic plan, không thuộc Task #255.
- Reviewer không cài `node_modules` trong worktree; runtime evidence = CI tip + source review.

## Checks (trên SHA)

```text
gh pr view 261 --json headRefOid
→ 0dafbe82894ed96c30b6db5f463c6086722a72e7

CI tip (actions/runs/39079091241): backend SUCCESS, database-isolation/* SUCCESS, ci SUCCESS
Source review: packages/backend/src/published-events.ts, apps/api/src/published-events.ts,
  packages/contracts/src/published-events.ts, packages/backend/src/demo-seed.ts,
  packages/backend/test/published-events.test.cjs, docs/ops/ADR-19-EVENT-SERVER-SOURCE.md
```

## Verdict

**PASS** (DoD) · **PASS** (security) trên exact SHA `0dafbe82894ed96c30b6db5f463c6086722a72e7`.

Coordinator có thể merge sau khi đủ quyền integration; Project `Hoàn thành` chỉ sau merge + CI trên integrated commit theo DoD.
