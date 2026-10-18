# D13 — BE SEC-1 ACK: thu hồi staff_sessions khi nhận yêu cầu xóa

| Field | Value |
| --- | --- |
| Issue | #349 (Epic #301 → Story #305) |
| Role | `backend` (`docs/agents/roles/backend.md`) |
| Architecture impact | **Có** — atomic ACK session revoke (architect D1 / handoff §4) |
| Exact SHA (behavior) | 9797aefa2205fda75092c627211df2df2ba323a3 |
| Branch tip | `hangndat/d13-be-ack-session-revoke` / PR #352 |
| Ownership | `packages/backend` migration + ACK/Gate hooks + DB tests |
| Related | PR #348 apply-only merge `f673a92014e501b84b2e2a8fc1372815ef597ccc`; IdP SEC-2 **chưa**; finding `docs/reviews/D13-PR352-DOD-SECURITY.md` SEC-R1 |

## Mục tiêu đóng

PR #348 chỉ revoke trong `apply_account_anonymization`. Architect D1 yêu cầu helper SECURITY DEFINER gọi **tại ACK** và lại trong apply (idempotent); `REJECTED` không phục hồi phiên; chặn `openStaffSession` khi còn request mở.

## Fix

Migration `202610180003_d13_ack_revoke_staff_sessions`:

1. `lock_user_session_mutation` — `pg_advisory_xact_lock(872341, hashtext(user_id))`
2. `revoke_sessions_for_user(uuid)` — SECURITY DEFINER; revoke mọi `staff_sessions` ACTIVE của user (mọi tenant)
3. `assert_can_open_staff_session(uuid)` — cùng lock; raise `ACCOUNT_DELETION_OPEN` nếu state open
4. Trigger `staff_sessions_deny_if_deletion_open` — **SEC-R1:** `PERFORM assert_can_open_staff_session(NEW.user_id)` (lock **trước** EXISTS; cùng ordering với ACK) — không chỉ bare `EXISTS`
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
→ 5/5 pass (gồm SEC-R1 concurrency 40 rounds)
```

Regression chứng minh:

- ACK → session ACTIVE mọi tenant của đúng user → `REVOKED`; Gate `reserveCheckin` → `SESSION_NOT_ACTIVE`
- User/staff khác + tenant khác không bị đụng
- Re-ACK idempotent (cùng `requestId`); audit không bị xóa
- `openStaffSession` bị chặn khi `REQUESTED` (`ACCOUNT_DELETION_OPEN`)
- `REJECTED` → session cũ vẫn `REVOKED`; được mở session **mới** (không restore id cũ)
- Revoke failure → không còn row `account_deletion_requests` (rollback)
- Apply path vẫn idempotent sau ACK
- **SEC-R1:** raw `INSERT staff_sessions` uncommitted vs ACK — barrier `pg_locks` (waiter trên advisory 872341); 40/40 không còn `ACTIVE`∧`REQUESTED` (trigger cũ thiếu lock fail ~40/40)

## Limitations

- SEC-2 IdP delete/disable **chưa** (architect PR #346 revision in flight).
- Coordinator nối `account-ack-session-revoke.test.cjs` vào CI shard `account-deletion` **trước** re-review (worker không sửa CI).
- Không merge / deploy prod trong worker này.
- Deadlock: insert path và ACK đều lấy `lock_user_session_mutation` trước mutation khác trên cùng key — không đảo thứ tự lock.
