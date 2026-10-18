# D13 — ASC listing copy VI/EN + keywords (reuse D10)

**Epic D13:** [#301](https://github.com/hangndat/ticket-solution/issues/301)  
**Reuse D10:** [#152](https://github.com/hangndat/ticket-solution/issues/152) — copy dưới đây đã reconcile sau D7/D11 Gate offline queue  
**Bundle:** `com.hangndat.ticket` · Display name: **Vemoki**  
**Version trong source tip `f551b6d2bdc0…` / PR tip:** Expo `version` **`0.1.0`**, `ios.buildNumber` **`10`** (`apps/mobile/app.config.ts`)  
**Không submit store** — chỉ draft để dán vào App Store Connect.  
**Không tự chọn territory** — Availability chờ user chốt (đề xuất VN; xem plan D13).

Giới hạn ASC (nhắc): Name ≤30 · Subtitle ≤30 · Promotional Text ≤170 · Description ≤4000 · Keywords ≤100 **bytes** (comma-separated; Apple: [platform version information](https://developer.apple.com/help/app-store-connect/reference/platform-version-information/)) · What’s New ≤4000.

### Blocker — version ASC vs binary (iOS / coordinator quyết)

| Nguồn | Giá trị quan sát |
| ----- | ---------------- |
| Source `app.config.ts` | `0.1.0` (build `10`) |
| ASC (theo coordinator status 2026-10-18) | Version **`1.0`** · state **PREPARE_FOR_SUBMISSION** (không chứng minh từ worker này) |

**BA không bump `apps/mobile`.** Trước archive/submit: iOS hoặc coordinator phải **khớp** CFBundleShortVersionString với ASC version (đổi ASC về `0.1.0` **hoặc** bump binary + What’s New) — lệch = rủi ro App Review / What’s New sai binary.

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
Vemoki helps organizers run events and attendees keep tickets handy—QR at the gate, delivery updates, and clear online check-in.
```

### Description (4000)

```
Vemoki is a multi-tenant event ticketing platform for organizers, agencies, and attendees.

FOR ATTENDEES
• Sign in securely and open the tickets issued to you
• Show a display QR at the gate (online check-in confirmation)
• Keep ticket details available when the network is weak (offline display; final check-in still needs the server)
• Receive push updates about ticket delivery and event reminders when enabled

FOR EVENT STAFF
• Sign in with the roles your organizer assigned (scanner, supervisor, and related permissions)
• Scan guest QR codes at the gate with a clear accept / reject result
• When offline, queue a scan on this device and sync when connectivity returns—queued scans are not “admit” until the server confirms; cross-device offline dedupe is not guaranteed
• Support lookup and resend flows according to your permissions—no improvised “override” paths

FOR ORGANIZERS (web companion)
• Configure events, ticket types, issuance sources, and quotas on the Vemoki web admin
• Redeem codes, import guests, and operate check-in with auditability
• Brand the guest experience per organization while sharing one secure platform

Vemoki is built for real operations: deny-by-default access, tenant isolation, and retry-safe ticket and check-in flows. Free/invite issuance is the focus of this listing version; paid checkout is out of scope.

Support: https://vemoki.com
Privacy: https://vemoki.com/privacy
```

### Keywords (≤100 bytes, comma-separated; localized field — paste into **en-US** Keywords)

```
ticket,event,check-in,QR,gate,festival,venue,attendee,organizer,scanner,pass,redeem
```

Byte/character length (ASCII): **83** (≤100). Không đếm nhầm “88” từ bản D10.

### What’s New

```
App Store listing for Vemoki. Attendee ticket wallet, secure OIDC sign-in, staff gate QR scan with on-device offline queue + sync, and APNs registration for delivery updates. Align version string with the binary you upload before submit.
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
• Xem thông tin vé khi mạng yếu (hiển thị offline; check-in cuối vẫn cần máy chủ)
• Nhận thông báo đẩy về giao vé / nhắc sự kiện khi bật quyền thông báo

CHO NHÂN VIÊN SỰ KIỆN
• Đăng nhập theo vai trò BTC đã gán (scanner, supervisor, …)
• Quét QR khách tại cổng với kết quả chấp nhận / từ chối rõ
• Khi mất mạng: xếp hàng scan trên thiết bị này và đồng bộ khi có mạng — mục xếp hàng không được coi là “cho vào” trước khi máy chủ xác nhận; không chống trùng đa thiết bị khi còn offline
• Tra cứu hỗ trợ theo đúng quyền—không có đường “bypass” tự ý

CHO BTC (web kèm theo)
• Cấu hình sự kiện, loại vé, nguồn phát hành, hạn mức trên web admin Vemoki
• Đổi mã, import khách mời, vận hành check-in có dấu vết
• Nhận diện thương hiệu theo tổ chức trên một nền tảng dùng chung an toàn

Vemoki hướng tới vận hành thật: quyền deny-by-default, tách dữ liệu theo tenant, luồng vé/check-in chịu được thử lại. Bản listing này tập trung vé miễn phí / khách mời; thanh toán bán vé chưa thuộc phạm vi.

Hỗ trợ: https://vemoki.com
Quyền riêng tư: https://vemoki.com/privacy
```

### Từ khóa (locale **vi** — field Keywords riêng theo localization)

```
vé,sựkiện,check-in,QR,cổng,lễhội,khách,BTC,quétvé,đổimã,pass
```

Length (UTF-8 aware ops nên đếm byte ASC): chuỗi trên ≈ **60** ký tự hiển thị; kiểm tra lại byte count trong ASC UI trước Save.

**Keywords theo locale:** Apple cho phép Keywords **localize theo từng App Store localization** ([App Store version localizations](https://developer.apple.com/documentation/appstoreconnectapi/app-store-version-localizations); [Localize app information](https://developer.apple.com/help/app-store-connect/manage-app-information/localize-app-information/)). Bản D10 nói “một chuỗi dùng chung” là **sai** — dán EN vào locale en-US và VI vào locale Vietnamese riêng.

### Có gì mới

```
Listing App Store cho Vemoki. Ví vé khách, đăng nhập OIDC, quét QR cổng có hàng đợi offline trên thiết bị + đồng bộ, đăng ký APNs cho cập nhật giao vé. Khớp chuỗi version với binary trước khi submit.
```

---

## Ghi chú ASO / tuân thủ

- Không dùng tên đối thủ, không claim “#1” / “50k concurrent” khi chưa có evidence.
- **Có** mô tả offline Gate queue (D7/D11 source) — **không** hứa chống trùng đa thiết bị khi offline; **không** hứa admit trước khi server confirm.
- Không tự chọn Availability / territories trong docs này.
- Tên trên Home Screen lấy từ Expo `name: Vemoki` — khớp listing.
- What’s New / Version Number phải khớp binary tip submit (xem blocker phiên bản ở đầu file).
