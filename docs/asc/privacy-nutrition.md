# D13 — Privacy Nutrition Labels + policy URL

**Epic:** [#301](https://github.com/hangndat/ticket-solution/issues/301) · Stories S1-T1 / S1-T2 (BA)  
**Reuse D10:** [#158](https://github.com/hangndat/ticket-solution/issues/158) / tip lịch sử `b1232f53d5fc` — **không** chứng minh ASC UI đã điền  
**Source đối chiếu:** `f551b6d2bdc06742f74a49a0970cb2bfae2f4e0e` (2026-10-18)  
**Artifact:** [D13-BA-PRIVACY-ELIGIBILITY.md](../reviews/D13-BA-PRIVACY-ELIGIBILITY.md)  
**Không commit PII người dùng thật.** Labels dựa trên hành vi app/API quan sát trong source (OIDC, vé, device token, camera scan, account-deletion) — **không** suy từ screenshot ASC cũ.

---

## Privacy Policy URL

| Mục | Giá trị |
| --- | --- |
| URL khai báo ASC | `https://vemoki.com/privacy` |
| EN companion | `https://vemoki.com/en/privacy` |
| Draft nội dung (canonical dài) | [privacy-policy-draft.md](./privacy-policy-draft.md) |
| Trạng thái host (đối chiếu 2026-10-18) | `GET https://vemoki.com/privacy` → **HTTP 200** (`/marketing/privacy`); meta/copy khớp số O06 |
| Việc còn lại trước submit | Điền Nutrition Labels trên ASC UI (G2 còn mở); làm giàu trang live nếu App Review cần chi tiết camera/deletion (S2-T3); **không** claim ASC đã paste |

Support / data contact (trong policy): `privacy@vemoki.com` (alias dự kiến) hoặc `hangndat@gmail.com` cho đến khi alias production sẵn sàng — **không** đăng mật khẩu.

Account deletion: in-app **Yêu cầu xóa tài khoản** → `POST /v1/me/account-deletion-requests`. O06 **đã chốt** (DECISION-LOG 2026-10-18): anonymize ≤ **30 ngày** sau chấp nhận — policy **không** hứa xóa ngay / không hứa xóa cứng audit trong TTL **730 ngày**.

---

## Data collection summary (Nutrition Labels)

Apple nhóm: Data Used to Track You · Data Linked to You · Data Not Linked to You.

**Tracking:** **Không** dùng dữ liệu để track across apps/sites của công ty khác (không SDK quảng cáo / ATT trong MVP). → trả lời **No** cho “used to track you” trừ khi sau này thêm ATT/ads (ngoài phạm vi).

### Contact Info

| Data type | Collect? | Linked to user? | Purpose (ASC) | Notes |
| --- | --- | --- | --- | --- |
| Email Address | Yes | Linked | App Functionality | OIDC / Keycloak identity; ticket delivery email trên web |
| Name | Optional / Yes if provided | Linked | App Functionality | Profile / guest import fields khi event thu thập |
| Phone Number | Chỉ nếu form event yêu cầu | Linked | App Functionality | Không bắt buộc bởi app shell |

### Identifiers

| Data type | Collect? | Linked? | Purpose | Notes |
| --- | --- | --- | --- | --- |
| User ID | Yes | Linked | App Functionality | Subject / `userId` từ `/v1/me` |
| Device ID | Yes (push) | Linked | App Functionality | APNs device token đăng ký qua API; **không** Expo Push SaaS |

### Purchases

| Data type | Collect? | Notes |
| --- | --- | --- |
| Purchase History | No (MVP) | Chưa bán vé trong app |

### Usage Data / Diagnostics

| Data type | Collect? | Linked? | Purpose | Notes |
| --- | --- | --- | --- | --- |
| Product Interaction | Minimal / server logs | May be linked via auth | App Functionality | Không analytics SaaS bên thứ ba trong MVP; server access logs self-host |
| Crash Data | Optional (Xcode Organizer / self-host) | Prefer Not Linked | App Functionality | Không commit crash PII; không Firebase Crashlytics trong `package.json` |

### Other Data

| Data type | Collect? | Linked? | Purpose | Notes |
| --- | --- | --- | --- | --- |
| Other User Content | Yes — ticket / QR display payload | Linked | App Functionality | Vé thuộc user; QR hiển thị |
| Photos or Videos | No library save required | — | — | Camera dùng **scan QR** realtime, không lưu thư viện theo mặc định |
| Audio Data | No | — | — | `recordAudioAndroid: false`; iOS không xin mic cho scan |
| Precise Location | No | — | — | Không Core Location cho MVP |
| Coarse Location | No | — | — | |
| Sensitive Info | No | — | — | |
| Health & Fitness | No | — | — | |
| Financial Info | No | — | — | |
| Search History | No | — | — | |
| Browsing History | No | — | — | |

### Camera & notifications (permissions — không phải Nutrition row riêng nhưng bắt buộc minh bạch)

| Permission | Usage string (EN in binary) | Mục đích |
| --- | --- | --- |
| Camera | “Scan ticket QR codes at the gate.” | Staff check-in (`expo-camera` trong `app.config.ts`) |
| Notifications | Hệ thống iOS prompt | Ticket delivery / event reminders (APNs via `expo-notifications`) |

Khai báo trong Privacy Policy + Review notes; Nutrition Labels không có dòng “Camera” riêng — dữ liệu quét không lưu ảnh theo mặc định → không tick Photos trừ khi sau này lưu ảnh.

---

## Third-party / SDK inventory (S1-T2 — source thắng)

Nguồn: `apps/mobile/package.json` + `apps/mobile/app.config.ts` tại SHA trên. **Không** có Firebase / Facebook / OneSignal / Google Sign-In / ad network trong dependencies trực tiếp.

| Module (direct) | Vai trò | Nutrition / privacy note |
| --- | --- | --- |
| `expo` / `expo-router` / RN shell | App runtime | Không thu PII riêng ngoài app code |
| `expo-auth-session` + `expo-web-browser` + `expo-crypto` | OIDC Auth Code + PKCE | Email / User ID qua IdP tự host — đã phủ Contact Info + Identifiers |
| `expo-secure-store` | Token storage on-device | Không upload keychain ra third-party |
| `expo-camera` | Gate QR scan | Không Photos library theo mặc định |
| `expo-notifications` | APNs registration | Device ID (push token) Linked + App Functionality |
| `expo-linking` / `expo-constants` / `expo-splash-screen` / UI kits | Navigation / config / chrome | Không data collection riêng cho Nutrition |
| `@ticket/contracts` | Workspace types | Không runtime telemetry |

**Apple “commonly used SDKs” list** ([third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/), đối chiếu 2026-10-18): không có SDK quảng cáo/analytics trong deps trực tiếp. React Native có thể kéo **Hermes** (có trong danh sách Apple) qua toolchain — **Privacy Manifest / Privacy Report** phải xác nhận lại sau `expo prebuild` local trước submit (S4), không bịa đã có `PrivacyInfo.xcprivacy` checked-in (repo **không** chứa file đó ở tip này).

**Architecture impact:** Không — Nutrition Labels hiện khớp inventory. Nếu sau này thêm analytics/ads SDK hoặc đổi telemetry contract → escalate Role `architect` (S1-T2b); **không** đổi contract trong task BA này.

---

## Gợi ý chọn nhanh trên ASC UI

1. Data Collection: **Yes, we collect data from this app**  
2. Tracking: **No**  
3. Thêm các loại: Email, User ID, Device ID, Other User Content (tickets); Name/Phone chỉ nếu form event thu thập  
4. Mọi loại trên: **Linked to the user’s identity** + purpose **App Functionality**  
5. Không tick Advertising / Third-Party Advertising cho MVP  
6. Privacy Policy URL: `https://vemoki.com/privacy` (**đã 200** tại ngày đối chiếu)

---

## Checklist nghiệm thu (D13 BA)

- [x] Bảng Nutrition Labels + rationale khớp O06 + source tip  
- [x] Policy URL 200 quan sát được (không chứng minh ASC đã paste)  
- [x] SDK inventory + non-goals (no ads SaaS)  
- [x] Draft policy tách file  
- [x] Không commit PII  
- [ ] ASC Privacy Nutrition UI đã điền + screenshot che secret (S3-T1 — ops)  
