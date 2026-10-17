# D10-S3-T1 — Privacy Nutrition Labels + policy URL

**Issue:** [#158](https://github.com/hangndat/ticket-solution/issues/158) · Parent [#157](https://github.com/hangndat/ticket-solution/issues/157) · Epic [#150](https://github.com/hangndat/ticket-solution/issues/150)  
**Không commit PII người dùng thật.** Labels dưới đây dựa trên hành vi app/API đã có (OIDC, vé, device token, camera scan, account-deletion request).

---

## Privacy Policy URL

| Mục | Giá trị |
| --- | --- |
| URL khai báo ASC | `https://vemoki.com/privacy` |
| Draft nội dung | [privacy-policy-draft.md](./privacy-policy-draft.md) |
| Trạng thái host (kiểm tra 2026-10-17) | `GET https://vemoki.com/privacy` → **HTTP 404** |
| Việc còn lại trước submit | Publish HTML/route privacy (coordinator/web) trỏ nội dung draft hoặc bản pháp lý đã duyệt; xác nhận **200** công khai |

Support / data contact (trong policy): `privacy@vemoki.com` (alias dự kiến) hoặc `hangndat@gmail.com` cho đến khi alias production sẵn sàng — **không** đăng mật khẩu.

Account deletion: in-app **Yêu cầu xóa tài khoản** → `POST /v1/me/account-deletion-requests` (ACK `AWAITING_POLICY` / O06 chưa chốt erase). Policy phải mô tả request-only, không hứa xóa ngay.

---

## Data collection summary (Nutrition Labels)

Apple nhóm: Data Used to Track You · Data Linked to You · Data Not Linked to You.

**Tracking:** **Không** dùng dữ liệu để track across apps/sites của công ty khác (không SDK quảng cáo bên thứ ba trong MVP). → trả lời **No** cho “used to track you” trừ khi sau này thêm ATT/ads (ngoài phạm vi).

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
| Product Interaction | Minimal / server logs | May be linked via auth | App Functionality / Analytics (nếu bật sau) | Không analytics SaaS bên thứ ba trong MVP; server access logs self-host |
| Crash Data | Optional (Xcode Organizer / self-host) | Prefer Not Linked | App Functionality | Không commit crash PII |

### Other Data

| Data type | Collect? | Linked? | Purpose | Notes |
| --- | --- | --- | --- | --- |
| Other User Content | Yes — ticket / QR display payload | Linked | App Functionality | Vé thuộc user; QR hiển thị |
| Photos or Videos | No library save required | — | — | Camera dùng **scan QR** realtime, không lưu thư viện theo mặc định |
| Audio Data | No | — | `recordAudioAndroid: false`; iOS không xin mic cho scan | |
| Precise Location | No | — | Không Core Location cho MVP | |
| Coarse Location | No | — | | |
| Sensitive Info | No | — | | |
| Health & Fitness | No | — | | |
| Financial Info | No | — | | |
| Search History | No | — | | |
| Browsing History | No | — | | |

### Camera & notifications (permissions — không phải Nutrition row riêng nhưng bắt buộc minh bạch)

| Permission | Usage string (EN in binary) | Mục đích |
| --- | --- | --- |
| Camera | “Scan ticket QR codes at the gate.” | Staff check-in |
| Notifications | Hệ thống iOS prompt | Ticket delivery / event reminders (APNs) |

Khai báo trong Privacy Policy + Review notes; Nutrition Labels không có dòng “Camera” riêng — dữ liệu quét không lưu ảnh theo mặc định → không tick Photos trừ khi sau này lưu ảnh.

---

## Gợi ý chọn nhanh trên ASC UI

1. Data Collection: **Yes, we collect data from this app**  
2. Tracking: **No**  
3. Thêm các loại: Email, User ID, Device ID, Other User Content (tickets); Name/Phone chỉ nếu form event thu thập  
4. Mọi loại trên: **Linked to the user’s identity** + purpose **App Functionality**  
5. Không tick Advertising / Third-Party Advertising cho MVP  
6. Privacy Policy URL: `https://vemoki.com/privacy` (sau khi host 200)

---

## Checklist nghiệm thu (#158)

- [x] Bảng Nutrition Labels + rationale  
- [x] Policy URL chỉ định + gap host ghi rõ  
- [x] Draft policy tách file  
- [x] Không commit PII  
- [ ] Publish URL 200 (blocker **submit**, không blocker docs Chờ duyệt)
