# D13 — PR #348 DoD + security review (SEC-1 session revoke)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca worker `term_a62f3437-164d-47af-8e67-5f42f46baf07` · Roles `reviewer-dod` + `reviewer-security` (`docs/agents/roles/reviewer-dod.md`, `reviewer-security.md`) · agent cursor · **≠** implementer |
| Scope | Issue **#345** · PR **#348** · ownership BE: `packages/backend` migration + DB tests (+ package script wiring); không sửa implementation trong review này |
| Epic / Story | Epic #301 → Story #305 |
| Architecture impact | **Có** — atomic session revocation + RLS / SECURITY DEFINER owner policy |
| Commit SHA (exact tip đã duyệt) | `cde4323674ae32a74ed502a9c676816ba93e8a24` |
| Live GitHub API head | `cde4323674ae32a74ed502a9c676816ba93e8a24` (khớp tip) |
| Behavior commit (ancestor) | `496824b1def73e140a8010ef857f48972bd30717` |
| Architect handoff (đối chiếu, không merge) | PR **#346** tip `ab3f3c48a788cf6927026f573e42918ae48c12ef` — `docs/architecture/D13-ACCOUNT-DELETION-HANDOFF.md` |
| Verdict DoD | **PASS with known gap** |
| Verdict Security | **PASS with known gap** |

## Tóm tắt

PR #348 đóng đúng AC gốc #345 (SEC-1 post-anonymize): `apply_account_anonymization` thu hồi `staff_sessions` ACTIVE theo `user_id` trong cùng lần apply với `COMPLETED`, Gate `assertSessionActive` → `SESSION_NOT_ACTIVE`, idempotent, không đụng staff/tenant khác, không xóa audit. **Không** implement revoke tại ACK theo architect PR #346 (R1+R2); đây là khoảng REQUESTED→apply, **không** phải lỗ post-COMPLETED đã phát hiện từ #320. SEC-2 IdP vẫn mở. CI `database-isolation` **chưa** shard `account-session-revoke.test.cjs` (test đã có trong `package.json` `test:db`).

## Diff ownership (PR files qua API)

- `packages/backend/prisma/migrations/202610180002_d13_o06_revoke_staff_sessions/migration.sql` (added)
- `packages/backend/test/account-session-revoke.test.cjs` (added)
- `packages/backend/test/rls-catalog.test.cjs` (staff_sessions ∈ `DEFINER_OWNER_TABLES`)
- `packages/backend/package.json` (`test:db` thêm file revoke)
- `docs/reviews/D13-BE-SESSION-REVOKE.md` (evidence implementer)

## Checklist DoD / AC (#345)

| AC | Kết quả |
| --- | --- |
| Thu hồi `staff_sessions` atomically trong account anonymization | **Pass** — `UPDATE … status='REVOKED'` trước `COMPLETED` trong cùng function/transaction |
| Gate token/session cũ không tiếp tục sau anonymize | **Pass** — regression `reserveCheckin` → `SESSION_NOT_ACTIVE` |
| Retry idempotent | **Pass** — `apply` / `processDue` sau COMPLETED → `applied=false` / 0 |
| Không ảnh hưởng user khác / tenant khác | **Pass** — session staff B cùng tenant + tenant khác vẫn ACTIVE |
| Audit 730d / không xóa audit | **Pass** — comment non-goal + test count `audit_logs` không giảm |
| Parameterized / runtime không bypass RLS | **Pass** — SECURITY DEFINER + `staff_sessions_owner` (pattern `event_attendees_owner`); runtime isolation policy giữ nguyên |
| Không IdP erase trong task này | **Pass** (đúng scope) — SEC-2 còn mở |
| Feature branch → PR → CI database-isolation | **Partial** — CI xanh trên tip, nhưng matrix **không** chạy `account-session-revoke.test.cjs` (chỉ `rls-catalog` cập nhật) |

## Security review

### Threat / abuse cases đã xét

