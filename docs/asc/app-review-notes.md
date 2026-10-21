# D13 — App Review notes + tài khoản demo

**Epic:** [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story S3-T3 (BA refresh sau O06)  
**Reuse D10:** [#159](https://github.com/hangndat/ticket-solution/issues/159) — copy cũ nói “retention chưa finalize” là **stale**; bản này khớp O06  
**Source tip đối chiếu (S3-T3):** `f551b6d2bdc06742f74a49a0970cb2bfae2f4e0e`  
**S5-T2 refresh:** xem `docs/reviews/D13-S5-T2-DEMO-REVIEWER.md` (prod IdP verify; tip SHA = commit PR docs)  
**Mục đích:** văn bản dán vào ASC → App Review Information.  
**Cấm:** coi credential dưới đây là prod secret; **không** escalate demo thành owner platform; **không** submit store từ task docs này; **không** commit mật khẩu production.

---

## Text dán vào “Notes” (EN — ASC mặc định)

```
Thank you for reviewing Vemoki (com.hangndat.ticket).

WHAT THE APP IS
Vemoki is a multi-tenant event ticketing and gate check-in app.
• Attendees: sign in, view issued tickets, show a display QR at the gate.
• Staff (role-gated): scan guest QR codes for online check-in confirmation.
Organizers configure events mainly on the web companion at https://vemoki.com.

SIGN-IN
Authentication uses our self-hosted OpenID Connect provider (Keycloak), Authorization Code + PKCE.
There is no “passwordless bypass” or mock staff mode in production paths.
Sign in with Apple is not required for this release because we use our own OIDC IdP.

SIGN-IN PERFORMANCE
The Keycloak login page may take a few seconds to load on first open; please wait before retrying. Email verification and password reset use our live SMTP (delivery may take a minute).

DEMO ACCOUNTS (review only — passwords only in App Store Connect / VPS secret file, not in this repo)
Dedicated production IdP accounts for Apple review:
• Attendee: review-attendee@vemoki.com
• Staff: review-staff@vemoki.com
Alternate end-to-end fixture (recommended for “Sign-in required” if you need a wallet with an ACTIVE ticket):
• Attendee: attendee@example.com
• Staff: staff@example.com
Use the username/password fields we entered in ASC for the matching account.

ATTENDEE FLOW
Sign in → My Tickets → open one ticket → display QR at full brightness for gate check-in.

STAFF FLOW / QR SCAN
Sign in as staff → allow Camera → open gate scanner.
Scan either: (1) a static ticket QR image we attach to review notes or email, or (2) a live QR displayed on a second device signed in as the attendee account above.
Staff role requires gate.confirm permission on our demo tenant.

CAMERA
Camera permission is requested only for scanning ticket QR codes at the gate
(usage string: “Scan ticket QR codes at the gate.”). We do not need photo library access for standard scan.

NOTIFICATIONS
Push uses Apple APNs directly (device token registered with our API). Declining notifications still allows ticket viewing and scan.

ACCOUNT DELETION (Guideline 5.1.1(v) / O06)
Signed-in users: Account → “Yêu cầu xóa tài khoản” (Request account deletion).
This creates an acknowledged API request (POST /v1/me/account-deletion-requests).
Acknowledgement is not instant hard erasure: we anonymize associated account PII within ≤ 30 days per our published retention policy (https://vemoki.com/privacy). Audit logs may be retained up to 730 days. We do not require a phone call or email support ticket to initiate deletion.

PRIVACY
Privacy Policy URL: https://vemoki.com/privacy (also /en/privacy).
No third-party advertising SDKs; App Tracking Transparency is not used in this MVP.

OUT OF SCOPE / PLEASE IGNORE
• Paid in-app ticket checkout (not in this version).

If login fails, ensure VPN or corporate DNS is not blocking auth.vemoki.com or api.vemoki.com. Contact us at the Review Contact email—we respond quickly with refreshed demo access or a QR attachment.
```

---

## Tài khoản demo — ASC “Sign-in required”

### A) Local / realm fixture (đã có trong repo Keycloak import — **không phải prod secret**)

Dùng khi binary review trỏ môi trường có realm import `infra/keycloak/realm-ticket.json` (hoặc staging đồng hình):

| Role | Username / email | Password | Việc reviewer làm |
| --- | --- | --- | --- |
| Attendee | `attendee@example.com` | `attendee-demo` | Sign in → My Tickets / ví vé |
| Staff | `staff@example.com` | `staff-demo` | Sign in → scanner / camera QR |

Nguồn đã công bố nội bộ: `docs/reviews/D1-P4-KEYCLOAK-SMOKE.md` (`emailVerified=true`).

**Lưu ý MFA:** staff có thể bị `CONFIGURE_TOTP` trên một số môi trường. Nếu Sign-in bị chặn TOTP: dùng attendee cho ví vé; liên hệ contact review để clear required action trên tài khoản demo **hoặc** cung cấp staff demo không MFA cho đợt review.

### B) Production / TestFlight review (điền vào ASC UI — **không commit mật khẩu prod**)

**S5-T2 (revalidation 2026-10-19):** IdP prod + ROPC re-sync từ VPS secret file. Evidence: [D13-S5-T2-DEMO-REVIEWER.md](../reviews/D13-S5-T2-DEMO-REVIEWER.md).

**Khuyến nghị paste ASC (end-to-end app path):** cặp fixture §A — đã ROPC OK trên prod; attendee có vé `ACTIVE`; staff có `gate.confirm` (không còn `CONFIGURE_TOTP`).

**Dedicated emails (IdP prod — S5-T2):** `review-attendee@vemoki.com` / `review-staff@vemoki.com` — mật khẩu **chỉ** trong file VPS + paste ASC; ROPC OK trên prod. Staff có `gate.confirm` trên tenant `uat-device`. Attendee dedicated: IdP OK; ví vé đầy đủ — ưu tiên fixture `attendee@example.com` (1 vé ACTIVE) nếu reviewer cần ticket ngay trong app.

| Field ASC | Giá trị đề xuất |
| --- | --- |
| User name (primary) | `attendee@example.com` **hoặc** `review-attendee@vemoki.com` |
| Password | Keys `FIXTURE_*` / `REVIEW_*` trong `/opt/vemoki/secrets/app-review/asc-sign-in-required.txt` — **ASC only** |
| Notes thêm | “Staff scanner: `review-staff@vemoki.com` hoặc `staff@example.com` + password ASC (Camera). Quét QR: ảnh đính kèm hoặc attendee trên thiết bị thứ hai. Keycloak login có thể chậm vài giây; email verify/reset qua SMTP thật.” |

Checklist operator (không lưu password vào git):

1. Đọc secret file VPS `asc-sign-in-required.txt` (mode 600); xoay mật khẩu sau mỗi đợt review.  
2. ASC primary: fixture attendee (≥1 vé ACTIVE) + staff (`gate.confirm`) trên tenant demo `uat-device`.  
3. Xác nhận deep link / OIDC redirect của binary khớp host production (`auth.vemoki.com` / `api.vemoki.com`).  
4. Paste credential vào ASC → Save; **không** mở PR chứa password.  
5. Paste ASC UI vẫn **chờ** binary TestFlight/Review (không làm trong S5-T2 docs-only).

---

## Contact Review (ASC)

| Field | Giá trị |
| --- | --- |
| First name | Hang |
| Last name | Nguyen Dat |
| Phone | *[số thật — chỉ ASC UI]* |
| Email | `hangndat@gmail.com` |

---

## Hướng dẫn nhanh cho reviewer (bước UI)

1. Launch app → **Sign in** → form Keycloak (có thể chờ vài giây lần đầu).  
2. Attendee (`review-attendee@vemoki.com` hoặc `attendee@example.com`): **Vé của tôi** → mở 1 vé → QR hiển thị.  
3. Sign out → Staff (`review-staff@vemoki.com` hoặc `staff@example.com`): cho phép **Camera** → quét QR từ **ảnh đính kèm** review hoặc **màn hình thiết bị thứ hai** đang đăng nhập attendee.  
4. (Optional) Account → **Yêu cầu xóa tài khoản** → ACK (anonymize ≤ 30 ngày; không xóa tức thì).  
5. TestFlight external copy: [testflight-test-information.md](./testflight-test-information.md).

---

## Checklist nghiệm thu (D13 S3-T3)

- [x] Notes EN sẵn sàng paste ASC — **đã xóa** ngôn ngữ “retention chưa finalize”  
- [x] Account deletion khớp O06 ≤30d + audit 730d + Guideline 5.1.1(v)  
- [x] Demo attendee/staff fixture ghi rõ (không phải prod secret)  
- [x] Quy trình credential production-only-in-ASC  
- [x] Camera / notifications / deletion / OIDC giải thích cho reviewer  
- [x] Prod IdP demo accounts verified + secret file how-to (S5-T2) — xem `docs/reviews/D13-S5-T2-DEMO-REVIEWER.md`
- [ ] Operator paste credential vào ASC UI khi có binary TestFlight/Review (ops ASC — ngoài docs commit)  
