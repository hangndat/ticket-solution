# D11 — DoD review PR #251 Backend gate.reject O14 (#244)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_8ffd18c8-4fd8-446d-8b9a-78185eace3bf` · Task `task_5abcaf00df7e` · Dispatch `ctx_078fa1995be0` · **≠** implementer PR #251 |
| Scope | PR [#251](https://github.com/hangndat/ticket-solution/pull/251) · Issue [#244](https://github.com/hangndat/ticket-solution/issues/244) · Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) · ownership **backend** (`packages/backend/**`, `apps/api/src/gate.ts`) |
| Commit SHA | `a30288088f0495bf2a793aeb0f18768aacf14a63` (exact tip; pin `gh api …/pulls/251 --jq .head.sha`) |
| Architecture impact | **Có** (theo Task Spec) — đối chiếu O14 item 4 + known gap DoD `#241` / PR #242. Drift lớn: **không** (không cần spawn `architect` riêng) |

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| Tip SHA | `a30288088f0495bf2a793aeb0f18768aacf14a63` (= commit 2: unused-binding fix trên `5c27cf232fe616d4f027cc01404f4512bb6c052b`) |
| Diff vs `main` | 8 files, chỉ BE: `packages/backend/src/{gate,offline-sync,index}.ts`, `packages/backend/test/{gate,reporting,offline-sync-apply,event-lifecycle}.test.cjs`, `apps/api/src/gate.ts` — **không** đụng web/iOS |
| CI trên SHA | Run [39060001458](https://github.com/hangndat/ticket-solution/actions/runs/39060001458) **success** · `headSha` khớp tip · `backend` PASS · `database-isolation (issue-gate … gate.test.cjs)` PASS · `database-isolation (membership-report … reporting.test.cjs)` PASS · `ci` PASS |
| Secret scan (diff) | Không thấy secret / `.env` / credential thật |
| Graph `detect_changes` | Graph stale (build ≠ tip); verdict dựa **source + diff tại exact SHA** |

## Đối chiếu O14 / AC #244 / known gap #241

| Yêu cầu | Evidence trên SHA |
| --- | --- |
| Online deny → `audit_logs.action = gate.reject` | `denyGate` gọi `recordGateReject` rồi trả `GateDenyOutcome` (không throw trong tx). `reserveCheckin` / `confirmCheckin` business deny paths dùng `denyGate` (TICKET_*, ALREADY_CHECKED_IN, HELD_BY_OTHER_SESSION, RESERVATION_*, TOKEN_MISMATCH, …) |
| Commit audit trước HTTP map | API `apps/api/src/gate.ts` `unwrapReserveOutcome` / `unwrapConfirmOutcome` **sau** `withTenant` — tx commit khi return `ok: false`, rồi mới throw `GateError` |
| `rejectByReason` không undercount online | `reporting.test.cjs`: online `reserveCheckin` deny sau USED → `ok:false` + `TICKET_NOT_ACTIVE`; `readEventReport.rejectByReason` = `{ TICKET_NOT_ACTIVE: 1 }` (bỏ fixture `recordGateReject` thủ công) |
| Offline CONFLICT/REJECTED idempotent | `recordGateReject(..., idempotent: true)` với `resourceType: offline_client_event`, `resourceId: clientEventId`; `offline-sync-apply.test.cjs` assert count không phình khi replay REJECTED / CONFLICT |
| Isolation tests | `gate.test.cjs` + `reporting.test.cjs` + `offline-sync-apply.test.cjs` (+ lifecycle adapt unwrap); CI isolation matrix xanh |
| Không web/iOS; không schema theo cổng | Diff ownership BE only; #244 / O14 giữ “theo cổng” = Wave sau (đã chấp nhận từ O12 DoD) |

## Findings

### Blocker

Không có.

### Should-fix

Không có (AC #244 / O14 item 4 đủ).

### Nit

1. Trong `reserveCheckin`, hai nhánh nội bộ `RESERVATION_NOT_FOUND` (refresh hold / insert thất bại) vẫn `throw GateError` — race/infrastructure, không phải deny scan thường; không undercount KPI day-of.
2. `confirmCheckin` vẫn gọi `lockTicket` có thể throw `TICKET_NOT_FOUND` sau khi peek reservation (vé biến mất giữa chừng) — hiếm; không bắt buộc cho #244.
3. Authz / session / event-closed (`requireTenantPermission`, `assertSessionActive`, `assertOpenForGate`) vẫn throw — đúng: không phải reject vé cho EventReport.

## Architecture (đối chiếu O14 / #241)

- Đóng known gap DoD PR #242: online Gate deny không còn undercount `rejectByReason`.
- Pattern outcome + unwrap ngoài `withTenant` khớp boundary transaction (audit phải commit).
- Export `ReserveOutcome` / `ConfirmOutcome` / unwrap — surface nội bộ BE + API unwrap; không đổi OpenAPI EventReport; không migration.
- Breakdown theo cổng vẫn **ngoài phạm vi** #244 (Wave sau) — không phải regression của PR này.
- Không design drift đáng kể so với O14 → **không** đề xuất Architect blocker.

## Limitations / revalidation

- Verdict chỉ pin SHA `a30288088f0495bf2a793aeb0f18768aacf14a63`. Commit hành vi mới → bắt buộc DoD lại.
- Reviewer **không** merge; coordinator quyết định merge sau DoD + CI (đã xanh trên tip).

## Verdict

**PASS** — đủ DoD cho #244 / O14 BE reject-audit trên exact SHA; known gap online undercount từ #241 đã đóng; CI isolation + backend xanh; không web/iOS.
