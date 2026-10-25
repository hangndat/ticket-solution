# VD11 — Portal UAT với OIDC và MFA thật

Ngày 25/10/2026. Người thu bằng chứng: Minh. Đây là evidence cho reviewer xác minh, không thay verdict độc lập.

## Candidate, môi trường và identity

- Portal source/build: `da30da437d9706f4fa713634b7bd1430338d6044`, checkout `vd11-portal-recovery`. Portal tree ở candidate tích hợp `6510858d1cfa52ff168ae726f435991efc179fb5` giống hoàn toàn (`git diff da30da43..6510858d -- apps/portal` rỗng).
- Server Portal `http://127.0.0.1:3334`, API `http://127.0.0.1:3498`, Keycloak `http://127.0.0.1:8080/realms/ticket`. Tất cả là stack local `vd08oidc`; không provider email thật, không mock auth/BFF.
- Tạo Owner synthetic riêng, có membership và event assignment MFest trong PostgreSQL fixture. Tài khoản được tạo mới với `CONFIGURE_TOTP`; đăng nhập bằng password, nhập OTP enrollment thật, trao đổi authorization code qua callback `3334` và vào Portal.
- Chỉ append callback `http://127.0.0.1:3334/api/auth/callback` và webOrigin `3334` vào client `ticket-admin-web`; giữ nguyên mọi URI khác. Receipt riêng tư ngoài repo; cleanup chỉ gỡ các mục do agent thêm sau khi reviewer kiểm xong.
- Browser profile isolated `4459607b-7e26-49f6-af3a-038c4e83176b`; page `97a2193c-205d-4de3-afef-527844a3d669` đã đóng sau UAT. Không dùng cookie user. Reviewer có thể mở tab mới dùng profile này để xem session fixture còn hiệu lực; coordinator sẽ dọn fixture và profile khi hoàn tất.

## Hành trình và kết quả đã đo

1. `orca tab create --url http://127.0.0.1:3334/api/auth/login --profile ...` → Keycloak `ticket-admin-web` → enrollment MFA → callback Portal → onboarding MFest.
2. Qua `orca eval` gọi cùng-origin BFF thật: `/api/bff/me/tenants` **200**, role `Owner`, permissions thật; `/api/bff/me/events` **200**, `staffEligible=true`, event MFest và permissions `report.read`, `event.config`, v.v. Không lưu token hoặc OTP vào evidence.
3. Mở bookmark event `/t/d9d9f001-0001-4000-8000-000000000001/e/d9d9f001-0002-4000-8000-000000000001`. Mở nhóm Thiết lập sự kiện bằng Orca click. Click link **Cấu hình / xuất bản** trong menu; URL thành `/config`, selected leaf đúng.
4. Đóng nhóm MFest trong khi đang ở `/config`: group MFest `aria-expanded=false`, Thiết lập sự kiện `true`; `sessionStorage['vemoki.portal.siderOpenKeys']` chỉ còn `nav-event-setup`.
5. `orca reload` toàn trang `/config`: phiên thật vẫn hợp lệ, group MFest vẫn đóng, nhóm Thiết lập vẫn mở và leaf Cấu hình vẫn selected. Không reset thành tất cả nhóm mở.
6. Mở `/types` bằng bookmark với cùng session: dữ liệu **General** được API trả thật, leaf Loại vé selected, nhóm MFest vẫn đóng. Đo `innerWidth` **1440**, **1024**, **390**; overflow ngang của màn Loại vé **0**. Nút Tạo loại vé cao **44px**, nền **rgb(124,77,237)**.
7. Ở 390px có drawer menu; `orca keypress --key Escape` đóng drawer, vẫn ở `/types`, dữ liệu General còn hiển thị. Không dùng click vào tâm mask vì tâm viewport bị drawer che và có thể trúng menu bên trên.

Các lệnh dùng qua cùng Orca CLI đã resolve: `tab create/profile`, `fill`, `click`, `goto`, `reload`, `keypress`, `exec --command 'set viewport ...'`, `snapshot`, `eval`, `exec --command 'screenshot ...'`, `tab close`. Không chạy Playwright trực tiếp cho evidence này.

## Quan sát cần reviewer kết luận

- **Config 390px:** `document.documentElement.scrollWidth - innerWidth = 5`; tiêu đề Cấu hình chỉ còn vùng khoảng **55.45px** và bị ellipsis thành «Cấu ...». Ảnh `vd11-portal-config-390.png`.
- Hai input form Cấu hình có `.ant-input-affix-wrapper` thực tế cao **64px**, padding **9px 11px**, inner input cao **44px**. Rule min-height 44px áp vào cả inner input làm wrapper lớn hơn controlHeight đã chốt. Font input **16px**, box-sizing border-box. Đây không phải chỉ tên token; cần kiểm rendered box.
- Lượt click/animation đầu trong Orca có rAF chưa chạy dù visibilityState=visible. Capture screenshot giúp renderer tiến frame và sau đó menu nhận click đúng. Không tự suy ra đây là bug production; ghi rõ đặc điểm môi trường kiểm thử, không âm thầm sửa auth/menu để vượt automation.

## Ảnh và giới hạn

Ảnh được xem lại trước bàn giao, chỉ gồm fixture synthetic: [assets/VD11-PORTAL-OIDC-2026-10-25](assets/VD11-PORTAL-OIDC-2026-10-25/). Tên màn/viewport tương ứng nội dung ảnh; không có ảnh enrollment chứa secret. Bộ này bổ sung evidence thật cho **VD11-P-F01/F02** của review initial; reviewer quyết định đóng, giữ nguyên IDs và fix counter **0/2**.

Không bấm lưu draft, xuất bản, tạo loại vé hoặc thay dữ liệu event. Chưa kiểm đủ toàn bộ page matrix hoặc production; không tuyên bố pilot ready. Callback/profile/Owner fixture tạm còn giữ cho reviewer, có receipt cleanup ngoài repo; các tab UAT coordinator đã đóng, server local giữ để review.
