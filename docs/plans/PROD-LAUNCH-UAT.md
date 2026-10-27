# UAT production — thiết kế launch Vemoki

Ngày thiết kế: 2026-10-19.
Trạng thái: **thiết kế, chưa chạy đợt này.**
Role thực thi: [`launch-uat`](../agents/roles/launch-uat.md) · skill `.cursor/skills/launch-uat/SKILL.md`.

Đợt này trả lời một câu: **có được tuyên bố pilot ready / mở launch production không.** Không thay DoD từng PR (`reviewer-dod`) và không thay review bảo mật code (`reviewer-security`). **iOS VoiceOver ngoài phạm vi Epic #914 / quyết định owner** — không thêm case catalog, không chặn đóng #914. IA iOS attendee/staff chrome theo [O27](../DECISION-LOG.md): **không** FAIL vì thiếu guest catalog tab / NativeTabs / tab Tài khoản / privacy WebView; **không** FAIL vì thiếu picker sự kiện trong body Scan.

## 1. Ba mức — đợt này chỉ chấm mức 3

| Mức | Đợt này |
| --- | --- |
| Code complete | Không chấm. Nhiều hotfix portal/API đang nằm trên VPS, chưa chắc có trên `main`. |
| Acceptance complete | Không chấm lại từng Issue. |
| **Pilot ready** | **Có, trừ máy thật đã hoãn.** Mọi P0 không thuộc suite hoãn phải `PASS`. |

`GO` đợt này khi mọi P0 ngoài mục hoãn = `PASS` và không còn P0 `BLOCKED`.
`NO-GO` khi một P0 không hoãn bị `FAIL` hoặc `BLOCKED`.
Case `DEFERRED` (máy thật, quyết định 2026-10-19) không kéo verdict đợt này. Vẫn bắt buộc trước ngày diễn có quét QR / push trên máy.
Case `OUT` (ngoài MVP) = `N/A`, không kéo verdict.

## 2. Bề mặt và dữ liệu

| Bề mặt | Origin | Việc |
| --- | --- | --- |
| Marketing | `https://vemoki.com` | VI+EN |
| Portal nhân sự | `https://portal.vemoki.com` | VI+EN catalog; Gate **không** nằm ở đây |
| App khách + cổng web | `https://app.vemoki.com` | Redeem, claim, invite, `/gate` |
| IdP | `https://auth.vemoki.com` | Realm `ticket` |
| API | nội bộ `ticket-api` / BFF | Không gọi công khai tùy tiện |
| iOS | bundle `com.hangndat.ticket`, team cá nhân | Local signed; không EAS |
| Hàng xóm | `ancafe` / `dath` | Chỉ smoke “không vỡ”, không sửa |

Tenant demo đã biết trên prod (đợt portal 2026-10-19, **phải xác nhận lại**, không kế thừa):

- Org: Aurora Night Org, slug `aurora-ops-0515`
- Event: Aurora Night UAT

Persona demo (mật khẩu là seed demo, không phải khách thật):

| Persona | Email | Mật khẩu | Surface được vào |
| --- | --- | --- | --- |
| Staff | `staff@example.com` | `staff-demo` | Portal + app `/gate` |
| Attendee | `attendee@example.com` | `attendee-demo` | App khách, không shell quản trị |

Không tạo user mới. Không dùng hộp thư khách thật.

## 3. Cách ghi mỗi case

`ID · ưu tiên · lớp thiết bị · các bước · kết quả đúng · bằng chứng`

Lớp thiết bị: `http` | `browser` | `sim` | `physical`.
Ưu tiên: `P0` chặn launch · `P1` ghi gap, không tự thành GO · `OUT` ngoài MVP.

## 4. Suite A — Cạnh và sức khỏe