1. **Post-COMPLETED stale Gate session** (SEC-1 gốc #320): FIXED — revoke + `assertSessionActive` fail-closed.
2. **Cross-tenant blast**: revoke theo `user_id` dưới `migration_owner` `USING (true)` — cần để xóa session mọi tenant của victim; runtime vẫn tenant-isolated. Test giữ session user khác / tenant khác.
3. **Least privilege function**: `REVOKE ALL … FROM PUBLIC`; `GRANT EXECUTE` chỉ `ticket_runtime`; `OWNER TO migration_owner`.
4. **Idempotency / double-apply**: COMPLETED early-return `applied=false`; UPDATE chỉ `status='ACTIVE'`.
5. **Retained audit**: không `DELETE` audit; test count ổn định.
6. **ACK window (architect R1+R2)**: `createAccountDeletionRequest` **không** revoke. Worker `list_due` due ngay khi `requested_at <= now()` (SLA ≤30d là trần hoàn thành, không phải delay). Rủi ro còn lại = cửa sổ REQUESTED→apply khi worker chậm/dừng — staff đã ACK vẫn Gate được đến lúc apply. **Không** gộp với bug post-COMPLETED; **không** tuyên bố PR này đã cover ACK revoke.
7. **SEC-2 IdP erasure**: vẫn mở (out of scope #345).
8. **openStaffSession deny khi open REQUESTED**: architect “recommended” — **chưa** có trong diff; hardening, không bịa là blocker AC gốc.

### Đối chiếu architect PR #346 (`ab3f3c48…`)

| Handoff | PR #348 |
| --- | --- |
| SEC-1 Option A + R1+R2: revoke tại **ACK và** apply (idempotent) | Chỉ **apply** (khớp AC Issue #345 “trong anonymization”) |
| Soft-check `assertSessionActive` only = không đủ | Đúng — đã soft-revoke DB rows, không chỉ check |
| Helper `revoke_sessions_for_user` riêng | Inline `UPDATE staff_sessions` trong `apply_account_anonymization` (đủ cho apply path) |

**Security blocker?** Không phát hiện blocker kiểu post-COMPLETED session còn ACTIVE. Khoảng ACK là **known gap / should-fix** theo handoff đã Confirmed, không invent coverage; coordinator quyết có bắt buộc follow-up trước merge hay tách task.

## Checks (chạy trên worktree tip = SHA trên)

```text
gh api repos/hangndat/ticket-solution/pulls/348 → head.sha
  = cde4323674ae32a74ed502a9c676816ba93e8a24

pnpm --filter @ticket/contracts build && pnpm --filter @ticket/backend build
cd packages/backend && node --test test/account-session-revoke.test.cjs test/rls-catalog.test.cjs
→ pass (cô lập Docker Postgres tên ticket-d13-sess-rev-* / task-owned; không đụng DB worker khác)

Lặp thêm 3 lần account-session-revoke + 1 lần song song với rls-catalog → pass

gh pr checks 348 → backend + database-isolation shards + ci = pass
(lưu ý: matrix không gồm account-session-revoke.test.cjs)
```

CRG MCP `code-review-graph-ticket` sẵn sàng nhưng graph daemon trỏ repo path khác (`SideProject/ticket-solution`); review dựa **source worktree này** + lean-ctx compose cho hot path (`apply_account_anonymization`, `assertSessionActive`, `account-deletion.ts`).

## Findings

| Mức | Finding |
| --- | --- |
| Known gap (DoD/CI) | `account-session-revoke.test.cjs` chưa vào `.github/workflows/ci.yml` `database-isolation` matrix → CI xanh không chứng minh regression SEC-1 đã chạy trên GitHub |
| Known gap (architect) | Chưa revoke tại ACK (PR #346 R1+R2); residual Gate trong cửa sổ REQUESTED→apply |
| Known gap (SEC-2) | IdP erase/disable vẫn mở |
| Nit | Evidence implementer ghi tip cũ `785e25b…`; tip hiện tại `cde4323…` (docs-only sau behavior) |

## Limitations

- Không merge / không deploy prod / không cloud build.
- Không chạy full `test:db` hay UAT headless (ngoài scope BE unit/DB focused).
- Không re-test offline-sync `assertSessionActive` riêng (cùng predicate ACTIVE + `revoked_at IS NULL`).
- Flake lần chạy đầu (scanned=0) có thể do Docker/harness môi trường; các lần sau ổn định — ghi nhận limitation, không nâng thành FAIL logic SQL khi evidence lặp pass.

## Verdict

**DoD: PASS with known gap** — AC post-anonymize #345 đạt với evidence local exact-SHA; gap CI matrix + ACK/SEC-2 đã liệt kê (không nuốt security gate post-COMPLETED).

**Security: PASS with known gap** — SEC-1 post-anonymize đóng; ACK ordering và SEC-2 là gap có chủ đích / follow-up, không invent blocker giả.
