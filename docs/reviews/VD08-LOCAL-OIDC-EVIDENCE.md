# VD-08 — OIDC local fixture và kiểm tra quyền

Ngày: 2026-10-25. Phạm vi: stack `vd08oidc`, Keycloak thật ở `127.0.0.1:8080`, PostgreSQL demo riêng ở `127.0.0.1:55433`, API `127.0.0.1:3498`, web `localhost:3417`. Không dùng dữ liệu hoặc secret thật.

## Chạy lại

```sh
pnpm install --frozen-lockfile
UI869_COMPOSE_PROJECT=vd08oidc UI869_DEV_STATE_DIR="$PWD/.local-dev/vd08oidc" ./scripts/dev-local-stack.sh up
OIDC_ISSUER=http://127.0.0.1:8080/realms/ticket UI869_API_URL=http://127.0.0.1:3498 node scripts/dev-local-oidc-smoke.cjs
```

`up` tạo Keycloak và D9 fixture trong Docker project riêng, tự thêm ba persona vào local Keycloak/DB, và có thể chạy lại. Khi state file thiếu mà PostgreSQL volume đã có, script dừng để tránh tự reset DB. State/receipt nằm trong `.local-dev/` (ignored, mode 600); script không in token.
`up` cũng bind flow OTP thật cho `ticket-admin-web` và `ticket-platform-web` trên Keycloak local; client attendee giữ flow thường.

Email local đi qua worker và `SMTP_URL=smtp://127.0.0.1:1026` vào Mailpit `http://127.0.0.1:8026`. Full flow không bật `EMAIL_ALLOW_NOOP`.

## Persona và kết quả

| Persona | Quyền fixture | Ca xác nhận |
| --- | --- | --- |
| `staff@example.com` | Owner ở hai tenant D9 | `report` MFest 200 |
| `scoped-staff@example.com` | Scanner ở MFest | mở Gate session MFest 200; báo cáo MFest 403; Gate Studio 403 |
| `revoked-staff@example.com` | Scanner đã thu hồi | báo cáo và Gate MFest 403 |
| `no-access@example.com` | Không membership | báo cáo và Gate MFest 403 |
| `attendee@example.com` | Chỉ attendee | báo cáo MFest 403 |

Chạy smoke thực tế: **9/9 PASS**, token do Keycloak local cấp qua `ticket-web`, API kiểm tra JWT và quyền DB. `bash -n scripts/dev-local-stack.sh` PASS. Chạy `up` sau khi dừng toàn stack PASS, không tạo trùng persona và áp dụng lại OTP flow; smoke quyền vẫn **9/9 PASS**. Web trả HTTP 200. Stack sinh keyring tombstone riêng trong state local để worker không báo thiếu cấu hình.

Chạy thêm `scripts/uat-d1-p4-keycloak.py` với issuer/API local: **12/12 PASS** cho discovery, Authorization Code + PKCE, audience/email verified, `/v1/me`, đổi tài khoản attendee → staff, hiệu lực access token đến TTL, thu hồi refresh token sau logout-all, và required action `CONFIGURE_TOTP` chặn đăng nhập thầm. Script dọn required action sau phép thử. Đây là bằng chứng bước yêu cầu cấu hình TOTP, chưa phải bằng chứng hoàn tất nhập mã TOTP.

Sau khi bind flow OTP: `platform-keycloak-sso-reuse-proof.mjs` PASS (SSO attendee không bỏ qua OTP ở hai client staff) và `platform-keycloak-mfa-live-proof.mjs` PASS (Auth Code + PKCE + nhập OTP thật → access token có `ticket-platform-api`, `acr=2`, `auth_time`). User MFA proof là synthetic và script xóa sau khi chạy.

Lượt Orca browser đầu tiên bị treo ở `snapshot` sau callback; lượt chạy lại bên dưới đã xác nhận trạng thái attendee trên giao diện.

Chạy lại UAT Orca: `/account` hiện attendee đã đăng nhập; `/redeem` xác định mã `DEMO-MFEST-002` → phát hành HTTP 201 → `/wallet` hiện vé MFest. Mailpit tăng từ 3 lên 4 thư sau relay, có email “Vé đã cấp — MFest · Demo”. Sau khi bật worker polling Mailpit, phát hành mã `DEMO-MFEST-003` qua API HTTP 201; Mailpit tự tăng từ 4 lên 5 thư. Portal đăng nhập staff qua `ticket-admin-web` và hiện shell quản trị/MFest. Các tab agent mở đã đóng. Mailpit local không lưu thư qua lần dừng compose; bằng chứng số thư thuộc phiên trước khi restart.

Build iOS Release cho simulator bằng Xcode local **PASS**. Lượt đầu dùng `CODE_SIGNING_ALLOWED=NO` khiến `expo-secure-store` báo thiếu Keychain entitlement; lượt build tiếp theo thiếu `EXPO_PUBLIC_*` nên không bật đăng nhập. Build lại với Xcode tự ký **và** đầy đủ biến local đã khắc phục cả hai lỗi cấu hình test: app đăng nhập Keycloak thành công với `attendee@example.com`, ví hiện 2 vé MFest và mở được chi tiết vé. Trên màn đổi mã, app tra cứu `DEMO-MFEST-004` và bật đồng ý điều khoản, nhưng bản cũ không phản hồi khi xác nhận. Nguyên nhân: `crypto.randomUUID()` chạy trước khối `try`, còn Hermes không có global `crypto`. Đổi sang `randomId()` hiện có của dự án tại redeem, claim và account deletion. Build Xcode lại **PASS**; iOS xác nhận `DEMO-MFEST-004` hiện “Đã nhận vé”, DB có 3 vé của attendee và Mailpit nhận 1 thư “Vé đã cấp — MFest · Demo”. Ví giữ dữ liệu cũ khi quay lại tab nên đã đổi sang refresh theo focus; build lại và xác nhận `DEMO-MFEST-005` thành công, Mailpit có 2 thư, ví hiện **4 vé ngay khi mở tab**. `pnpm --filter @ticket/mobile typecheck`, ESLint các file sửa và toàn bộ `pnpm --filter @ticket/mobile test` đều PASS.

## Phạm vi còn cần xác nhận

- Staff demo được bỏ `CONFIGURE_TOTP` trong realm local để cho phép smoke `ticket-web` qua password grant. Sau khi bind flow OTP, Portal/Platform đòi OTP riêng; phiên Portal đã mở trước khi bind flow không dùng làm bằng chứng MFA. Bằng chứng OTP thực tế nằm ở script live proof trên.
- iOS simulator đã PASS đăng nhập, đổi mã và cập nhật ví khi chuyển tab. Camera, thiết bị thật, logout/session switch và toàn bộ màn hình chưa nghiệm thu. Chế độ viewport iPhone của Orca browser cũng treo ở loading khi thử, chưa tính là PASS.
- Trạng thái: chỉ là evidence local của nhánh VD-08; chưa có review độc lập, CI trên thay đổi mới hay nghiệm thu thiết bị. Điều kiện deploy prod theo yêu cầu “ổn thì deploy” chưa đạt.