| ID | P | Lớp | Các bước | Đúng |
| --- | --- | --- | --- | --- |
| A01 | P0 | http | `GET /` marketing, portal, app, auth | 200 hoặc 302 hợp lệ; không 502 |
| A02 | P0 | http | Portal `/api/bff/me/subject` không cookie | 401 |
| A03 | P0 | http | App `/api/bff/me` không cookie | 401 |
| A04 | P0 | http | `GET https://app.vemoki.com/gate` không cookie | 307 `/auth?next=/gate` |
| A05 | P0 | http | Host ancafe và dath | Vẫn 200; không đổi conf |
| A06 | P1 | http | Cert các host vemoki còn hạn > 14 ngày | Ghi ngày hết hạn |

## 5. Suite B — Đăng nhập (ba client)

Client: `ticket-admin-web` (portal), `ticket-platform-web` (platform), `ticket-web` (app).

| ID | P | Lớp | Các bước | Đúng |
| --- | --- | --- | --- | --- |
| B01 | P0 | browser | Portal → Đăng nhập nhân sự → staff | Về `/` đã đăng nhập; shell có org, không kẹt «Cần đăng nhập» |
| B02 | P0 | http | Authorize portal | `redirect_uri=https://portal.vemoki.com/api/auth/callback`, scope `openid profile email`, có PKCE. **Không** `offline_access` |
| B03 | P0 | browser | Callback portal sau login | 307 về app, không 502 nginx |
| B04 | P0 | browser | App login staff `return=/gate` | Tới trang «Cổng check-in dự phòng» |
| B05 | P0 | http | Authorize app | `redirect_uri=https://app.vemoki.com/api/auth/callback`, scope không `offline_access` |
| B06 | P0 | browser | Attendee login portal | Không vào shell Owner; từ chối hoặc về bề mặt khách |
| B07 | P0 | browser | Sai mật khẩu | Ở lại Keycloak, không set cookie app |
| B08 | P0 | browser | Logout portal rồi mở `/` | Hết session; login lại được |
| B09 | P1 | browser | Logout app và portal không đá session bên kia | Ghi hành vi thực (cookie tách) |
| B10 | P0 | browser | Portal locale EN rồi login | `<html lang="en">` sau login; VI mặc định khi không cookie |

## 6. Suite C — Portal nhân sự (Owner)

Điều kiện: B01 PASS.

| ID | P | Lớp | Các bước | Đúng |
| --- | --- | --- | --- | --- |
| C01 | P0 | browser | Home sau login | Có tenant Aurora; không màn «Cần đăng nhập» |
| C02 | P0 | browser | Chọn event Aurora Night | Overview event mở, không 422 |
| C03 | P0 | browser | Nút «Mở cổng quét trên app» | `href` là `https://app.vemoki.com/gate`, tab mới. **Cấm** `127.0.0.1` |
| C04 | P0 | browser | Members | Danh sách tải; không lộ tenant khác |
| C05 | P1 | browser | Mời thành viên (không gửi email khách) | Form chặn địa chỉ không hợp lệ; không gửi SMTP thật trong UAT |
| C06 | P1 | browser | Cấu hình event / quota / nguồn mã (chỉ đọc) | Số liệu hiện, không 500 |
| C07 | P1 | browser | Audit event | Có dòng hoặc empty state đúng copy, không lỗi kỹ thuật |
| C08 | P0 | browser | Đổi locale EN trên shell | Nhãn chính EN; reload giữ cookie |
| C09 | P1 | browser | Metadata tab trình duyệt EN | Ghi gap nếu title vẫn VI (P1 i18n đã hoãn) |

## 7. Suite D — Khách trên app web

| ID | P | Lớp | Các bước | Đúng |
| --- | --- | --- | --- | --- |
| D01 | P0 | browser | Attendee mở `/` app | Chrome khách, không nút quản trị tenant |
| D02 | P0 | browser | Redeem mã demo còn hiệu lực (lấy mã từ seed/event UAT, không bịa mã) | Vé hiện; QR hoặc trạng thái đã cấp |
| D03 | P0 | browser | Redeem mã sai | Từ chối, không tạo vé |
| D04 | P0 | browser | Redeem lại mã đã dùng | Không cấp vé thứ hai |
| D05 | P1 | browser | `/claim` và `/invite` không token | Trang lỗi có chủ đích, không 500 |
| D06 | P1 | browser | Viewport 390px redeem | Dùng được, không tràn nút chính |
| D07 | P1 | browser | Marketing EN → bấm vào app | Ghi locale **không** đi theo (gap đã biết) — không FAIL P0 |

