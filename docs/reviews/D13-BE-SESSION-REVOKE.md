# D13 — BE SEC-1: thu hồi staff_sessions khi anonymize

| Field | Value |
| --- | --- |
| Issue | #345 (Epic #301 → Story #305) |
| Role | `backend` (`docs/agents/roles/backend.md`) |
| Architecture impact | **Không** — invariant O06 hiện hữu; không IdP / SEC-2 (#344) |
| Exact SHA | _(điền sau commit tip branch)_ |
| Ownership | `packages/backend` migration + DB test; worker path đã gọi `processDueAccountAnonymizations` |

## Finding đóng (SEC-1)

`apply_account_anonymization` trước đây chỉ revoke `device_tokens` → Gate `assertSessionActive` vẫn chấp nhận `staff_sessions` ACTIVE của user đã anonymize.

## Fix

Migration mới `202610180002_d13_o06_revoke_staff_sessions`:

1. Policy `staff_sessions_owner` cho `migration_owner` (FORCE RLS + SECURITY DEFINER).
2. `CREATE OR REPLACE FUNCTION apply_account_anonymization` — trong **cùng transaction** với COMPLETED:
   - `UPDATE staff_sessions SET status='REVOKED', revoked_at=… WHERE user_id = v_user_id AND status='ACTIVE'`
3. Không DELETE audit; không IdP erase.
4. Forward plan IdP: comment trong migration — worker SEC-2 phải gọi lại function này / giữ khối revoke; không REPLACE bỏ session revoke.

Entry points (không đổi TS API):

- Worker poll / `relayOnce` → `processDueAccountAnonymizations` → SQL function
- TS `applyAccountAnonymization` vẫn chỉ gọi SQL

## Checks

```text
pnpm --filter @ticket/contracts build && pnpm --filter @ticket/backend build
cd packages/backend && node --test test/account-session-revoke.test.cjs
cd packages/backend && node --test test/rls-catalog.test.cjs
→ account-session-revoke: pass
→ rls-catalog: pass (staff_sessions trong DEFINER_OWNER_TABLES)
```

Regression chứng minh:

- Session ACTIVE + Gate reserve OK trước anonymize
- Sau apply: session REVOKED; `reserveCheckin` → `SESSION_NOT_ACTIVE`
- Retry `applyAccountAnonymization` / `processDue…` idempotent (`applied=false` / 0)
- Staff khác cùng tenant + session tenant khác không bị ảnh hưởng
- `audit_logs` count không giảm sau anonymize
- Sau COMPLETED: 0 ACTIVE session của user victim trên các tenant đã seed

## Limitations

- SEC-2 IdP delete/disable **chưa** làm (architect #344).
- `platform.test.cjs` local lần này fail sớm ở `provisionTenant` / `PLATFORM_OPERATOR_REQUIRED` — không liên quan session revoke path; không dùng làm evidence SEC-1.
- Không merge / deploy prod trong worker này.
