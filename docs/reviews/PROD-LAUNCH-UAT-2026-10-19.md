# UAT production — 2026-10-19

| Trường | Giá trị |
| --- | --- |
| Runner | Coordinator session (catalog vừa viết, chưa có worker `Sora · uat` riêng) |
| Catalog | `docs/plans/PROD-LAUNCH-UAT.md` |
| Catalog git | **Chưa commit.** Nội dung SHA-256 `2e92a9115a91f3c21fb5110d49faec0d899dd170f748d66351d891b61495a31d` |
| `HEAD` repo | `979483083f5f` trên `hangndat/d1-leader` (chưa merge `main`) |
| Môi trường | `https://vemoki.com`, `portal.vemoki.com`, `app.vemoki.com`, `auth.vemoki.com` |
| Browser | Orca tab `dafcc846-aede-44ad-ab6d-ca35acb0a7ec` |
| iOS | Simulator `Epic527-iOS-Gates` `4AD7F2DC-5533-4C66-875C-A430DF3C734C`, bundle `com.hangndat.ticket` đã cài |
| Ảnh | `apps/web/.uat-artifacts/prod-launch-2026-10-19/`, `apps/mobile/.uat-artifacts/prod-launch-2026-10-19/f01-cold-launch.png` |

## Launch

**NO-GO** còn lại: B06 (portal attendee chưa chứng minh từ chối), H03 (không có hộp thư), J04 (`979483083f5f` chưa lên `main`). Máy thật (G01–G06, H01) vẫn hoãn, không chặn đợt này. E04, D02–D04, F02–F04 đã chạy lại trong cùng ngày.

## P0

| ID | Kết quả | Evidence |
| --- | --- | --- |
| A01 | PASS | marketing/portal/app `200`; auth `302` → `/admin/` |
| A02 | PASS | portal `/api/bff/me/subject` không cookie `401` `UNAUTHENTICATED` |
| A03 | PASS | app `/api/bff/me` không cookie `401` |
| A04 | PASS | `GET /gate` không cookie `307` `/auth?next=%2Fgate` |
| A05 | PASS | `ancafe.anphong.vn` `200`. `dath.info` trả `401` khi bỏ qua kiểm TLS; chứng chỉ không khớp hostname. Không sửa conf |
| B01 | PASS | Sau đăng nhập, portal vào Aurora Night Org, không màn «Cần đăng nhập». Ảnh `c01-portal-home.png` |
| B02 | PASS | `ticket-admin-web`, redirect portal callback, scope `openid profile email`, PKCE S256, không `offline_access` |
| B03 | PASS | Login portal kết thúc `200` trên shell, không 502 |
| B04 | PASS | Staff vào `https://app.vemoki.com/gate`, title «Cổng check-in dự phòng». Ảnh `b04-gate.png` |
| B05 | PASS | Authorize app: `ticket-web`, callback app, scope không `offline_access`, PKCE |
| B06 | FAIL | Sau logout portal và login lại (phiên attendee), portal mở onboarding **UAT Device Tenant** (`uat-device`), không từ chối shell quản trị |
| B07 | PASS | Sai mật khẩu giữ nguyên form Keycloak, không vào app. Ảnh `b07-bad-password.png` |
| B08 | PASS | `GET /api/auth/logout` về `/auth` «Staff sign-in». Ảnh `b08-after-logout.png` |
| B10 | PASS | Cookie `vemoki_portal_locale=en` → `<html lang="en">`; không cookie → `lang="vi"` |
| C01 | PASS | Shell có Aurora Night Org |
| C02 | PASS | Event Aurora Night UAT, slug `aurora-night-150643`, nội dung PUBLISHED. Ảnh `c02-event.png` |
| C03 | PASS | `href` nút cổng = `https://app.vemoki.com/gate` |
| C04 | PASS | Members: 1 user masked `s***@example.com` Owner ACTIVE, không tenant khác. Ảnh `c04-members.png` |
| E01 | PASS | Copy «Chưa rõ / không cho khách qua», phiên «Chưa mở» trước khi bấm |
| E02 | PASS | Sau `979483083f5f`, «Mở phiên cổng» hiện `Phiên: cd8488ca-c72c-4cbe-91bb-cc3e5fbab626` |
| E03 | PASS | Vé Aurora `7d8c18df-de69-436f-b965-b21665d0e56e` đã vào: check-in `d7d9958b-830c-4aae-8fb0-e9b65ea35db4` |
| E04 | PASS | Cùng vé, phiên mới `cd8488ca-c72c-4cbe-91bb-cc3e5fbab626`: «Không cho vào», `TICKET_NOT_ACTIVE`. Không cấp check-in thứ hai |
| E05 | PASS | Vé giả `11111111-1111-4111-8111-111111111111` → `TICKET_NOT_FOUND` |
| E07 | PASS | Attendee mở `/gate` → `/?notice=gate_denied`, copy «Không đủ quyền cổng» |
| I01 | PASS | Tenant UUID lạ: «Không có quyền», không thấy event |
| I02 | PASS | `GET https://api.vemoki.com/v1/me/events` không token `401`, không `422` |
| J01 | PASS | Container portal `PRODUCT_ORIGIN=https://app.vemoki.com` |
| J02 | PASS | Portal và web `OIDC_SCOPES=openid profile email` |
| J03 | PASS | API có đủ tên `PLATFORM_*` và `OIDC_AUDIENCE`; ACR `2`. Không in giá trị secret |
| J04 | FAIL | Bản vá nằm ở `979483083f5f` trên `hangndat/d1-leader`, chưa merge `main`. VPS đang chạy bản đã vá |
| J06 | PASS | Vhost portal `proxy_buffer_size 32k` |
| D01 | PASS | Attendee trên app: nav Đổi mã / Nhận lời mời / Tài khoản, không chrome tenant admin |
| D02 | PASS | Attendee `attendee@example.com`, sự kiện public `mfest-demo` / `mfest`, mã `DEMO-MFEST-010` → «Đổi mã thành công», vé `ce7dc6f2-b001-445e-9c9c-916faa559a8b` ACTIVE, yêu cầu `a178e392-344b-42f6-8c53-2a4e727bf39a`. Ảnh `d02-redeem-ok.png` |
| D03 | PASS | Cùng form, mã `NOT-A-REAL-CODE` → «Mã không hợp lệ / Không tìm thấy mã cho sự kiện đã chọn» |
| D04 | PASS | Gửi lại `DEMO-MFEST-010` → «Mã đã dùng / không thể dùng lại». Không cấp vé thứ hai |
| F01 | PASS | Cold launch Simulator, heading «Sự kiện đang mở», không crash. Ảnh `f01-cold-launch.png` |
| F02 | PASS | Debug build Simulator, Metro với `EXPO_PUBLIC_API_BASE_URL=https://api.vemoki.com`. Hết «Chưa cấu hình API». Danh sách có MFest đã xuất bản v2. Ảnh `f02-booted.png` |
| F03 | PASS | `ASWebAuthenticationSession` tới `auth.vemoki.com`, attendee demo vào được. Ví có «Đăng xuất». Ảnh `f03-keycloak.png`, `f04-wallet-tenant.png` |
| F04 | PASS with known gap | Attendee chỉ thấy tab «Sự kiện» và «Vé của tôi». Sau khi bundle thêm `EXPO_PUBLIC_TENANT_ID` của `mfest-demo`, ví đồng bộ `2026-10-19T09:02:01.137Z`, dòng «Sự kiện · Còn hiệu lực». Chưa login staff trên Simulator nên chưa thấy tab cổng nhân viên |
| G01 | PASS | iPhone cắm dây, team `BLUA62D52G`, bản Release `com.hangndat.ticket` 1.0.0 (14). Mở app, sự kiện MFest đã xuất bản. Ảnh `g01-events.png` |
| G02 | BLOCKED | Sheet `auth.vemoki.com` đã mở. WebDriverAgent kẹt trước khi gửi `staff@example.com`. Ảnh `g02-now.png` |
| G03–G06 | BLOCKED | Chưa vào tab nhân viên nên chưa quét QR, chưa thử từ chối camera, chưa cắt mạng |
| H01 | BLOCKED | Chưa tới bước cấp quyền push trên máy |
| H03 | BLOCKED | Không có hộp thư kiểm soát |