## 8. Suite E — Cổng web (dự phòng, online)

Điều kiện: B04 + C03. Cổng web **không** xếp hàng offline.

| ID | P | Lớp | Các bước | Đúng |
| --- | --- | --- | --- | --- |
| E01 | P0 | browser | Staff mở `/gate` | Có form phiên; copy «Chưa rõ / không cho khách qua» khi lỗi |
| E02 | P0 | browser | Mở phiên với tenant + event Aurora | Phiên mở, không `TENANT_REQUIRED` |
| E03 | P0 | browser | Giữ chỗ + xác nhận một ticket ID hợp lệ chưa check-in | Trạng thái cho vào chỉ sau phản hồi hệ thống |
| E04 | P0 | browser | Xác nhận lại cùng vé | Từ chối trùng; không cho vào lần hai |
| E05 | P0 | browser | Ticket ID không tồn tại | Từ chối, không 500 |
| E06 | P1 | browser | DevTools offline giữa chừng | UI «Chưa rõ», không tự cho vào |
| E07 | P0 | browser | Attendee mở `/gate` | Không mở được phiên staff |

Camera cổng **ngày diễn** là app nhân viên (suite G), không phải trang này.

## 9. Suite F — iOS khách (Simulator)

Build local, team `BLUA62D52G`, không EAS.

| ID | P | Lớp | Các bước | Đúng |
| --- | --- | --- | --- | --- |
| F01 | P0 | sim | Cold launch **chưa đăng nhập** | Stack **Đăng nhập + Đổi mã**; **không** NativeTabs, **không** catalog tab Sự kiện / Tài khoản / Vé. Login = CTA header (`person.circle`). Không section thông báo/phiên trống. Không crash. **Không** PASS bằng «home = guest event catalog» cũ |
| F02 | P0 | sim | Login attendee verified | Tabs **Sự kiện + Vé của tôi** only; Account qua header; **không** tab Tài khoản. Session khách |
| F03 | P0 | sim | Ví vé (tab Vé của tôi) | Vé đã redeem hiện; QR đọc được bằng mắt trên screenshot |
| F04 | P0 | sim | Tab Nhân viên khi login attendee | Ẩn (O02). Không tab Account attendee |
| F05 | P1 | sim | Airplane mode, mở vé đã lưu | Vé local còn; không bịa trạng thái đã check-in |
| F06 | P1 | sim | Deep link invite | Không `Unmatched Route` |
| F07 | P0 | sim | Mở «Chính sách quyền riêng tư» | Màn **native**; **không** WebView / webpage in-app |

## 10. Suite G — iOS nhân viên, thiết bị thật

**DEFERRED 2026-10-19; cập nhật 2026-10-21:** G01–G03 đã có bằng chứng thiết bị thật (smoke tay trước khi gửi Beta App Review). G04–G06 vẫn chưa chạy. Simulator không được ghi `PASS` thay các dòng này.

