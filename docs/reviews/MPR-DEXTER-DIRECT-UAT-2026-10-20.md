# MPR — UAT trực tiếp trên iPhone Dexter (20/10/2026)

## Kết luận

**FAIL — chưa acceptance complete.** Đăng nhập OIDC staff bằng UI thật thành công; camera thật mở, Nhập tay và Lịch sử truy cập được. Workspace có 4 tab thay vì 3; không mở được Tài khoản do điều hướng quay về Scan.

## Bản kiểm tra và phương pháp

- Thiết bị: D Dexter’s iPhone 16 Pro, UDID `00008140-000605803C01801C`.
- App: `com.hangndat.ticket`, bản Release `1.0.0 (17)` do Zico cài từ PR #596, SHA `df6ea47121e148cce1405f95e57d03c46e2c91c2` (build provenance theo handoff Zico; phiên UAT không rebuild).
- Thao tác trực tiếp qua WDA/XCUITest trên thiết bị vật lý; không simulator, không inject token/mock auth, không ROPC.
- Runner `com.hangndat.WebDriverAgentRunner.xctrunner`; script `/tmp/dexter-live-uat.py`, Python `/tmp/pymobile-venv/bin/python`.
- Đăng nhập tài khoản staff fixture qua ASWebAuthenticationSession → Continue → Email/Password → Sign In. Không ghi token hoặc mật khẩu vào báo cáo.
- API production `GET /v1/public/events?limit=1` trả HTTP 200 trong lần kiểm tra trước phiên này.
- Không thực hiện admit vé thật, xóa tài khoản, thay đổi dữ liệu nghiệp vụ hoặc thử gửi push.

## Kết quả

| Luồng | Kết quả | Evidence |
| --- | --- | --- |
| Guest Tài khoản | PASS — có ba nhóm; Sự kiện/Tài khoản, không tab ví | `01-start.png/xml` |
| System sign-in consent | PASS — mở sheet auth.vemoki.com, Continue hoạt động | `02-signin.png/xml` |
| OIDC staff | PASS — nhập fixture trong UI Keycloak, callback về app | `03-oidc.png/xml`, `08-logged-in.png/xml` |
| Default staff Scan | PASS — sau login về Scan, scope Studio Night · Demo | `08-logged-in.png/xml` |
| Camera vật lý | PASS cho preview — ảnh camera live; chưa thử QR admit | `08-logged-in.png` |
| Nhập tay | PASS cho mở màn/form; chưa xác minh kết quả submit | `09-staff-manual.png/xml`, `11-manual.png/xml` |
| Lịch sử | PASS cho empty state, nhãn phạm vi trên máy | `10-staff-history.png/xml` |
| Chính xác 3 tab staff | **FAIL** — Nhập tay/Scan/Lịch sử/**Tài khoản** | `08-logged-in.png/xml` |
| Mở Tài khoản từ header | **FAIL** — bấm header Account bị redirect về Scan | `15-staff-account.png/xml` |
| Mở Tài khoản từ tab | **FAIL** — bấm tab Account bị redirect về Scan | `16-account-tab.png/xml` |
| Menu More | PASS cho mở menu; chỉ có Làm mới sự kiện | `17-staff-menu.png/xml` |
| Logout/đổi account/attendee wallet | BLOCKED bởi lỗi mở Tài khoản | Không claim PASS |
| Push permission/delivery, admit QR, offline/reconcile | NOT RUN | Ngoài kết quả phiên này |

Thư mục ảnh và cây UI: `apps/mobile/.uat-artifacts/dexter-live-uat/` (gitignored). Tên label `08-logged-in` ghi nhận trạng thái UI thực tế, không chỉ kết quả HTTP.

## Findings giao Zico

1. **Chặn nghiệm thu:** `StaffDefaultTabRedirect` không cho vào route account khi staff; `staff-default-tab-target.ts` xếp `account` vào attendee-only và trả redirect. Cần cho phép Account theo PD (Quay lại quét), giữ đúng 3 tab cổng.
2. **Không khớp thiết kế:** tab Tài khoản xuất hiện như tab thứ tư. PD-HANDOFF dòng 66 yêu cầu mở Account không đổi 3 tab cổng. Header đã có Account; cần giải quyết navigation đúng thiết kế.
3. **Giới hạn:** preview camera không chứng minh quét/admit vé; screen mở được không chứng minh API check-in hoặc push delivery.

Đã báo Zico qua terminal để sửa trong PR #596, build lại local rồi UAT lại trên cùng máy. Không thay đổi trạng thái Project sang Hoàn thành từ kết quả này.
