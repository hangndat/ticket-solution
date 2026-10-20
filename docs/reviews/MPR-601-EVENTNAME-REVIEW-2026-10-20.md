# DoD review — PR #604 / Issue #601 (TicketSummary.eventName)

| Trường | Giá trị |
| --- | --- |
| Reviewer | Orca worker · `task_ff9ee3af39d9` / `ctx_c3f28089f1df` — **khác** implementer Phuc |
| Issue | [#601](https://github.com/hangndat/ticket-solution/issues/601) — Thêm `eventName` vào `TicketSummary` / `GET /v1/me/tickets` |
| PR | [#604](https://github.com/hangndat/ticket-solution/pull/604) |
| Commit SHA | `fa732ddef66e1a4e97190c6dbd4a987c43b369d8` (`git rev-parse HEAD` on worktree `r-601-be-eventname-review`, branch `pr-604`) |
| Scope | `packages/contracts/src/index.ts`, `packages/backend/src/issue.ts`, `apps/api/src/tickets.ts`, `apps/api/test/me-tickets.test.cjs`, `apps/api/openapi.json`, `apps/api/package.json`, `pnpm-lock.yaml` |
| Verdict | **PASS** |

## Acceptance criteria

| # | Tiêu chí | Kết quả |
| --- | --- | --- |
| 1 | `TicketSummary.eventName` optional; có khi event tồn tại; thiếu nếu event xóa | **PASS** — contract + `mapOwnerTicketListRow` / `enrichOwnerTicketsWithEventNames` chỉ spread khi `name != null`; scoped path dùng `LEFT JOIN events`. |
| 2 | `GET /v1/me/tickets` (scoped + aggregate) trả `eventName` đúng | **PASS** — integration test mới assert scoped `?tenantId=` và aggregate không `tenantId`. |
| 3 | Không N+1 nghiêm trọng | **PASS** — scoped: một query `listTicketsForOwner` với `LEFT JOIN events`; aggregate: `enrichOwnerTicketsWithEventNames` batch `eventIds` distinct **theo tenant**, một `SELECT … ANY($eventIds)` mỗi tenant (không loop-per-ticket). |
| 4 | Test `me-tickets.test.cjs` xác nhận `eventName` | **PASS** — test Docker Postgres mới; 2/2 tests pass locally. |
| 5 | Không đổi mã lỗi/behavior endpoint (chỉ field optional) | **PASS** — mapping additive; auth/tenant validation test cũ giữ nguyên. |
| 6 | `pnpm --filter api test` xanh | **PASS** (local `me-tickets.test.cjs` sau build); CI `backend` + database-isolation shards xanh trên SHA. |
| 7 | Không breaking consumer `TicketSummary` | **PASS** — field optional; OpenAPI cập nhật; không đổi required array. |

## Implementation notes

- Production path dùng Prisma `tx.$queryRaw` tagged template (parameterized) trong `withTenant` / `withActor` — **không** bypass RLS bằng `pg` driver trong `apps/api/src`.
- `GET /v1/me/tickets/:ticketId` (`getMine`) **không** thêm `eventName` — ngoài AC Issue #601 (list-only).

## Checks (trên SHA)

```text
git rev-parse HEAD
→ fa732ddef66e1a4e97190c6dbd4a987c43b369d8

pnpm --filter @ticket/contracts build
→ exit 0

cd apps/api && pnpm build && node --test test/me-tickets.test.cjs
→ 2 pass, 0 fail (worktree r-601-be-eventname-review, Docker required for integration test)

./scripts/gh-dod-evidence.sh 604
→ head.sha=fa732ddef66e1a4e97190c6dbd4a987c43b369d8 state=open mergeable=true
→ ci success, turbo-persist success, backend/web/portal/mobile/changes success
→ database-isolation (all shards) success
```

## Findings

| Mức | Finding |
| --- | --- |
| Info | `pg` + `@types/pg` thêm vào `apps/api` **devDependencies** chỉ cho test spin Postgres container — hợp lý vì test gọi `Client` trực tiếp; `@ticket/backend` đã có `pg` runtime nhưng API test không reuse helper chung. |
| Info (non-blocker) | `startIsolatedPostgres` trong `me-tickets.test.cjs` trùng pattern với nhiều file `packages/backend/test/*.test.cjs` — có thể extract shared helper sau, không chặn merge. |
| Info | Test container: tên + `POSTGRES_PASSWORD` random (`randomBytes`), bind `127.0.0.1`, cleanup `docker rm -f` trong `finally` — không hardcode secret, không đụng DB prod. |

## Security

- RLS/tenant scope giữ nguyên: enrich aggregate chạy `withTenant` per distinct `tenantId`; chỉ `SELECT id, name FROM events`.
- Không quyền ghi/đọc mới ngoài tên sự kiện cho ticket owner đã có.

## Limitations

- Reviewer không merge/sửa code PR.
- Local full `pnpm --filter api test` chạy toàn bộ `test/*.test.cjs`; reviewer chỉ xác nhận `me-tickets.test.cjs` + contracts build (đủ theo task spec).

## Verdict

**PASS** — AC #601 đạt; CI xanh trên exact SHA. Sẵn sàng merge (coordinator).
