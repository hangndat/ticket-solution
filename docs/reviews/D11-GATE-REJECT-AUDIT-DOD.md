# DoD + Security review — PR #251 / Issue #244 (O14 gate.reject audit)

| Field | Value |
| --- | --- |
| Reviewer | Cursor · Role `reviewer-dod` + `reviewer-security` (`docs/agents/roles/reviewer-dod.md`, `docs/agents/roles/reviewer-security.md`) · Orca terminal `term_c152b434-c304-4a24-bcda-81c0e27bff83` · task `task_bf87e7735e57` · dispatch `ctx_fbd1fd989b71` · run `run_1246840dce98` — **≠** implementer (`ctx_d1d9de11c0fe`) |
| Scope | PR [#251](https://github.com/hangndat/ticket-solution/pull/251) → `main`; Issue [#244](https://github.com/hangndat/ticket-solution/issues/244) (Epic #222 · O14). Ownership: `packages/backend` + `apps/api` Gate unwrap. Architecture impact: **Không** |
| Commit SHA | **`a30288088f0495bf2a793aeb0f18768aacf14a63`** (`git rev-parse HEAD` == PR tip == CI `head_sha`) |
| Checks | See below |
| Verdict DoD | **PASS with known gap** |
| Verdict security | **PASS** |

## Checks (on exact SHA)

| Check | Result | Evidence |
| --- | --- | --- |
| Worktree SHA | **PASS** | `a30288088f0495bf2a793aeb0f18768aacf14a63` |
| CI aggregate | **PASS** | Actions run [`39060001458`](https://github.com/hangndat/ticket-solution/actions/runs/39060001458) · `head_sha` = tip · `ci` SUCCESS |
| Backend lint/typecheck/test/build | **PASS** | Job `backend`: `turbo run lint typecheck test build --filter=@ticket/api... --filter=@ticket/worker...` SUCCESS (includes OpenAPI drift) |
| DB isolation — reporting | **PASS** | Shard `membership-report` (`test/reporting.test.cjs`) SUCCESS — covers online deny → `rejectByReason` |
| DB isolation — gate | **PASS** | Shard `issue-gate` (`test/gate.test.cjs`) SUCCESS — unwrap / outcome paths |
| DB isolation — event-lifecycle | **PASS** | Shard `approval-config-lifecycle` includes `test/event-lifecycle.test.cjs` SUCCESS |
| Offline apply isolation in CI | **GAP** | `packages/backend/test/offline-sync-apply.test.cjs` **không** nằm trong matrix `database-isolation` (`ci.yml`) — xem Known gaps |
| Local lint/DB re-run | **Không** | Worktree thiếu `node_modules`/`dist`; dựa CI xanh trên exact SHA |
| PII in audit path | **PASS** | `recordGateReject` / `writeAudit` chỉ ghi UUID + `action` + reason = Gate error **code** (không email/name/phone) |

## Checklist vs AC

| # | Criterion | Result | Notes |
| --- | --- | --- | --- |
| 1 | Online reserve/confirm deny → `recordGateReject` / `gate.reject` | **PASS** | `denyGate` trên mọi business deny của `reserveCheckin` / `confirmCheckin` (ticket not found/active, already checked-in, held-by-other, reservation expired/not found, token mismatch). API `GateService` **unwrap sau** `withTenant` để audit commit trước khi map `GateError` |
| 2 | Offline REJECTED/CONFLICT idempotent theo `clientEventId` | **PASS (code + test source)** / **GAP (CI)** | `applyOfflineSyncBatch` gọi `recordGateReject(..., resourceType: 'offline_client_event', resourceId: clientEventId, idempotent: true)`. Test assert replay không inflate count — file chưa chạy trên CI matrix |
| 3 | `rejectByReason` phản ánh online rejects; tests isolation | **PASS** | `reporting.test.cjs`: sau confirm, reserve deny `TICKET_NOT_ACTIVE` → `rejectByReason` = `{ TICKET_NOT_ACTIVE: 1 }` (không còn manual `recordGateReject` fixture) |
| 4 | CI xanh exact SHA; không PII leak | **PASS** | Run `39060001458`; audit columns không chứa PII attendee |
| 5 | Lint sạch | **PASS** | CI backend turbo lint SUCCESS trên tip |

## Security (Gate audit path)

Abuse / invariants đã xét trong scope:

1. **Tenant isolation** — audit SQL parameterized + `tenant_id` / `event_id` trong WHERE và INSERT; offline idempotent lookup cùng tenant/event.
2. **Authz** — `requireTenantPermission` / session / event-open vẫn **throw** (không ghi `gate.reject`) — đúng: không đếm authz fail như scan reject.
3. **Idempotency / replay** — offline dùng `clientEventId` (UUID đã validate) làm `resource_id` + `idempotent` SELECT-before-insert; online deny **không** idempotent (mỗi lần deny = 1 count) — intentional cho O14.
4. **Injection** — `$queryRaw` / `$executeRaw` parameterized; reason = enum code từ server.
5. **Transaction / rollback** — outcome pattern + unwrap ngoài `withTenant` là điểm then-chốt: throw bên trong `withTenant` sẽ rollback audit (đã sửa).
6. **Secrets / PII** — không thêm log token; audit reason không phải payload client tự do ngoài code đã map.

**Fix trước merge (security):** không.

**Hardening (không chặn):** `confirmCheckin` vẫn có thể `throw` từ `lockTicket` (TICKET_NOT_FOUND) nếu ticket biến mất giữa peek và lock — edge hiếm, chưa wrap `denyGate`.

## Findings

- **Blocker:** không.
- **Should-fix (không chặn O14 AC online):** thêm `test/offline-sync-apply.test.cjs` vào matrix `database-isolation` trong `.github/workflows/ci.yml` để CI thực thi idempotent offline audit (hiện chỉ unit/offline-sync-unit + source review).
- **Nit:** các throw invariant khi refresh/insert reservation (`RESERVATION_NOT_FOUND` “disappeared”) vẫn throw — hợp lý, không phải scan deny.

## Known gaps

1. **`offline-sync-apply.test.cjs` ngoài CI matrix** — evidence offline idempotent = code review + test source trên SHA tip; **không** có dòng pass isolation trong Actions run `39060001458`. Gap có chủ đích ghi nhận; AC Issue #244 nhấn online → `rejectByReason` (đã CI). Coordinator có thể merge O14 rồi mở follow-up CI shard, hoặc chèn file vào matrix trước merge.
2. **Reviewer không re-run DB isolation local** — tin CI trên exact SHA (thiếu `node_modules` trong worktree reviewer).

## Verdict

**DoD: PASS with known gap** · **Security: PASS** trên exact SHA `a30288088f0495bf2a793aeb0f18768aacf14a63`.

An toàn để coordinator merge PR #251 sau khi chấp nhận gap CI matrix cho offline-apply (hoặc vá matrix trước). Revalidate nếu tip có commit **hành vi** mới sau SHA này.

Không merge từ session reviewer này.

---

## Draft comment Issue #244 (coordinator post — worker không `gh`)

```text
## DoD + Security (O14 / PR #251)

- Reviewer: Cursor · `reviewer-dod` + `reviewer-security` · dispatch `ctx_fbd1fd989b71` ≠ implementer `ctx_d1d9de11c0fe`
- Exact SHA: `a30288088f0495bf2a793aeb0f18768aacf14a63`
- CI: https://github.com/hangndat/ticket-solution/actions/runs/39060001458 (SUCCESS)
- Artifact: `docs/reviews/D11-GATE-REJECT-AUDIT-DOD.md`
- Verdict: **PASS with known gap** (DoD) · **PASS** (security)
- Gap: `offline-sync-apply.test.cjs` chưa nằm trong matrix database-isolation — offline idempotent đã có code+test source, chưa chạy trên CI tip
```