Phiên cổng tạo thêm khi gọi API trực tiếp (không phải nút): `sessionId` `d02e9017-5a94-4d0f-b657-1298e40fbc46`, event Aurora, `ACTIVE`. Không giữ chỗ, không xác nhận vé.

## P1

| ID | Kết quả | Ghi chú |
| --- | --- | --- |
| A06 | PASS | Cert bốn host `notAfter` 17 Jan 2027 |
| B09 | PASS | Logout portal không để app đang vào `/gate`; app hỏi đăng nhập riêng. Copy portal: cookie không dùng chung với app |
| C06 | PASS | Hạn mức đã cấp 1 / capacity 100 |
| C07 | PASS | Nhật ký có dòng từ 2026-10-17 |
| C08 | PASS | Cookie/localStorage EN: «Open scan Gate on app», «Members», `lang=en` |
| C09 | GAP | `<title>` vẫn «Vemoki Portal» khi locale EN |
| D05 | PASS | `/claim` và `/invite` không token: trang hướng dẫn, không 500 |
| D07 | GAP | `vemoki.com/en` là `lang=en`. App khách vẫn tiếng Việt |
| C05 | NOT-RUN | Không gửi lời mời |
| E06 | NOT-RUN | Không cắt mạng giữa chừng |
| D06 | NOT-RUN | Không đo viewport 390 |
| I03 | PASS | Staff Owner mở `/platform`: «Not a Platform Operator» |
| I04 | BLOCKED | Không có user Operator demo |
| H02 | NOT-RUN | Không đọc log worker |
| J05 | GAP | Không kiểm backup production. Drill Postgres bỏ đi không tính |

## Ngoài MVP

K01–K06: `N/A` (không chạy).

## Drift git ↔ VPS

| Việc đang sống trên VPS | Trên `main` |
| --- | --- |
| Portal `OIDC_SCOPES` không `offline_access` | `979483083f5f` đã có; `main` chưa nhận |
| API `PLATFORM_*`, ACR `2`, audience | Có trên nhánh, chưa merge |
| Nginx portal buffer 32k | Có trên nhánh, chưa merge |

## Việc phải xong trước khi GO

1. UI cổng nhận `201`: xong trên `979483083f5f`. E02–E05 PASS.
2. Compose + nginx + portal origin nằm trên nhánh, chưa merge `main` (J04).
3. Simulator trỏ `https://api.vemoki.com` và tenant `mfest-demo`. F02–F04 PASS; tab nhân viên chưa thử trên Simulator.
4. Máy thật (G01–G06, H01): hoãn, không chặn đợt này.
5. D02–D04 PASS trên `mfest-demo` / `mfest` với một mã `DEMO-MFEST-010`. Aurora vẫn UNLISTED.
6. B06 vẫn FAIL trên bảng: chưa đăng nhập portal bằng đúng attendee để chứng minh từ chối.
7. H03 inbox thật vẫn P0 nếu đợt này gửi mail khách. Chưa có hộp kiểm soát thì vẫn BLOCKED.
