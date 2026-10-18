# DoD + Security review — EventReport O12 (Wave P1)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Role `reviewer-dod` + `reviewer-security` · Agent cursor · terminal `term_0e3c0352-b49d-41aa-a6fd-a0e818f7f642` · Task `task_f8e4dade061c` · Dispatch `ctx_99496b694d34` · **≠** implementer `ctx_ff2e40c92499` |
| Scope | Issue [#241](https://github.com/hangndat/ticket-solution/issues/241) · PR [#242](https://github.com/hangndat/ticket-solution/pull/242) · `packages/backend/**`, `apps/api/**` (OpenAPI) · Epic #222 · không đụng `apps/web` / `apps/mobile` |
| Commit SHA | `4f6530bfb3d81a514493c7f1385896757e2e9428` |
| Architecture impact | Có (contract EventReport) — đối chiếu semantics O12 theo AC #241 + code/OpenAPI (xem limitation docs) |
| Verdict DoD | **PASS with known gap** |
| Verdict Security | **PASS with known gap** (cùng gap; không có blocker authz/RLS/PII) |

## Checks (exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` trên worktree review | `4f6530bfb3d81a514493c7f1385896757e2e9428` |
| CI run [39055934295](https://github.com/hangndat/ticket-solution/actions/runs/39055934295) `head_sha` | `4f6530bfb3d81a514493c7f1385896757e2e9428` · **success** |
| CI `backend` | success |
| CI `database-isolation (membership-report, … reporting.test.cjs)` | success |
| CI matrix isolation (rls, issue-gate, approval-config-lifecycle, n1-email, branding) | success |
| Local `pnpm --filter @ticket/backend exec node --test test/reporting.test.cjs` | **không chạy được** trên worktree này (`Cannot find module 'pg'` — deps chưa cài). Verdict dựa CI isolation trên đúng SHA. |

## Checklist DoD

| # | Criterion | Kết quả |
| --- | --- | --- |
| 1 | `checkInSuccessCount` = Gate confirm APPLIED chưa undo (không chỉ `tickets.USED`) | **PASS** — SQL `checkins` + `undone_at IS NULL`; test confirm→1, undo→0 trong khi `USED` vẫn 1. |
| 2 | `rejectByReason`(+gate nếu có) từ nguồn thật; không đếm retry thành công | **PASS with gap** — nguồn `audit_logs.action = gate.reject`; email/gate không đếm successful retry như CS. **Gap:** online Gate throw chưa auto-audit; chưa breakdown theo cổng. Offline CONFLICT/REJECTED không ghi ledger → replay cùng `clientEventId` có thể ghi audit lại (phình nhẹ). |
| 3 | `quotaRemaining` + `FINITE\|UNLIMITED\|MISSING_BUCKET` | **PASS** — `resolveQuota`; UNLIMITED/MISSING → `quotaRemaining: null` (không fake 0); tests cover 3 states. |
| 4 | `emailNeedsCsCount` = failed cuối cần CS; không mọi retry | **PASS** — `notifications` email `state='DEAD'` và loại `last_error = ticket revoked/cancelled`; temporary `FAILED` assert = 0. |
| 5 | `asOf` watermark ISO | **PASS** — `clock_timestamp()` → `toISOString()`; test `Date.parse`. |
| 6 | `report.read` + assignment; RLS/tenant isolation; aggregate-only | **PASS** — `requireTenantPermission` + event assignment; queries luôn `tenant_id` (+ `event_id`); payload không PII (test chống email/code). API: AuthzError→403, ReportError EVENT_NOT_FOUND→404. |
| 7 | Tests isolation trên exact SHA; CI xanh khi ghi verdict | **PASS** — CI isolation + reporting trên SHA tip xanh. |
| 8 | Giới hạn worker: online reject audit gaps | **PASS with known gap** — chấp nhận được: implementer đã ghi rõ; helper `recordGateReject` + offline wire sẵn; không nuốt acceptance bắt buộc Wave P1 (aggregate reject từ audit khi có). Follow-up: wire online reserve/confirm deny paths. |

## Architecture / O12

- Contract mở rộng khớp AC #241 / PR body: `checkInSuccessCount`, `rejectByReason`, `quotaRemaining`/`quotaCapacityState`, `emailNeedsCsCount`, `asOf`; OpenAPI regenerate đồng bộ DTO.
- **Limitation docs:** worktree/`main` `docs/DECISION-LOG.md` **chưa có mục O12** (Issue vẫn tham chiếu). Semantics đã neo trong code comments + OpenAPI + AC #241. Không coi là design drift implementation; nên bổ sung DECISION-LOG O12 ở task docs riêng. Không cần Architect blocker cho merge Wave P1.

## Security (reviewer-security)

Threats xét trong scope:

| Threat | Đánh giá |
| --- | --- |
| Cross-tenant report read | Mitigated — `withTenant` + `tenant_id` filters + membership/assignment |
| Missing `report.read` / unassigned event | Deny — tests `PERMISSION_DENIED` / `EVENT_ASSIGNMENT_REQUIRED` |
| PII leak via EventReport | Aggregate-only; no attendee fields; reject keys = reason codes |
| Inflate/hide quota via client | Server-side bucket read only |
| Audit injection into reject metrics | Only rows with action `gate.reject` written by Gate helpers; online gap → undercount (availability of metric), không escalate privilege |

Không có finding **fix trước merge** (exploitable / invariant gãy). Gap audit online là completeness của metric, không bypass authz.

## Findings

### Known gap (chấp nhận — không FAIL)

1. **Online Gate reject chưa auto-ghi `gate.reject`** trên mọi path `throw GateError` trong `reserveCheckin` / `confirmCheckin`. Hiện chỉ: `recordGateReject` helper, offline `REJECTED`/`CONFLICT`, test fixture. → `rejectByReason` undercount đường online đến follow-up.
2. **Chưa schema reject theo cổng** (`+gate nếu có`).
3. **Docs:** O12 chưa có dòng trong `docs/DECISION-LOG.md` trên SHA này.

### Should-fix (không chặn Wave P1)

- Offline `CONFLICT`/`REJECTED` không durable theo `clientEventId` trước khi `recordGateReject` → sync replay có thể phình `rejectByReason`. Nên idempotent audit hoặc chỉ audit lần đầu.

### Nit

- Local review worktree thiếu `pg` → không tái chạy isolation locally; dựa CI.

## Verdict

**PASS with known gap** (DoD + Security).

Gap (1)–(2) đã được implementer/coordinator ghi nhận; không vi phạm acceptance bắt buộc checklist #1/#3–#7; security invariants tenant/authz/aggregate giữ vững. Reviewer **không merge**.

Revalidation bắt buộc nếu có commit hành vi mới sau `4f6530bfb3d81a514493c7f1385896757e2e9428`.
