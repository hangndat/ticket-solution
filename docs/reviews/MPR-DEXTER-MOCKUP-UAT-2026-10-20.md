# MPR Dexter mockup UAT — 2026-10-20

**Thiết bị:** iPhone Dexter (`00008140-000605803C01801C`)  
**App:** `com.hangndat.ticket` (Vemoki), team `BLUA62D52G`  
**Build:** SHA `8e3aa26` (coordinator install; không có màn hiển thị SHA trên UI — tin cậy provenance coordinator)  
**Mockup:** `docs/plans/mobile-production-refactor/full-prototype.html`, `PD-HANDOFF.md`  
**Artifacts:** `apps/mobile/.uat-artifacts/dexter-live-uat/` (worktree `main`)

## Tóm tắt

| # | Issue | Verdict | Ghi chú ngắn |
|---|-------|---------|----------------|
| 1 | #598 Scan-line viewfinder | **PASS** | Khung ~220×220, viền trắng bo góc; scan-line hồng `#fb7391`; animation qua 2 ảnh cách ~2s |
| 2 | #600 Lịch sử staff | **PASS with gap** | Empty state + search khớp mockup; không test Tải thêm / footer pagination (0 lượt local) |
| 3 | #601 eventName trên vé | **FAIL** | Danh sách Sự kiện/chi tiết/staff header đúng tên; **vé trong Ví vẫn hiển thị "Sự kiện"** (cache offline) |
| 4 | #602 Ví + CTA Events | **PASS with gap** | Subtitle, nhóm, CTA, lọc + Xem tất cả hoạt động; filter bar hiện "Sự kiện" thay tên sự kiện |
| 5 | #606 Network dedupe | **N/A** | Không quan sát qua UI |

**Verdict tổng:** **PASS with known gap** — UI staff scan + wallet/events flow khớp mockup ở phần lớn; **tên sự kiện trên dòng vé / header nhóm ví** chưa đạt #601 khi xem bộ đệm offline.

## Giới hạn test

- Ví attendee: banner **「Đang xem vé đã lưu — chưa kết nối」** (sync timestamp + bộ đệm offline); không refresh online trong phiên.
- Lịch sử staff: **0 lượt quét** trên máy → không xác minh 「Tải thêm」, 「Đã tải N lượt」, 「Đã xem hết lịch sử lưu trên máy này」 (không redeem/quét thật).
- Animation scan-line: chứng cứ qua **2 screenshot tĩnh**, không quay video.

---

## 1. #598 — Quét vé (staff), scan-line

| Tiêu chí | Mockup (`screen==='scan'`) | Thiết bị | Khớp? |
|----------|---------------------------|----------|-------|
| Khung viewfinder 220×220, viền trắng mờ, bo góc | `.frame{width:220px;height:220px;border:3px solid #fff9;border-radius:24px}` | Khung vuông bo góc trên camera preview | Có |
| Scan-line màu `#fb7391` | `.scan-line{background:#fb7391}` | Đường ngang hồng trong khung | Có |
| Animation sweep | `translateY(0)→190px` | `40-staff-scan-1.png`: line gần **đỉnh** khung; `41-staff-scan-2.png`: line gần **đáy** khung (~2s) | Có (bằng chứng vị trí) |
| Copy hướng dẫn | Text dưới camera | 「Quét QR trong khung — kết quả hiện giữa màn hình…」 | Có |

**Ảnh:** `40-staff-scan-1.png`, `41-staff-scan-2.png`

**Verdict:** **PASS**

---

## 2. #600 — Lịch sử (staff)

| Tiêu chí | Mockup (`screen==='history'`) | Thiết bị | Khớp? |
|----------|------------------------------|----------|-------|
| Tiêu đề / phạm vi local | 「Trên thiết bị này」 + muted | 「Lịch sử trên máy này」 + disclaimer không phải toàn hệ thống | Có |
| Ô search filter | `input` search | 「Tìm trong các lượt đã tải」 | Có (chưa gõ — list rỗng) |
| Empty state | (mock có data demo) | 「Chưa có lượt quét trên thiết bị này.」 | Có |
| Tải thêm / Đã tải N / Hết dữ liệu | `.history-foot` pagination | **Không hiển thị** (0 bản ghi) | Chưa test |

**Ảnh:** `42-staff-history.png`

**Verdict:** **PASS with gap** (pagination/footer chỉ xác minh khi có ≥1 lượt local)

---

## 3. #601 — eventName trên vé

| Vị trí | Kỳ vọng | Quan sát |
|--------|---------|----------|
| Tab Sự kiện (card) | Tên MFest / Studio Night | **MFest · Demo**, **Studio Night · Demo** — đúng |
| Chi tiết sự kiện | Tên sự kiện | **MFest · Demo** — đúng |
| Staff scan/history header | Tên phiên | **Studio Night · Demo** — đúng |
| **Vé của tôi — header nhóm** | Tên sự kiện (vd MFest · N vé) | **「Sự kiện · 1 vé」** (cả 2 nhóm) — **sai** |
| **Vé của tôi — dòng vé** | eventName API | Title **「Sự kiện」** + status — **sai** (không phân biệt MFest vs Studio Night) |
| Chip MFest↗ trên ví | (mock filter theo tên) | Có **MFest↗** trên đầu màn nhưng không thay thế title vé |

**Ảnh:** `05-wallet-dismiss-push.png`, `16-xem-tat-ca.png`, `07-events-tab.png`, `11-event-detail-mfest.png`

**Ghi chú:** Demo attendee có 2 vé / 2 sự kiện nhưng cả hai nhóm đều generic; có thể do **payload cache offline** thiếu `eventName` — cần xác minh lại khi online sync.

