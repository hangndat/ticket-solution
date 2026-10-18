# D13 — BE SEC-1 ACK: thu hồi staff_sessions khi nhận yêu cầu xóa

| Field | Value |
| --- | --- |
| Issue | #349 (Epic #301 → Story #305) |
| Role | `backend` (`docs/agents/roles/backend.md`) |
| Architecture impact | **Có** — atomic ACK session revoke (architect D1 / handoff §4) |
| Exact SHA (behavior) | _(filled after commit)_ |
| Ownership | `packages/backend` migration + ACK/Gate hooks + DB tests |
| Related | PR #348 apply-only merge `f673a92014e501b84b2e2a8fc1372815ef597ccc`; IdP SEC-2 **chưa** |

## Mục tiêu đóng

PR #348 chỉ revoke trong `apply_account_anonymization`. Architect D1 yêu cầu helper SECURITY DEFINER gọi **tại ACK** và lại trong apply (idempotent); `REJECTED` không phục hồi phiên; chặn `openStaffSession` khi còn request mở.

## Fix

Migration `202610180003_d13_ack_revoke_staff_sessions`:

1. `lock_user_session_mutation` — `pg_advisory_xact_lock(872341, hashtext(user_id))`
2. `revoke_sessions_for_user(uuid)` — SECURITY DEFINER; revoke mọi `staff_sessions` ACTIVE của user (mọi tenant)
3. `assert_can_open_staff_session(uuid)` — cùng lock; raise `ACCOUNT_DELETION_OPEN` nếu state open
4. Trigger `staff_sessions_deny_if_deletion_open` — defense-in-depth trên INSERT
5. `apply_account_anonymization` gọi lại `revoke_sessions_for_user` (idempotent)

TS:

- `createAccountDeletionRequest` — sau INSERT / re-ACK gọi `revoke_sessions_for_user` trong cùng `withActor` transaction (lỗi revoke → rollback request)
- `openStaffSession` — gọi `assert_can_open_staff_session`; map → `GATE_ERROR_CODES.ACCOUNT_DELETION_OPEN`
- Không IdP; không đổi contract enum / lockfile / CI root

## Checks

```text
pnpm --filter @ticket/contracts build && pnpm --filter @ticket/backend build
cd packages/backend && node --test \
  test/account-ack-session-revoke.test.cjs \
  test/account-session-revoke.test.cjs \
  test/rls-catalog.test.cjs
→ 4/4 pass
```

Regression chứng minh:

- ACK → session ACTIVE mọi tenant của đúng user → `REVOKED`; Gate `reserveCheckin` → `SESSION_NOT_ACTIVE`
- User/staff khác + tenant khác không bị đụng
- Re-ACK idempotent (cùng `requestId`); audit không bị xóa
- `openStaffSession` bị chặn khi `REQUESTED` (`ACCOUNT_DELETION_OPEN`)
- `REJECTED` → session cũ vẫn `REVOKED`; được mở session **mới** (không restore id cũ)
- Revoke failure → không còn row `account_deletion_requests` (rollback)
- Apply path vẫn idempotent sau ACK

## Limitations

- SEC-2 IdP delete/disable **chưa** (architect PR #346 revision in flight).
- Coordinator nối regression vào CI root nếu cần (worker không sửa CI wiring).
- Không merge / deploy prod trong worker này.
- Concurrent race phủ bởi advisory lock + trigger; không có stress harness multi-client riêng.
