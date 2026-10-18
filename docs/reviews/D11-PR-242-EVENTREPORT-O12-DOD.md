# D11 — DoD review PR #242 EventReport O12 (#241)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS with known gap** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_5bb509d7-8807-4825-9ceb-83d83a2b3394` · Task `task_3b4b3c1c5066` · Dispatch `ctx_a088f1fe1e8d` · **≠** implementer `ctx_ff2e40c92499` |
| Scope | PR [#242](https://github.com/hangndat/ticket-solution/pull/242) · Issue [#241](https://github.com/hangndat/ticket-solution/issues/241) · Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) · ownership **backend** (`packages/backend/**`, `apps/api/**`) |
| Commit SHA | `4f6530bfb3d81a514493c7f1385896757e2e9428` (exact; = PR tip / CI `headSha`) |
| Architecture impact | **Có** — đối chiếu `docs/DECISION-LOG.md` § O12 + contract `EventReport`. Drift lớn: **không** (không cần spawn `architect` riêng) |

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| `git cat-file -t` / PR commits | SHA `4f6530bfb3d81a514493c7f1385896757e2e9428` tồn tại; 1 commit tip PR |
| Diff vs `main` | 7 files, chỉ BE: `packages/backend/src/{reporting,gate,offline-sync,index}.ts`, `packages/backend/test/reporting.test.cjs`, `apps/api/src/reporting.ts`, `apps/api/openapi.json` — **không** đụng web/iOS |
| CI trên SHA | Run [39055934295](https://github.com/hangndat/ticket-solution/actions/runs/39055934295) **success** · `headSha` khớp tip · `backend` PASS · `database-isolation (membership-report, … reporting.test.cjs)` PASS · các isolation matrix khác PASS · `ci` PASS |
| Secret scan (diff) | Không thấy secret / `.env` / credential thật |
| Graph `detect_changes` trên worktree hiện tại | Không dùng cho verdict (branch local ≠ PR tip; graph stale). Review dựa **source + diff tại exact SHA** |

## Đối chiếu O12 / AC #241

| Yêu cầu | Evidence trên SHA |
| --- | --- |
| `checkInSuccessCount` = Gate confirm APPLIED (không chỉ `USED`) | Đếm `checkins` với `undone_at IS NULL`; test confirm → 1, undo Supervisor → 0 trong khi `ticketsByState.USED` tách biệt |
| `rejectByReason` (+gate nếu có) | Aggregate `audit_logs` action `gate.reject` theo `reason`; **không** có schema theo cổng (xem known gap) |
| `quotaRemaining` / `quotaCapacityState` | `FINITE` / `UNLIMITED` / `MISSING_BUCKET`; `quotaRemaining` null khi không FINITE (không fake 0); tests cả 3 trạng thái |
| `emailNeedsCsCount` | `notifications` email `DEAD` trừ `last_error = ticket revoked/cancelled`; FAILED tạm không đếm |
| `asOf` | `clock_timestamp()` → ISO-8601 |
| OpenAPI regenerated | `EventReportDto` required đủ field mới |
| Authz `report.read` + assignment | `requireTenantPermission(..., report.read, eventId)`; tests deny unassigned / thiếu assignment |
| Aggregate-only | Comment + test: JSON không chứa email/code attendee |
| Isolation tests | `reporting.test.cjs` mở rộng O12; CI database-isolation membership-report xanh |

## Findings

### Blocker

Không có.

### Should-fix (không hạ FAIL — documented known gap)

1. **Online Gate reject chưa auto-audit mọi throw path.** `recordGateReject` chỉ được gọi từ offline-sync (`REJECTED`/`CONFLICT`) và fixture test. `reserveCheckin` / `confirmCheckin` (và API `gateHttpException`) throw `GateError` mà không ghi `gate.reject` → `rejectByReason` **undercount** đường online chính cho đến follow-up wire audit (catch boundary hoặc trước throw). Implementer đã ghi rõ trên PR; **chấp nhận PASS with known gap** — không phải lỗ hổng authz/PII; contract + đọc aggregate đúng khi có audit.
2. **Chưa có breakdown theo cổng.** O12 / Issue ghi «theo lý do·cổng» / `rejectByReason(+gate)`; PR chỉ có `rejectByReason`. Task: «+gate nếu có» → thiếu dimension cổng = gap có chủ đích, không FAIL Wave P1.

### Nit

- Offline path ghi `gate.reject` nhưng chưa có assert riêng trong `offline-sync-apply.test.cjs` (chỉ báo cáo qua fixture `reporting.test.cjs`). Follow-up coverage tùy chọn.

## Architecture

- Mở rộng `EventReport` khớp Wave P1 O12 (check-in/reject + quota có định nghĩa + email-cần-CS + `asOf`).
- Không migration; không sửa AC #229; không consumer web/iOS trong PR này.
- Không phát hiện design drift đáng kể so với O12 → **không** đề xuất Architect blocker.

## Limitations / revalidation

- Verdict chỉ pin SHA `4f6530bfb3d81a514493c7f1385896757e2e9428`. Commit hành vi mới sau này → bắt buộc DoD lại.
- Gap online reject audit phải có Issue/Task follow-up trước khi Dashboard Supervisor KPI reject được coi là đủ dữ liệu production day-of.
- Reviewer **không** merge; coordinator quyết định merge sau DoD + CI (đã xanh).

## Verdict

**PASS with known gap** — đủ DoD cho Wave P1 EventReport O12 trên exact SHA; gap online audit + thiếu theo-cổng không vi phạm security/`report.read`/aggregate-only và đã được ghi nhận có chủ đích.
