# D5 — APNs wired on prod + push UAT status

Date: 2026-10-17

## Infra (done)

| Item | Evidence |
| --- | --- |
| AuthKey on VPS | `/opt/vemoki/secrets/apns/AuthKey.p8` mode 400 |
| Key ID | `4HL2CWNN69` |
| Worker mount | `/run/secrets/apns` → readable in `vemoki-worker-1` |
| Env | `APNS_ENABLED=true`, `APNS_PRODUCTION=true`, Team `BLUA62D52G`, bundle `com.hangndat.ticket` |
| Worker boot | No `APNS_MISCONFIGURED`; recreate 2026-10-17 |
| Gitignore | PR #184 `*.p8` |

## Device

| Item | Value |
| --- | --- |
| USB | Dexter’s iPhone 16 Pro `00008140-000605803C01801C` connected |
| App | Vemoki `com.hangndat.ticket` **0.1.0 (8)** installed |
| Launch | `devicectl device process launch` OK (app foreground) |
| `device_tokens` rows | **0** (2026-10-17 ~18:07+07) — registration chưa chạy |

## Blockers for DELIVERED proof

1. **Physical HID / a11y:** AXe không hỗ trợ device thật (`--udid` unknown); iOS 26 RSD không có displayservice → không tap Allow / login từ Mac.
2. Push register path cần: signed-in verified session + notification permission granted → `POST /v1/me/device-tokens`.
3. ADR-12: provider `ACCEPTED` ≠ device `DELIVERED`. Sau khi có token: gửi TicketIssued push → `notifications.state=ACCEPTED` + xác nhận banner trên máy.

## UAT steps trên máy (cầm tay ~30s)

App đã được agent mở sẵn trên Dexter iPhone:

1. Đăng nhập `attendee@example.com` / `attendee-demo` (hoặc tài khoản đã có vé).
2. **Allow** notifications khi hệ thống hỏi.
3. Mở Account / chờ app đăng ký token (hoặc kill+reopen app một lần).
4. Báo lại — agent poll `device_tokens` rồi kích hoạt push TicketIssued và ghi evidence ACCEPTED + DELIVERED.

## Parent #6

Board đã **Hoàn thành**/closed. Evidence này là residual pilot push DELIVERED (không reopen trừ khi fail).
