# D10-S3-T2 — App Review notes + tài khoản demo

**Issue:** [#159](https://github.com/hangndat/ticket-solution/issues/159) · Parent [#157](https://github.com/hangndat/ticket-solution/issues/157) · Epic [#150](https://github.com/hangndat/ticket-solution/issues/150)  
**Mục đích:** văn bản dán vào ASC → App Review Information.  
**Cấm:** coi credential dưới đây là prod secret; **không** escalate demo thành owner platform; **không** submit store từ task docs này.

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

DEMO ACCOUNTS (fixture / review only — not production operator secrets)
Please use the accounts in the “Sign-in required” fields (also listed below).
1) Attendee — open My Tickets / wallet after sign-in.
2) Staff — open the gate scanner, allow Camera when prompted, scan a demo ticket QR if provided in the build’s demo tenant, or use manual entry if shown for the role.

CAMERA
Camera permission is requested only for scanning ticket QR codes at the gate
(usage string: “Scan ticket QR codes at the gate.”). We do not need photo library access for standard scan.

NOTIFICATIONS
Push uses Apple APNs directly (device token registered with our API). Declining notifications still allows ticket viewing and scan.

ACCOUNT DELETION
Account → request deletion creates an acknowledged request (not instant full erasure while retention policy is finalized). This matches our Privacy Policy.

OUT OF SCOPE / PLEASE IGNORE
• Android build (iOS-only).
• Paid in-app ticket checkout (not in this version).
• Expo/EAS Cloud Build is not used; binaries are produced with local Xcode.

If login fails because the review build points at a staging host, please retry on the network without VPN blocking our API/OIDC hostnames, or contact us at the Review Contact email—we will respond quickly with a refreshed demo tenant.
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

Trước khi gửi bản build production cho review, operator tạo **tenant demo** + 2 user review trên IdP production và paste **chỉ trong ASC**:

| Field ASC | Giá trị |
| --- | --- |
| User name | `[REVIEW_ATTENDEE_EMAIL — ASC only]` |
| Password | `[REVIEW_ATTENDEE_PASSWORD — ASC only]` |
| Notes thêm 1 dòng | “Staff scanner: `[REVIEW_STAFF_EMAIL]` / `[REVIEW_STAFF_PASSWORD]` (Camera required).” |

Checklist operator (không lưu password vào git):

1. Tạo user review riêng, mật khẩu xoay sau mỗi đợt review.  
2. Gán attendee có ≥1 vé ACTIVE + staff có quyền `gate.confirm` trên event demo.  
3. Xác nhận deep link / OIDC redirect của binary khớp host production.  
4. Paste credential vào ASC → Save; **không** mở PR chứa password.

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

1. Launch app → **Sign in** → IdP login form.  
2. Attendee: mở danh sách vé → mở 1 vé → hiển thị QR.  
3. Sign out → Staff: cho phép Camera → màn hình quét → quét QR vé demo (hoặc mã test do contact cung cấp).  
4. (Optional) Account → yêu cầu xóa tài khoản → xác nhận ACK (không kỳ vọng dữ liệu biến mất ngay).

---

## Checklist nghiệm thu (#159)

- [x] Notes EN sẵn sàng paste ASC  
- [x] Demo attendee/staff fixture ghi rõ (không phải prod secret)  
- [x] Quy trình credential production-only-in-ASC  
- [x] Camera / notifications / deletion / OIDC giải thích cho reviewer  
- [ ] Operator paste credential prod-demo vào ASC khi có binary TestFlight (ngoài docs)
