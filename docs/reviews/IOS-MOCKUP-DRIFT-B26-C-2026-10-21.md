# iOS mockup drift — Build 26 · Slice C (Staff/gate & điều hướng)

**Ngày:** 2026-10-21 · **Build:** `app.config.ts` `buildNumber: '26'` (commit `924d01d4` tham chiếu coordinator)  
**Phạm vi:** `staff-scan`, `staff-history`, `staff-manual`, `(tabs)/_layout`, redirect/guard, header/title, `apps/mobile/src/theme` + chrome gate dùng chung  
**Mockup (chỉ đọc):** `fix-prod-redeem-gate-1021/docs/plans/mobile-production-refactor/full-prototype.html` (screen ids `scan`, `manual`, `history`, staff tabs)  
**Code:** worktree `IOS-Refactor` · **Chế độ:** audit read-only, không commit  

## Tóm tắt số lệch

| Mức | Số dòng |
| --- | ---: |
| P0 | 3 |
| P1 | 12 |
| P2 | 5 |
| Khớp (ghi nhận) | 8 |

---

## Bảng đối chiếu

| Màn / vùng | Mockup (`full-prototype.html`) | Code hiện tại (file:line) | Lệch | Mức | Đề xuất sửa |
| --- | --- | --- | --- | --- | --- |
| Tab bar staff | 3 tab **Nhập tay · Scan · Lịch sử**; tab active tint `#e11d48` | `(tabs)/_layout.tsx` L65–76: thứ tự `staff-manual` → `staff-scan` → `staff-history`; `tintColor={theme.signal}` L56 | Khớp IA và thứ tự; label tab Scan = «Scan» (mockup tab cũng «Scan», màn scan large title mockup là «Quét vé» — xem hàng scan) | — | Giữ |
| Tab bar ẩn/hiện | Khách: Sự kiện + Tài khoản; staff: 3 tab + account icon trên bar | `_layout.tsx` L49–80: `showStaffTabs` ẩn attendee + `account` khi staff | Khớp ý «nhân viên không dùng tab Tài khoản attendee»; account qua toolbar `person` (chrome) | — | Giữ |
| Redirect mặc định Scan | Vào staff → màn `scan` | `staff-default-tab-redirect.tsx` L34–46 + `staff-default-tab-target.ts` L19–53 → `/(tabs)/staff-scan` | Khớp K-STAFF-01 | — | Giữ |
| Redirect sau «Quay lại quét» | `go('scan')` từ account staff | `staff-scan-tab-landing.ts` + test `staff-scan-navigation.test.ts`; copy `staffBackToGate` trong `screen-state-copy.ts` L104 | Khớp hành vi (flag landing → replace Scan) | — | Giữ |
| Guard tab staff | (mockup không mô phòng deny) | `staff-gate-tab-guard.tsx` L34–50 → guest/deny/loading | Ngoài mockup nhưng đúng fail-closed; không lệch UX mockup khi eligible | — | Giữ |
| Theme tokens | ink `#0B1220`, paper `#F4F6F8`, signal `#E11D48`, focus `#2563EB` | `theme/tokens.ts` L8–20; `colors.ts` L5–28; tab tint `theme.signal` `_layout.tsx` L56 | Khớp palette Live Pulse | — | Giữ |
| Font | System UI trong mockup | `theme/fonts.ts` L6–11: Sora + Be Vietnam Pro | Typography khác mockup tĩnh | P2 | Chấp nhận brand gate; spot-check Dynamic Type trên 3 tab staff |
| **staff-scan** — tiêu đề | Large title nội dung **«Quét vé»** (`title('Quét vé')`) | `staff-tab-titles.ts` L4 `scan: 'Scan'`; `staff-scan/_layout.tsx` L14–16; `staff-scan.tsx` L106 `largeTitle={false}` | Tab/stack hiện **«Scan»** (EN), không «Quét vé»; không large title như mockup | P1 | Đổi label tab + stack thành «Quét vé» hoặc tách tab label ngắn / title dài; bật large title nếu PD muốn khớp mockup |
| **staff-scan** — chrome sự kiện | Sticky **«MFest · Cổng chính»** + **«● Sẵn sàng»** (xanh) + **«Đổi ›»** | `staff-gate-ops-sticky.tsx` L43–58: `GateStatusStrip` (wifi/phiên/queue) + `machineLabel`; đổi sự kiện ở `staff-gate-screen-chrome.tsx` L43–61 menu toolbar, không sticky «Đổi» | Bố cục & copy trạng thiếu «Sẵn sàng»; đổi sự kiện không cùng vị trí mockup | P1 | Gom sticky theo mockup: tên sự kiện + trạng thái ready + CTA đổi; giữ icon mạng/queue phụ |
| **staff-scan** — nav title | Bar trên: wordmark **vemoki.** | `staff-gate-nav-title.ts` L4–13: nav title = **tên sự kiện**; `StaffGateScreenChrome` L29–33 | Nav hiển thị event name thay wordmark; mockup tách event xuống sticky | P1 | Chọn một: wordmark trên + sticky event (mockup) hoặc cập nhật mockup — tránh trùng event title + sticky |
| **staff-scan** — camera | Khung + chữ **«Đưa QR vào khung»**; vạch quét `#fb7391` | `gate-camera.tsx` L117–174: khung, vạch, reduce motion L50–60; **không** label trong khung | Thiếu copy hướng dẫn trong khung | P1 | Thêm `Text` accessibility-visible trong frame như mockup |
| **staff-scan** — hint dưới camera | «Camera tiếp tục sẵn sàng sau mỗi lượt quét.» | `staff-scan.tsx` L94–103: đoạn dài + nhắc tab Nhập tay/Lịch sử | Copy dài, giọng kỹ thuật hơn mockup | P2 | Rút gọn theo mockup; giữ a11y |
| **staff-scan** — toast kết quả | «Được vào» / «Vé đã được sử dụng» / «Không tìm thấy vé» (~3.4s fade) | `gate-outcome-copy.ts` L86–116: «Cho vào», «Đã check-in trước đó», «Không cho vào»; `staff-gate-scan-toast.tsx` + `SCAN_TOAST_FADE_MS` | Tiêu đề outcome khác mockup; deny không phân «không tìm thấy» vs «từ chối» | P1 | Map title theo PD; giữ timing fade |
| **staff-scan** — nền | Paper phẳng `#f4f6f8` | `staff-scan.tsx` L33 `AtmosphereWash` + `colors.paper` | Wash radial signal không có trong mockup staff | P2 | Tắt wash trên scan hoặc đồng bộ toàn staff |
| **staff-manual** — intro | «Dùng khi không thể đọc mã QR trên vé.» | `staff-manual.tsx` L38–41: **UUID / JSON từ QR**, phiên | Jargon kỹ thuật, lệch giọng production | **P0** | Thay bằng copy mockup + placeholder «Nhập mã trên vé» |
| **staff-manual** — field | Label **«Mã vé»**, input đơn dòng | `staff-manual.tsx` L42–66: `multiline`, placeholder implicit, a11y «Nhập mã vé hoặc JSON QR» | Layout/label khác; multiline cho JSON | P1 | Label + single-line primary; JSON advanced optional |
| **staff-manual** — CTA / flow | **«Kiểm tra vé»** → modal xác nhận trước «Xác nhận vào cổng» | `staff-manual.tsx` L67–85: **«Xử lý mã»** → `submitScan` trực tiếp | Thiếu bước xác nhận trước admit (mockup) | **P0** | Thêm sheet confirm ticket preview trước gate API |
| **staff-manual** — header | Large title **«Nhập tay»** | `staff-manual/_layout.tsx` L7–8 + `StaffGateScreenChrome` `largeTitle` default true L20 | Khớp large title tab | — | Giữ |
| **staff-history** — scope | «Trên thiết bị này · MFest» (muted) | `staff-gate-device-history-panel.tsx` L48–61: «Lịch sử trên máy này» + subtitle; **không** gắn tên sự kiện | Thiếu dòng phạm vi sự kiện đang chọn | P1 | Thêm `{gateScope.name}` dưới title khi có scope |
| **staff-history** — nhóm ngày | «Hôm nay · 24 tháng 10» + grouped rows | `staff-gate-device-history-panel.tsx` L96–150: list phẳng, không group theo ngày | Thiếu section header theo ngày | P1 | Group `deviceHistory` theo ngày locale VI |
| **staff-history** — tìm / tải thêm / lỗi / hết | Search «Tìm trong các lượt đã tải»; «Tải thêm lượt quét»; lỗi + «Thử lại»; foot «Đã xem hết…» / «Đã tải N lượt» | `staff-history.tsx` L24–54; panel L64–205 | Khớp chức năng & copy chính | — | Giữ |
| **staff-history** — empty | «Chưa có lượt quét trên thiết bị này.» | panel L84–88 | Khớp | — | Giữ |
| **staff-history** — header | Large title **«Lịch sử»** | `staff-history/_layout.tsx` L7–8 + chrome | Khớp | — | Giữ |
| Empty gate (chung 3 tab) | (mockup luôn có MFest — không state empty) | `staff-gate-empty-state.tsx` L20–40 «Chưa có sự kiện để quét» | Hợp lý production; không lệch mockup khi có scope | — | Giữ |
| Header options chung | «Thanh tiêu đề gọn» + nội dung cuộn | `tab-stack-options.ts` L29–53 large title manual/history; scan dùng `tabDetailStackScreenOptions` `staff-scan/_layout.tsx` L9–11 | Scan compact bar khớp ghi chú aside mockup; manual/history large title khớp | — | Giữ (chỉ đồng bộ title scan nếu đổi copy) |
| `StaffGateScreenChrome` | Account ○ trên bar; đổi sự kiện modal | L35–71: toolbar account + menu sự kiện + «Làm mới sự kiện» | Account entry khớp; đổi sự kiện UX khác sticky mockup | P1 | (Xem hàng sticky scan) |

