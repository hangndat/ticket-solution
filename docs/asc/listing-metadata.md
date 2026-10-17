# D10-S1-T1 — ASC listing copy VI/EN + keywords

**Issue:** [#152](https://github.com/hangndat/ticket-solution/issues/152) · Parent [#151](https://github.com/hangndat/ticket-solution/issues/151) · Epic [#150](https://github.com/hangndat/ticket-solution/issues/150)  
**Bundle:** `com.hangndat.ticket` · Display name: **Vemoki** · Version app: `0.1.0` (buildNumber xem `apps/mobile/app.config.ts`)  
**Không submit store** — chỉ draft để dán vào App Store Connect.

Giới hạn ASC (nhắc): Name ≤30 · Subtitle ≤30 · Promotional Text ≤170 · Description ≤4000 · Keywords ≤100 (không khoảng sau dấu phẩy) · What’s New ≤4000.

---

## English (primary locale: en-US)

### App Name (30)

```
Vemoki
```

### Subtitle (30)

```
Event tickets & gate check-in
```

(28 chars including spaces)

### Promotional Text (170) — optional, editable without new binary

```
Vemoki helps organizers run events and attendees keep tickets handy. View your QR, get delivery updates, and let staff check guests in at the gate—online confirmation, clear results.
```

### Description (4000)

```
Vemoki is a multi-tenant event ticketing platform for organizers, agencies, and attendees.

FOR ATTENDEES
• Sign in securely and open the tickets issued to you
• Show a display QR at the gate (online check-in confirmation)
• Keep ticket details available when the network is weak (offline display; check-in still requires the server)
• Receive push updates about ticket delivery and event reminders when enabled

FOR EVENT STAFF
• Sign in with the roles your organizer assigned (scanner, supervisor, and related permissions)
• Scan guest QR codes at the gate with a clear accept / reject result
• Support lookup and resend flows according to your permissions—no improvised “override” paths

FOR ORGANIZERS (web companion)
• Configure events, ticket types, issuance sources, and quotas on the Vemoki web admin
• Redeem codes, import guests, and operate check-in with auditability
• Brand the guest experience per organization while sharing one secure platform

Vemoki is built for real operations: deny-by-default access, tenant isolation, and retry-safe ticket and check-in flows. Free/invite issuance is the focus of the first release; paid checkout is out of scope for this listing version.

Support: https://vemoki.com
Privacy: https://vemoki.com/privacy
```

### Keywords (100 max, comma-separated, no spaces after commas)

```
ticket,event,check-in,QR,gate,festival,venue,attendee,organizer,scanner,pass,redeem
```

Count check: `ticket,event,check-in,QR,gate,festival,venue,attendee,organizer,scanner,pass,redeem` = **88** characters.

### What’s New (first release)

```
First App Store listing preparation for Vemoki 0.1. Attendee wallet, secure sign-in, gate QR scan for staff, and push registration for delivery updates. Pilot-focused; not a claim of full production capacity.
```

### Support URL

`https://vemoki.com`

### Marketing URL (optional)

`https://vemoki.com`

### Category

- **Primary:** Entertainment  
- **Secondary:** Business  

---

## Tiếng Việt (locale: vi)

### Tên hiển thị (30)

```
Vemoki
```

### Phụ đề (30)

```
Vé sự kiện & check-in cổng
```

(27 ký tự kể cả khoảng trắng)

### Văn bản quảng bá (170)

```
Vemoki giúp BTC vận hành sự kiện và khách giữ vé trong tay. Xem QR, nhận thông báo giao vé, nhân viên check-in tại cổng—xác nhận online, kết quả rõ ràng.
```

### Mô tả

```
Vemoki là nền tảng vé sự kiện multi-tenant cho nhà tổ chức, agency và người tham dự.

CHO KHÁCH
• Đăng nhập an toàn và mở các vé đã được cấp
• Xuất trình mã QR tại cổng (check-in xác nhận online)
• Xem thông tin vé khi mạng yếu (hiển thị offline; check-in vẫn cần máy chủ)
• Nhận thông báo đẩy về giao vé / nhắc sự kiện khi bật quyền thông báo

CHO NHÂN VIÊN SỰ KIỆN
• Đăng nhập theo vai trò BTC đã gán (scanner, supervisor, …)
• Quét QR khách tại cổng với kết quả chấp nhận / từ chối rõ
• Tra cứu hỗ trợ theo đúng quyền—không có đường “bypass” tự ý

CHO BTC (web kèm theo)
• Cấu hình sự kiện, loại vé, nguồn phát hành, hạn mức trên web admin Vemoki
• Đổi mã, import khách mời, vận hành check-in có dấu vết
• Nhận diện thương hiệu theo tổ chức trên một nền tảng dùng chung an toàn

Vemoki hướng tới vận hành thật: quyền deny-by-default, tách dữ liệu theo tenant, luồng vé/check-in chịu được thử lại. Bản đầu tập trung vé miễn phí / khách mời; thanh toán bán vé chưa thuộc phiên bản listing này.

Hỗ trợ: https://vemoki.com
Quyền riêng tư: https://vemoki.com/privacy
```

### Từ khóa (≤100)

```
vé,sựkiện,check-in,QR,cổng,lễhội,khách,BTC,quétvé,đổimã,pass
```

Lưu ý ASC: keywords **một chuỗi dùng chung** cho app (không tách theo locale trên mọi phiên bản UI). Ưu tiên dán chuỗi **English** ở trên vào field Keywords ASC; chuỗi VI chỉ là gợi ý nội địa hóa / ASO nội bộ.

### Có gì mới

```
Chuẩn bị listing App Store đầu tiên cho Vemoki 0.1. Ví vé khách, đăng nhập bảo mật, quét QR cổng cho nhân viên, đăng ký đẩy cho cập nhật giao vé. Tập trung pilot—không tuyên bố năng lực production đầy đủ.
```

---

## Ghi chú ASO / tuân thủ

- Không dùng tên đối thủ, không mention TikTok, không claim “#1” / “50k concurrent” khi chưa có evidence.
- Không hứa offline check-in đa thiết bị (ngoài phạm vi release đầu).
- Tên trên Home Screen lấy từ `CFBundleDisplayName` / Expo `name: Vemoki` — khớp listing.
