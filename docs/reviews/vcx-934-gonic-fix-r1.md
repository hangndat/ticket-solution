# Worker evidence — Issue #934 / PR #989 (fix round 1/2)

**Implementer:** Gonic (backend) · **Reviewer gốc:** James @ SHA `c26c5a74` (F01, F02)  
**Phạm vi:** `packages/backend`, `apps/api` — contract #924 G-08; không Portal/#928.

## Thay đổi

| Finding | Xử lý |
| --- | --- |
| **F01** | `listGuestInvitations` bắt `EVENT_ASSIGNMENT_REQUIRED` → `ImportError` `EVENT_NOT_FOUND` (404), giữ `PERMISSION_DENIED` (403) khi assignment còn hiệu lực nhưng thiếu `inventory.import`. API test xác nhận 404/403 và không đọc `guest_invitations` khi authz chặn. |
| **F02** | PostgreSQL `import-invitations.test.cjs`: `q` trước/sau `revokeEventAssignment` và `revokeMembership`; event UUID ngẫu nhiên → 404; reader thiếu quyền → `PERMISSION_DENIED`. |

**Exact SHA (fix round 1):** `c5f18b90dbeb55ab0d56ac7be0a4cd94db886aa6`

## Checks local

```bash
cd packages/backend && pnpm run test:import-list
cd apps/api && pnpm build && node --test test/invitation-list.test.cjs
```

## Hạn chế

- Chưa re-review James; BFF/UI #935 và nghiệm thu xuyên tầng ngoài slice.
- CI GitHub trên SHA mới cần xanh trước acceptance complete.