| ID | P | Lớp | Các bước | Đúng |
| --- | --- | --- | --- | --- |
| G01 | **PASS** (TestFlight) | physical | Cài bản local signed lên máy thật | Mở app, team cá nhân. **Đã chạy 2026-10-21** trên DatHN iPhone 15 Pro, bản cài từ **TestFlight 1.0.0 (26)** (không phải local signed): [D13-TF-BETA-SUBMITTED-2026-10-21.md](../reviews/D13-TF-BETA-SUBMITTED-2026-10-21.md) |
| G02 | **PASS** | physical | Login staff, tab Nhân viên | Tab hiện vì có quyền. `review-staff@vemoki.com`, build 26, 2026-10-21: [D13-TF-BETA-SUBMITTED-2026-10-21.md](../reviews/D13-TF-BETA-SUBMITTED-2026-10-21.md) |
| G03 | **PASS** | physical | Quét QR vé thật (suite D/E) | Một lần cho vào. Camera thật, «Đã vào cổng», server ghi check-in thật; vé đã undo/cấp spare: [D13-TF-BETA-SUBMITTED-2026-10-21.md](../reviews/D13-TF-BETA-SUBMITTED-2026-10-21.md) |
| G04 | DEFERRED (chưa có bằng chứng) | physical | Quét lại cùng QR | Từ chối trùng |
| G05 | DEFERRED (chưa có bằng chứng) | physical | Từ chối quyền camera | Thông báo, không crash, không cho vào |
| G06 | DEFERRED (chưa có bằng chứng) | physical | Mất mạng lúc quét | «Chưa rõ», không cho vào; không hàng đợi offline trừ khi D7 đã bật trên build này |
| G07 | P1 | sim hoặc physical | Staff Scan (và tab dùng `StaffGateScreenChrome`) | Đổi sự kiện **chỉ trên header**, icon SF (không text-only). **Không** picker sự kiện trùng trong body ([O27](../DECISION-LOG.md)). Không FAIL case G vì thiếu sticky/body picker cũ |

## 11. Suite H — Thư và push

