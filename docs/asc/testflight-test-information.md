# D13 — TestFlight Test Information (external beta prep)

**Epic:** [#301](https://github.com/hangndat/ticket-solution/issues/301)  
**App:** Vemoki · `com.hangndat.ticket` · Team `BLUA62D52G`  
**Mục đích:** copy paste vào App Store Connect → **TestFlight** → **Test Information** và external tester group metadata.  
**Trạng thái:** draft sẵn sàng điền ASC — **chưa submit** Beta App Review; **chưa** gắn build vào external group từ task docs.

**Cấm (operator):** `Submit for Beta App Review`, tạo `betaAppReviewSubmission`, hoặc bật external testing với build cho đến khi **user duyệt** bước submit.

---

## Beta App Description (EN — ASC TestFlight)

```
Vemoki is an iOS app for event attendees and gate staff: secure sign-in, digital tickets with display QR, and camera-based check-in for authorized staff roles. This external beta validates sign-in (Keycloak OIDC), ticket wallet, push delivery hooks, and gate scan against our production API stack. Organizers still use the web admin at https://vemoki.com for event setup.
```

---

## What to Test

### English

```
Please focus on:

1) Sign-in — Use the demo accounts provided in TestFlight / App Review (Keycloak login may take a few seconds to load). Email verification and password reset use our live SMTP; allow time for delivery.

2) Attendee path — After sign-in, open My Tickets, open one ticket, and confirm the display QR renders. You may use review-attendee@vemoki.com (password in ASC only) or the fixture attendee with an ACTIVE ticket (see app-review-notes.md).

3) Staff path — Sign in as staff, allow Camera when prompted, open the gate scanner. Scan either: (a) a static QR image attached to this beta’s notes / contact email, or (b) a live QR shown on a second device logged in as attendee.

4) Account deletion — Account → “Request account deletion” should acknowledge the request (not instant erasure; see privacy policy).

5) Push (optional) — Accept notifications and confirm the app still works if you decline.

Report crashes, login failures, blank ticket QR, or scan errors with build number and steps.
```

### Tiếng Việt (nội bộ / tester VN)

```
Trọng tâm kiểm thử:

1) Đăng nhập — Dùng tài khoản demo trong TestFlight / App Review (trang Keycloak có thể tải chậm vài giây). Email xác minh và đặt lại mật khẩu dùng SMTP thật; chờ vài phút nếu cần.

2) Khách — Sau đăng nhập, mở Vé của tôi → mở một vé → kiểm tra QR hiển thị. Có thể dùng review-attendee@vemoki.com (mật khẩu chỉ trên ASC) hoặc attendee fixture có vé ACTIVE (xem app-review-notes.md).

3) Staff — Đăng nhập staff, cho phép Camera, mở màn quét cổng. Quét: (a) ảnh QR tĩnh đính kèm ghi chú beta / email liên hệ, hoặc (b) QR trên thiết bị thứ hai đã đăng nhập attendee.

4) Xóa tài khoản — Tài khoản → “Yêu cầu xóa tài khoản” phải có xác nhận (không xóa ngay; xem chính sách privacy).

5) Push (tuỳ chọn) — Bật/tắt thông báo và xác nhận app vẫn dùng được khi từ chối.

Báo lỗi kèm số build và các bước tái hiện.
```

---

## ASC field values (Test Information)

| Field | Giá trị | Ghi chú |
| --- | --- | --- |
| Beta App Description | EN block trên | TestFlight → Test Information |
| What to Test | EN block trên (VI cho tester nội bộ) | Cùng màn hình |
| Feedback Email | `hangndat@gmail.com` | Hoặc alias support khi có |
| Privacy Policy URL | `https://vemoki.com/privacy` | HTTP 200 — [privacy-nutrition.md](./privacy-nutrition.md) |
| Marketing URL | `https://vemoki.com` | Optional; khớp listing |
| Review contact — name | Hang Nguyen Dat | External Beta App Review |
| Review contact — phone | *[ASC UI only — không commit]* | |
| Review contact — email | `hangndat@gmail.com` | |

---

## Demo accounts (ASC / TestFlight — không commit password)

Paste **chỉ** vào ASC UI. Mật khẩu đọc từ VPS `/opt/vemoki/secrets/app-review/asc-sign-in-required.txt` (mode `600`). Chi tiết vai trò và quét QR: [app-review-notes.md](./app-review-notes.md).

| Role | Email (Sign-in required) | Password | Ghi chú |
| --- | --- | --- | --- |
| Attendee (dedicated) | `review-attendee@vemoki.com` | ASC only | IdP prod OK; vé ACTIVE — ưu tiên fixture `attendee@example.com` nếu cần ví vé đầy đủ |
| Staff (dedicated) | `review-staff@vemoki.com` | ASC only | `gate.confirm` trên tenant demo `uat-device` |
| Attendee (fixture E2E) | `attendee@example.com` | ASC only (`FIXTURE_*` trong secret file) | **Khuyến nghị** cho Apple Sign-in required — 1 vé ACTIVE |
| Staff (fixture E2E) | `staff@example.com` | ASC only | Camera bắt buộc; không MFA gate |

**QR cho staff scan:** đính kèm ảnh QR vé demo trong email feedback hoặc ASC attachment; hoặc hướng reviewer mở attendee trên thiết bị thứ hai.

Evidence IdP (không secret): [D13-S5-T2-DEMO-REVIEWER.md](../reviews/D13-S5-T2-DEMO-REVIEWER.md).

---

## License agreement (external testers)

- External testers chấp nhận **Apple Beta Software License Agreement** khi cài TestFlight.
- Vemoki **không** yêu cầu EULA riêng cho beta ngoài [Privacy Policy](https://vemoki.com/privacy) và điều khoản sử dụng site `https://vemoki.com`.
- Không thu phí trong app trong bản beta này (MVP không IAP checkout).

---

## Checklist — App Store Connect UI

**TestFlight → Test Information**

- [ ] Beta App Description (EN) pasted  
- [ ] What to Test (EN) pasted  
- [ ] Feedback email  
- [ ] Privacy Policy URL  
- [ ] Marketing URL (optional)  

**TestFlight → External Testing → group (e.g. “External Beta”)**

- [ ] Group created; testers invited hoặc public link (theo quyết định user)  
- [ ] Build đã upload local Xcode (**chưa** gắn build vào external group cho đến khi user duyệt)  
- [ ] Demo account + contact điền khớp [app-review-notes.md](./app-review-notes.md)  
- [ ] **Submit for Beta App Review** — ⛔ **CHỈ sau khi user duyệt** (không làm trong task docs / worker tự động)

**App Review Information (store version — liên kết)**

- [ ] Notes EN từ [app-review-notes.md](./app-review-notes.md)  
- [ ] Sign-in required = Yes + credential paste  

**Không claim:** đã submit Beta App Review · external group live · App Store release.

---

## Nghiệm thu docs

- [x] EN Beta Description + What to Test + VI mirror  
- [x] URLs, feedback, review contact fields  
- [x] Demo block trỏ secret VPS + dedicated `review-*@vemoki.com`  
- [x] Checklist ASC với gate user duyệt submit  
- [ ] Operator điền ASC + attach QR khi có binary TestFlight (ops)