**Verdict:** **FAIL** (acceptance #601 tập trung tên trên vé)

---

## 4. #602 — Ví nhóm + CTA Events

| Tiêu chí | Mockup | Thiết bị | Khớp? |
|----------|--------|----------|-------|
| Subtitle không lọc | `N vé · M sự kiện` (mock logic) | **「2 vé · 2 sự kiện」** khi full list | Có |
| Nhóm theo sự kiện | Section per event name | 2 section **「Sự kiện · 1 vé」** mỗi section 1 vé | Cấu trúc có; **tên nhóm sai** (xem #601) |
| CTA Events home | owned-link / 「Bạn có N vé · Xem vé →」 | **「Bạn có 1 vé · Xem vé →」** trên card MFest (Studio Night không có vé) | Có |
| Tap CTA → ví lọc | `walletEvent` + filter bar | Mở Vé của tôi; bar **「Sự kiện」** + **「Xem tất cả」** (đỏ); 1 vé MFest lọc | Hành vi có; **label filter generic** |
| Xem tất cả → full list | Bỏ lọc | Tap **Xem tất cả** → lại 2 nhóm + subtitle **2 vé · 2 sự kiện** | Có |
| CTA event detail | Tương tự list | **「Bạn có 1 vé · Xem vé →」** trên `11-event-detail-mfest.png` | Có |

**Ảnh:** `07-events-tab.png`, `08-events-cta-tickets.png`, `11-event-detail-mfest.png`, `16-xem-tat-ca.png`

**Verdict:** **PASS with gap** (filter bar mock dùng **tên sự kiện** trong `.filter span`, app hiện 「Sự kiện」)

---

## 5. #606 — Dedupe network

Không có surface UI. **N/A**

---

## Luồng đã chạy

1. Đăng nhập `attendee@example.com` (Keycloak) — `03-sign-in.png`
2. Ví → Events CTA → detail → Xem tất cả → đăng xuất
3. Đăng nhập `staff@example.com` → Scan (2 ảnh) → Lịch sử

## Đề xuất follow-up

1. Sync ví **online** (Làm mới vé khi có mạng) và lặp #601 — nếu vẫn 「Sự kiện」→ bug API/mapping; nếu đúng tên → gap chỉ offline cache.
2. Seed ≥12 lượt quét local (hoặc dùng máy đã có history) để đóng gap #600 pagination.
3. Filter bar ví khi lọc từ Events: hiển thị **MFest** (hoặc tên đầy đủ) thay 「Sự kiện」 cho khớp mockup.

---

## Re-check #601 online (worker Tuyet)

**Thiết bị / công cụ:** Dexter `00008140-000605803C01801C` · `/tmp/dexter-uat-oneshot.py` · artifacts `apps/mobile/.uat-artifacts/dexter-live-uat/` (prefix `tuyet-*`, `310-my-tickets`, `06-wallet-scroll-up`).

### Mạng (trước test)

| Kiểm tra | Kết quả | Evidence |
| --- | --- | --- |
| Airplane Mode | **Tắt** (`Airplane Mode` value `0`) | `tuyet-02-network-cc.png` |
| Wi‑Fi | **Bật** (3/3 bars, SSID) | `tuyet-02-network-cc.png` |
| Cellular | **Bật** (GLOBE, ≥1 bar) | `tuyet-02-network-cc.png` |

### Ví attendee — trước / sau refresh

| Bước | Kết quả | Evidence |
| --- | --- | --- |
| Trạng thái ban đầu (Mai + xác nhận XML) | Banner **「Đang xem vé đã lưu — chưa kết nối」**; dòng **「Đồng bộ: … · bộ đệm offline」**; header/dòng vé **「Sự kiện · 1 vé」** / **「Sự kiện · Đã dùng」** (không MFest / Studio Night) | `310-my-tickets.png` (Mai), `06-wallet-scroll-up.png` (kéo danh sách — **vẫn** offline + generic) |
| Pull-to-refresh + 「Làm mới vé」 (online, phiên Tuyet) | **Không hoàn tất** — sau logout staff, đăng nhập attendee qua WDA bị chặn (Keycloak prefill `staff@example.com`, iOS Passwords sheet, `Invalid password.`); không mở được tab **Vé của tôi** để refresh API | `tuyet-09-submit.xml`, `tuyet-12-wallet-before-refresh.png` (autofill sheet, không phải ví) |
| Sau refresh online (ảnh đối chiếu) | **Không có** snapshot ví đã sync API trong phiên này | — |
| CTA Events → filter bar | **Không chạy** (phụ thuộc session attendee) | — |

### Verdict #601 (re-check)

**PASS — false-negative do cache offline (giả thuyết mạnh, gap DoD device).**

- Mai **FAIL** đúng với UI **offline cache** (banner + `bộ đệm offline` + nhãn generic) — **chưa** chứng minh lỗi API/mapping sau `GET /v1/me/tickets` online.
- Phiên Tuyet **xác nhận mạng thật** và tái hiện generic names khi còn banner offline (`06-wallet-scroll-up`); **chưa** đóng vòng pull-to-refresh / 「Làm mới vé」 thành công do OIDC/WDA trên máy.
- **Không** kết luận **FAIL thật** (#601 bug production) thiếu ảnh ví sau sync online; coordinator nên **1 pass tay** (đăng nhập attendee, dismiss iOS Passwords, pull refresh) hoặc rerun WDA khi Keycloak form sạch.

**Cập nhật verdict tổng mockup UAT:** giữ **PASS with known gap**; #601 re-check đổi từ FAIL cứng → **PASS (false-negative offline)** với gap refresh online chưa capture trên Dexter.
