# DoD review — PR #377 O02 MeEvents (`staffEligible`) · #369

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Role `reviewer-dod` · Agent cursor · terminal `term_cebb7161-da1c-430a-b51a-386be9112824` · Task `task_bcb4af562b39` · Dispatch `ctx_1d05397a3587` · **≠** implementer `ctx_467e2c58fb67` |
| Scope | Issue [#369](https://github.com/hangndat/ticket-solution/issues/369) · PR [#377](https://github.com/hangndat/ticket-solution/pull/377) · `apps/api`, `packages/backend`, `packages/contracts` · parent Epic #293 / handoff #368 · **không** `apps/web` / `apps/mobile` |
| Commit SHA | `3856824bc687b7085bdf90671ac766c8f6020402` (PR tip verified) |
| Architecture impact | Có — đối chiếu `docs/design/o02-permission-nav/` (README + contract + be-handoff) |
| Verdict | **FAIL** |

## Checks (exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse` / PR tip | `3856824bc687b7085bdf90671ac766c8f6020402` |
| Diff ownership | Commit tip chỉ 8 file BE/contracts/OpenAPI/tests — **không** `apps/web` \| `apps/mobile` |
| CI run [39117322234](https://github.com/hangndat/ticket-solution/actions/runs/39117322234) `head_sha` tip | **failure** (aggregate `ci`) |
| CI `backend` | success |
| CI `database-isolation (account-deletion, … platform.test.cjs …)` | success (gồm O02 MeEvents platform test) |
| CI `database-isolation (rls, rls.test.cjs + rls-catalog.test.cjs)` | **fail** — `AssertionError: unexpected owner policy on event_assignments` |
| Local re-run platform/health trên worktree này | Không bắt buộc khi CI platform isolation đã xanh trên SHA; RLS catalog fail đã xác nhận từ job log |

## Checklist DoD

| # | Criterion | Kết quả |
| --- | --- | --- |
| 1 | Khớp handoff MeEvents — **không** mở rộng `GET /v1/me` / `MeResponse` | **PASS** — `GET me/events` + `MeEventsDto`; contracts additive `tenantId` + `staffEligible` only |
| 2 | Deny-by-default `staffEligible`; không weaken `requireTenantPermission` | **PASS** — attendee → `false` + `items: []` trong test; không đụng `membership.ts` / `role-map`; SQL filter active membership/assignment |
| 3 | Tests matrix contract §8 (attendee / Scanner+gate.confirm / Owner 0 assign / revoke) | **PASS** (logic) — `platform.test.cjs` O02 case; CI account-deletion isolation xanh |
| 4 | OpenAPI + health path allowlist `/v1/me/events` | **PASS** |
| 5 | Migration RLS OK (FORCE RLS + catalog) | **FAIL** — thêm `event_assignments_owner` (TO `migration_owner` USING/CHECK true) nhưng **không** cập nhật `DEFINER_OWNER_TABLES` trong `packages/backend/test/rls-catalog.test.cjs` → CI RLS đỏ |
| 6 | Ownership slice BE-only | **PASS** |

## Findings

### Blocker

1. **RLS catalog allowlist thiếu `event_assignments`.** Migration `202610180006_d12_o02_me_events` tạo policy owner đúng pattern SECURITY DEFINER (cần cho `list_my_events` / `accept_membership_invite` trên FORCE RLS), nhưng `rls-catalog.test.cjs` `DEFINER_OWNER_TABLES` chưa include `'event_assignments'`. Evidence CI: job `database-isolation (rls…)` run `39117322234` → `unexpected owner policy on event_assignments`.  
   **Fix kỳ vọng:** thêm `'event_assignments'` vào `DEFINER_OWNER_TABLES` (cùng ghi chú O02 / definer) rồi re-run CI trên SHA mới → **revalidation DoD bắt buộc**.

### Nit (không đủ để PASS khi blocker còn)

- Nhánh `OR EXISTS (event_assignments…)` trong `my_staff_eligible()` thực tế luôn kèm membership active (join) — dư thừa semantics nhưng không làm weaken deny-by-default.
- Chưa có HTTP assert 401 riêng cho Nest `GET /v1/me/events` (chỉ helper `listMyEvents`); cùng pattern `selfActor` với `/me/tenants` — acceptable sau khi CI xanh.

## Architecture / handoff

- Quyết định A (MeEvents) được triển khai đúng; probe `/v1/me` giữ identity-only.
- `staffEligible` server-computed; `items[].permissions` từ assignment SoT; revoke fail-closed covered by tests.
- Không cần Architect blocker riêng ngoài việc catalog/RLS gate đỏ.

## Limitations

- Reviewer không merge / không sửa code (review-only).
- Verdict **FAIL** cho đến khi RLS catalog + CI isolation xanh trên exact SHA tip mới.

## Verdict

**FAIL** — implementation khớp o02 handoff và matrix discovery, nhưng gate “migration RLS OK” / CI `database-isolation (rls)` đỏ vì thiếu allowlist `event_assignments` trong `rls-catalog.test.cjs`.
