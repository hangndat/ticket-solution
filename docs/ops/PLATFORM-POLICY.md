# Policy freeze — Platform M01 / M02 / M12

Ngày: 2026-10-17 · Nguồn: `/tmp/vemoki-platform-plan.md` (coordinator freeze).  
**Không** chốt O06 retention/region/SLA. Security TTL xem `infra/platform/security-config.json`.

## 1. Suspend matrix

| Trạng thái tenant | Issue / redeem / approve mới | Admin mutate (config/publish/import) | Đọc profile/status | Vé owner + QR | Gate reserve/confirm/undo | Operation recovery |
| --- | --- | --- | --- | --- | --- | --- |
| `PENDING` | Chặn | Chặn (trừ owner accept) | Có (hẹp) | Không | Không | Không |
| `ACTIVE` | Theo quyền | Theo quyền | Có | Có | Có | Có |
| `SUSPENDED` | **Chặn** | **Chặn** | Có | **Giữ** | **Giữ** (staff còn quyền) | **Giữ** |

Suspend **không** tự đổi ticket state / credential / quota / check-in; **không** tự revoke membership.  
Revoke membership/support vẫn được Owner/operator thực hiện. Notification đã commit tiếp tục qua worker.

## 2. Limits

- Cột `max_*` **null = unlimited** (hiển thị rõ trên UI/API).
- Giảm dưới usage → `LIMIT_BELOW_USAGE`, không xóa dữ liệu.
- `max_events`: mọi event đã tạo; `max_staff`: active + pending invites.

## 3. Role map (server allowlist — không arbitrary permissions)

| Role | Tenant | Event assignment (map cố định) |
| --- | --- | --- |
| Owner | `tenant.profile`, `members.manage`, `event.create`, `event.list` + quản lý assignment | Không bypass event checks; cần assignment để vận hành event của Manager |
| Manager | create theo chính sách; discovery **assigned-only** | `event.config`, `publish`, `inventory.import`, `redemption.approve`, `report.read`, `export.*` |
| CS | — | `cs.lookup`, `cs.resend` (không đổi thành `cs.read`) |
| Supervisor | — | Gate + undo + `ticket.revoke` |
| Scanner | — | `gate.confirm` |

`cs.read` chỉ là **support grant scope** (operator), không phải tenant membership permission.

## 4. Support grant

- Read-only CS projection **event-scoped**; reason + expiry + audit mỗi read.
- Max TTL **1h** (security-config); thiếu config → fail closed.
- Không impersonate, không resend/export/undo/revoke qua support.

## 5. Account deletion request

- ACK `AWAITING_POLICY` / `REQUESTED` — **không** tự erase audit/ticket/identity.
- O06 chưa chốt → không transition `COMPLETED` xóa dữ liệu.

## 6. Platform operator

- Quyền từ bảng `platform_operators` (issuer+subject đã verify), không email/domain/header/claim client.
- Bootstrap offline one-time — runbook, không public route / demo escalation.
- Mất mọi operator → recovery offline explicit có audit; **không** backdoor runtime.