---

## Kết luận theo màn (bắt buộc)

| Màn | Kết luận |
| --- | --- |
| **Tab bar + `_layout`** | **Khớp** IA 3 tab, thứ tự, tint signal, ẩn attendee/account khi staff. |
| **Navigation redirect / guard** | **Khớp** landing Scan, «Quay lại quét», fail-closed guest/deny. |
| **Theme (`tokens` / `colors`)** | **Khớp** palette; font brand là khác biệt P2 chấp nhận được. |
| **staff-scan** | **Lệch** P1 (title, chrome sticky, nav IA, camera label, toast copy) + P2 (hint, atmosphere). |
| **staff-manual** | **Lệch** **P0** (copy kỹ thuật + thiếu confirm); P1 field/CTA label. |
| **staff-history** | **Khớp** pagination/search/empty/error; **lệch** P1 (dòng scope sự kiện + group theo ngày). |

---

## Ghi chú phương pháp

- Đối chiếu trực tiếp chuỗi render trong `full-prototype.html` (hàm `render`, biến `screen==='scan'|'manual'|'history'`) với source `apps/mobile/src`.
- Không chạy Metro/device trong task; build 26 trên DATHN có thể khác nếu bundle cũ — báo cáo bám source worktree hiện tại.
- Slice không sửa code / không commit theo Spec ownership.