| ID | P | Lớp | Các bước | Đúng |
| --- | --- | --- | --- | --- |
| H01 | **PASS** (sandbox + production) | physical | Push giao dịch tới máy đã cấp quyền | Trạng thái **DELIVERED** trên máy, không chỉ outbox `ACCEPTED`. Sandbox: Dexter iPhone 16 Pro, 2026-10-17 ([D5-APNS-DEVICE-UAT-STATUS.md](../reviews/D5-APNS-DEVICE-UAT-STATUS.md)). **Production: DatHN iPhone, TestFlight 1.0.0 (26), 2026-10-21** — hai push thử qua endpoint production hiện trên máy (chủ dự án xác nhận). Phát hiện: build 26 đăng ký token production với nhãn `environment=sandbox` → server gửi sai host và thu hồi token; đã vá phía server (PR #749, deploy 17cce6b). Chưa chạy end-to-end qua outbox thật (cấp vé) để thấy nhãn DB tự sửa |
| H02 | P1 | http | Mailpit/log worker | Chỉ chứng minh pipeline; **không** thay inbox thật |
| H03 | P0 | — | Inbox thật (nếu launch gửi mail khách) | Có thư tới hộp kiểm soát, SPF/DKIM ghi nhận. Chưa có hộp kiểm soát → `BLOCKED`. **PASS 2026-10-21**: SPF/DKIM/DMARC pass, vào Hộp thư đến — xem mục H03 trong [UAT-PROD-WEB-2026-10-21.md](../reviews/UAT-PROD-WEB-2026-10-21.md) |

## 12. Suite I — Cách ly tenant và platform

| ID | P | Lớp | Các bước | Đúng |
| --- | --- | --- | --- | --- |
| I01 | P0 | browser | Staff Aurora gọi dữ liệu tenant khác (đổi id trên URL) | 403/404, không thấy event lạ |
| I02 | P0 | http | API `/v1/me/events` không token | 401, không 422 `PLATFORM_MISCONFIGURED` |
| I03 | P1 | browser | Vào `/platform` bằng staff thường | Không có quyền platform thì từ chối |
| I04 | P1 | browser | Operator platform (nếu có user demo riêng; không thì `BLOCKED`) | Thấy tenant, không sửa nhầm Aurora |

## 13. Suite J — Vận hành (chỉ đọc)

| ID | P | Lớp | Các bước | Đúng |
| --- | --- | --- | --- | --- |
| J01 | P0 | http | Portal `PRODUCT_ORIGIN` trong container | `https://app.vemoki.com` |
| J02 | P0 | http | Portal và app `OIDC_SCOPES` | `openid profile email` |
| J03 | P0 | http | API có `PLATFORM_INVITE_TTL_SECONDS`, support TTL, MFA auth time, ACR `2`, audience | Process env có mặt; **không** in secret |
| J04 | P0 | — | So khớp `infra/deploy/compose.yaml` trên git với VPS | Lệch thì ghi **drift**, P0 `FAIL` cho mục «launch từ git» |
| J05 | P1 | — | Backup prod | `d5-backup-drill` trên Postgres bỏ đi **không** tính là backup prod. Chưa có backup prod → gap P1, ghi rõ |
| J06 | P0 | http | Nginx portal `proxy_buffer_size` ≥ 32k | Callback login không 502 |

## 14. Suite K — Ngoài phạm vi (không chấm fail)

| ID | Kết quả bắt buộc | Lý do |
| --- | --- | --- |
| K01 | N/A | Android native / Google Play |
| K02 | N/A | Thanh toán, refund, chuyển nhượng |
| K03 | N/A | Sơ đồ ghế |
| K04 | N/A | Apple Wallet / Google Wallet pass |
| K05 | N/A | EAS Cloud Build |
| K06 | N/A | SSO doanh nghiệp, billing |

## 15. Drift đã biết — phải chạy lại, không kế thừa PASS

Các mục sau đã vá trên VPS trong phiên 2026-10-19. Chúng **chưa** được xem là launch PASS cho đến khi suite tương ứng chạy trên catalog này và J04 hết lệch (hoặc lệch được ghi vào git rồi deploy lại).

| Việc trên VPS | Case phải chứng minh lại |
| --- | --- |
| Portal scope bỏ `offline_access` | B02, B03, J02 |
| Nginx buffer callback | B03, J06 |
| API `PLATFORM_*` | C01, I02, J03 |
| Nút cổng lấy origin từ server, không `127.0.0.1` | C03, E01 |
| Portal `lang` từ cookie | B10, C08 |
| Portal sider nhóm + home unauth → Keycloak (spinner) | B01, B08; **bổ sung** catalog nav P1–P3 [PORTAL-PROD-UAT-NAV-2026-10-19.md](../reviews/PORTAL-PROD-UAT-NAV-2026-10-19.md) và DoD [PORTAL-NAV-SPINNER-WIP-DOD-2026-10-19.md](../reviews/PORTAL-NAV-SPINNER-WIP-DOD-2026-10-19.md) — **không** thay case B06 (attendee từ chối portal) |

## 16. Thứ tự chạy (khi được lệnh thực thi)

Không chạy trong lượt thiết kế này.

1. **Sóng 0** — một worker `Sora · uat`: suite A + J (chỉ đọc). Fail A/J thì dừng, không login hàng loạt.
2. **Sóng 1** — cùng role, tuần tự vì chung demo user: B → C → D → E → I.
3. **Sóng 2** — `Zico · ios` build + `Sora · uat` hoặc Zico nếu Spec giao: suite F trên Simulator.
4. **Sóng 3** — máy thật (G, H01): **hoãn**. Không spawn, không ghi `PASS`.
5. **Sóng 4** — `James · dod+sec` đọc artifact, không chạy lại hết. Verdict `GO`/`NO-GO` theo P0 còn lại. Session James ≠ Sora.

Cost tier worker: `standard`, model `composer-2.5`.

## 17. Mẫu verdict

```text
Launch: NO-GO | GO
P0: pass n / fail n / blocked n / not-run n
P1 gaps: …
Deferred: G04–G06 (máy thật). G01–G03 PASS (TestFlight build 26, 2026-10-21); H01 PASS (sandbox 2026-10-17, production 2026-10-21)
Drift git↔VPS: có | không
Catalog SHA: …
Artifact: docs/reviews/PROD-LAUNCH-UAT-<date>.md
```

Suite G và H01 hoãn không làm đợt này thành NO-GO. Các P0 còn lại vẫn chặn.
