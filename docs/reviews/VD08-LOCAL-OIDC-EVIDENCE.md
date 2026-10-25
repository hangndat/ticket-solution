# VD-08 — OIDC local fixture và kiểm tra quyền

Ngày: 2026-10-25. Phạm vi: stack `vd08oidc`, Keycloak thật ở `127.0.0.1:8080`, PostgreSQL demo riêng ở `127.0.0.1:55433`, API `127.0.0.1:3498`, web `localhost:3417`. Không dùng dữ liệu hoặc secret thật.

## Chạy lại

```sh
pnpm install --frozen-lockfile
UI869_COMPOSE_PROJECT=vd08oidc UI869_DEV_STATE_DIR="$PWD/.local-dev/vd08oidc" ./scripts/dev-local-stack.sh up
OIDC_ISSUER=http://127.0.0.1:8080/realms/ticket UI869_API_URL=http://127.0.0.1:3498 node scripts/dev-local-oidc-smoke.cjs
```

`up` tạo Keycloak và D9 fixture trong Docker project riêng, tự thêm ba persona vào local Keycloak/DB, và có thể chạy lại. Khi state file thiếu mà PostgreSQL volume đã có, script dừng để tránh tự reset DB. State/receipt nằm trong `.local-dev/` (ignored, mode 600); script không in token.

## Persona và kết quả

| Persona | Quyền fixture | Ca xác nhận |
| --- | --- | --- |
| `staff@example.com` | Owner ở hai tenant D9 | `report` MFest 200 |
| `scoped-staff@example.com` | Scanner ở MFest | mở Gate session MFest 200; báo cáo MFest 403; Gate Studio 403 |
| `revoked-staff@example.com` | Scanner đã thu hồi | báo cáo và Gate MFest 403 |
| `no-access@example.com` | Không membership | báo cáo và Gate MFest 403 |
| `attendee@example.com` | Chỉ attendee | báo cáo MFest 403 |

Chạy smoke thực tế: **9/9 PASS**, token do Keycloak local cấp qua `ticket-web`, API kiểm tra JWT và quyền DB. `bash -n scripts/dev-local-stack.sh` PASS. Chạy `up` lần hai PASS và không tạo trùng persona. Web trả HTTP 200.

Chạy thêm `scripts/uat-d1-p4-keycloak.py` với issuer/API local: **12/12 PASS** cho discovery, Authorization Code + PKCE, audience/email verified, `/v1/me`, đổi tài khoản attendee → staff, hiệu lực access token đến TTL, thu hồi refresh token sau logout-all, và required action `CONFIGURE_TOTP` chặn đăng nhập thầm. Script dọn required action sau phép thử. Đây là bằng chứng bước yêu cầu cấu hình TOTP, chưa phải bằng chứng hoàn tất nhập mã TOTP.

Orca browser: tab `773c9c91-9d5f-4e7b-ad57-01ba94705189` vào `/account` → `Đăng nhập` → Keycloak → nhập attendee → callback HTTP 307 → `/account` HTTP 200 (theo log web). Sau callback, lệnh `orca snapshot` bị treo; chưa xác nhận được nội dung trạng thái đăng nhập trên giao diện. Tab agent mở đã đóng.

## Phạm vi còn cần xác nhận

- MFA TOTP cho portal/platform và client riêng chưa được thiết lập trong fixture này. Staff demo hiện được bỏ bước `CONFIGURE_TOTP` chỉ trong realm local để cho phép smoke token; không dùng cấu hình này làm bằng chứng MFA.
- Chưa nghiệm thu iOS simulator, camera, thiết bị thật, logout/session switch hoặc toàn bộ các màn hình Vemoki. Các ca này vẫn cần UAT riêng; kết quả API 9/9 không đồng nghĩa acceptance hoàn tất.
- Trạng thái: chỉ là evidence local của nhánh VD-08; chưa có review độc lập, CI hay nghiệm thu thiết bị.
