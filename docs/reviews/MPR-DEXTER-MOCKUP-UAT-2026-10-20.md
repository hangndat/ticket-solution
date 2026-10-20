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
| 2 | #600 Lịch sử staff | **PASS** (Van sau #608) | Empty+search OK; sau rebuild `c55b07a`: ≥13 lượt + 「Tải thêm」/「Đã tải N」/「Đã xem hết」 (`van608-91/92`) |
| 3 | #601 eventName trên vé | **PASS** (Yen sau deploy) | Sau redeploy API `14:26:41Z`: ví + filter CTA hiện **MFest · Demo** / **Device UAT Event** — hết generic 「Sự kiện」 |
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

---

## Đóng gap (worker Hoa)

**Phiên:** Dexter `00008140-000605803C01801C` · WDA `/tmp/hoa-dexter-uat.py` (session giữ nguyên, không `start_session` mỗi action) · build `8e3aa26` · artifacts `hoa-*` trong `apps/mobile/.uat-artifacts/dexter-live-uat/`.

### Gap A — #600 Lịch sử staff / pagination

| Bước | Kết quả | Evidence |
| --- | --- | --- |
| Đăng nhập staff `staff@example.com` | **OK** — Reload KC + `set` Email/Password trong một session WDA; vào tab **Nhập tay** (Aurora Night UAT) | `hoa-85-signin.png`, `hoa-152-manual.png` |
| Nhập tay ≥12 UUID giả | **13 lượt** qua `keys` sau focus `gate-scan-input` (WDA `set` không bật nút **Xử lý mã vé** — `enabled=false`) | `hoa-163-01-type.png`, `hoa-163-01-submit.png` … `hoa-163-13-submit.png`; UUID list `/tmp/hoa-gap-a-uuids.json` |
| Tab **Lịch sử** — pagination / search | **Không đóng** — UI vẫn **「Chưa có lượt quét trên thiết bị này.」**; không có 「Đã tải N lượt」, 「Tải thêm lượt quét」, hay hàng lịch sử sau submit | `hoa-166-history-p1.png`, `hoa-94-history-tab.png` |

**Verdict Gap A:** **vẫn chưa đóng được** — nhập tay chạy được (nút submit bật, field clear sau submit) nhưng **danh sách lịch sử local vẫn 0** trên UI; không xác minh pagination. Cần điều tra product (GateOp → `deviceHistory` / `recordedAt`) hoặc pass tay xác nhận trên cùng build.

### Gap B — #601 / #602 Ví attendee sau refresh online

| Bước | Kết quả | Evidence |
| --- | --- | --- |
| Logout staff → attendee OIDC | **OK** (KC logout confirm **Logout**; đăng nhập attendee, mở **Vé của tôi**) | `hoa-221-kc-logout.png`, `hoa-248-wallet.png` |
| Ví trước refresh | Banner **「Đang xem vé đã lưu — chưa kết nối」**; nhóm/dòng **「Sự kiện」** generic | `hoa-249-wallet-before.png` |
| Pull-to-refresh + **Làm mới vé** | Timestamp **Đồng bộ** cập nhật (`14:16:20` → `14:16:58`); sau **Làm mới** banner offline **tạm ẩn** một nhịp (`hoa-252`) rồi **hiện lại** (`hoa-253`); nhãn vé vẫn **「Sự kiện · …」** | `hoa-251-wallet-after-pull.png`, `hoa-252-lam-moi.png`, `hoa-253-wallet-after-lam-moi.png` |
| CTA Events → filter bar | CTA tap OK; filter bar vẫn **「Sự kiện」** (không MFest · Demo) | `hoa-255-cta.png`, `hoa-256-wallet-filter.png` |

**Verdict Gap B:** **FAIL** cho mục tiêu đóng #601/#602 — đã hoàn tất luồng attendee + refresh có evidence, nhưng **sau refresh vẫn generic + banner offline**; không có ảnh ví với **MFest · Demo** / **Studio Night · Demo** trên header/dòng vé. Coi là **bug hoặc sync chưa online thật** trên build này, không còn gap chỉ do chưa chạy test.

### Verdict tổng sau đóng gap (Hoa)

| Issue | Verdict sau Hoa |
| --- | --- |
| **#600** | **PASS with gap** (empty state/search UI đã có từ Mai; **pagination chưa chứng minh** — Gap A chưa đóng) |
| **#601** | **FAIL** (refresh đã chạy; tên vé vẫn generic — không còn chỉ false-negative thiếu phiên) |
| **#602** | **PASS with gap** (CTA/filter hành vi OK; **label filter generic**) |

**Tổng mockup UAT:** **PASS with known gap** — staff scan/manual khớp mockup; **#601 ví online** và **#600 pagination** vẫn là gap mở.


---

## Verify #601 sau deploy (worker Yen)

**Phiên:** 2026-10-20 ~22:34–22:43 ICT · Dexter `00008140-000605803C01801C` · WDA session-stable (`/tmp/hoa-dexter-uat.py` + login helper Return-submit; oneshot restart-session gãy OIDC/Passwords) · artifacts `yen-*` trong `apps/mobile/.uat-artifacts/dexter-live-uat/` (worktree `main`).

**Bối cảnh API:** production `vemoki-api-1` redeploy StartedAt `2026-10-20T14:26:41Z` (PR #604 `eventName` trên `GET /v1/me/tickets`). So sánh với Hoa Gap B **FAIL** (generic 「Sự kiện」sau refresh).

### Login

| Bước | Kết quả | Evidence |
| --- | --- | --- |
| Session ban đầu | **Chưa đăng nhập** (chỉ tab Sự kiện / Tài khoản) | `yen-02-account.png` |
| OIDC attendee | **OK** — Cancel Passwords sheet + `Restart login` + set Email/Password + **Return** trên Password (tap/click Sign In liên tục mở iOS Passwords sheet) | `yen-74-after-return.png`, `yen-78-final.png` |

### Ví attendee — sau deploy

| Bước | Kết quả | Evidence |
| --- | --- | --- |
| Mở **Vé của tôi** (trước / cùng lúc refresh) | Header/dòng vé **không còn** 「Sự kiện · …」generic. Nhóm/title: **Device UAT Event · 1 vé** / **Device UAT Event · Còn hiệu lực**; **MFest · Demo · 1 vé** / **MFest · Demo · Đã dùng**. Banner offline vẫn hiện (đồng bộ `14:42:08Z`) | `yen-81-wallet.png`, `yen-83-wallet-before.png` |
| Pull-to-refresh | Timestamp Đồng bộ cập nhật (`14:42:08Z` → `14:42:29Z`); tên sự kiện **giữ** MFest / Device UAT Event | `yen-84-pull-refresh.png`, `yen-85-wallet-after-pull.png` |
| **Làm mới vé** | Đồng bộ `14:42:46–47Z` (sau API deploy); banner 「chưa kết nối」vẫn có trên full list; **tên vé đúng** — không regress về 「Sự kiện」 | `yen-87-wallet-after-lam-moi.png` |
| CTA Events 「Bạn có 1 vé」→ filter bar | Filter **「MFest · Demo」** + **「Xem tất cả」** (đỏ); dòng vé **MFest · Demo · Đã dùng** — **không** generic 「Sự kiện」 | `yen-88-events.png`, `yen-90-cta.png`, `yen-91-wallet-filter.png` |

### Ghi chú dữ liệu

- Ví attendee hiện **2 sự kiện**: **Device UAT Event** + **MFest · Demo** (không còn cặp Studio Night trên ví trong phiên này; tab Sự kiện vẫn list **Studio Night · Demo**). Chấp nhận #601 = **eventName thật**, không label generic.
- Banner offline / `bộ đệm offline` vẫn xuất hiện sau Làm mới trên full list; filter CTA snapshot (`yen-91`) không hiện banner — **không** đảo verdict #601 (tên đã đúng).

### Verdict #601 sau deploy

**PASS thật.**

- Trước deploy (Hoa): refresh online vẫn 「Sự kiện」generic → FAIL.
- Sau deploy PR #604: header nhóm + title dòng vé + filter bar CTA hiện **MFest · Demo** / **Device UAT Event** (tên sự kiện thật). Không cần Issue bug code mới cho #601 trên surface này.

**Cập nhật bảng tóm tắt:** #601 → **PASS** (verify Yen sau redeploy API).

---

## Verify #600 cuối (worker Thanh)

**Phiên:** 2026-10-20 ~22:49–22:58 ICT · Dexter `00008140-000605803C01801C` · WDA session-stable (`/tmp/thanh-600-uat.py` + oneshot probes) · artifacts `thanh-*` trong `apps/mobile/.uat-artifacts/dexter-live-uat/` (worktree `main`). **Không sửa code / không commit.**

### 1) Preflight mạng (trước khi test Gap A)

| Kiểm tra | Kết quả | Evidence |
| --- | --- | --- |
| Status bar Wi-Fi | **Full bars** + cellular | `thanh-02-ticket-launch.png`, `thanh-04-events.png`, `thanh-91-toast-0.png` |
| Safari `example.com` | **OK** — trang Example Domain load | `thanh-11-safari-example.png` (`safari_network_ok: true`) |
| Tab Sự kiện online | **OK** — list **MFest · Demo** + **Studio Night · Demo** | `thanh-12-events-online.png` / `thanh-04-events.png` |

→ Loại giả thuyết “mạng chập chờn / `networkUnavailable` early-exit” cho phiên này.

### 2) Staff login + scope

| Bước | Kết quả | Evidence |
| --- | --- | --- |
| Logout attendee → KC Logout confirm | **OK** | `thanh-19-boot.png` → `thanh-30-account-guest.png` (「Chưa đăng nhập」) |
| Login `staff@example.com` / `staff-demo` (Return trên Password) | **OK** — vào staff tabs | `thanh-32-filled.png`, `thanh-33-after-login.png` (`staff_login_ok: true`) |
| Scope | **Aurora Night UAT** rồi đổi **MFest · Demo** | `thanh-50-manual.png`, `thanh-102-picker.png`, `thanh-103-scoped.png` |

### 3) Step-1: 1 UUID giả → Lịch sử ngay

| Bước | Kết quả | Evidence |
| --- | --- | --- |
| Nhập tay UUID giả + `gate-manual-submit` | Submit **enabled=true** lúc bấm; field clear sau press (`setRaw('')`) | `thanh-601-type.png` / XML (`enabled=true`); UUID `a088c4f7-6048-49b2-995d-981521c81dae` |
| Lịch sử ngay sau 1 lượt | **FAIL** — 「Chưa có lượt quét trên thiết bị này.」; không 「Đã tải N lượt」 | `thanh-70-history-after-1.png` |
| Diag: Scan → Lịch sử (stale UI?) | Vẫn **0** bản ghi | `thanh-72-scan-tab.png`, `thanh-73-history-after-scan.png` |

Không chạy ≥12 UUID / pagination vì step-1 đã fail có mạng ổn định.

### 4) Repro bổ sung (cùng phiên online)

| Bước | Kết quả | Evidence |
| --- | --- | --- |
| Scope **MFest · Demo**, submit UUID giả, chờ **15s** | Không toast trên Manual; History vẫn empty | `thanh-104-typed.png` … `thanh-105-wait-15s.png`, `thanh-107-history.png` |
| Mở **Scan ngay** sau submit | Chrome: **「Trực tuyến」** + **「Chưa mở phiên cổng」**; **không** có toast kết quả (0.3s / 1s / 3s) | `thanh-110-scan-immediate.png` … `thanh-112-scan-3s.png` |
| Lịch sử sau đó | Vẫn empty | `thanh-113-history.png` |

Ghi chú product (đối chiếu code, không sửa): toast `StaffGateScanToast` chỉ mount trên tab Scan; Manual clear input ngay khi press dù `submitScan` chưa xong. Dù vậy, với **Trực tuyến** + submit enabled, vẫn **0** hàng lịch sử → không phải gap do mạng phiên Hoa.

### Verdict #600

**FAIL thật** (bug code / gate pipeline — **không** đóng Gap A bằng “mạng chập chờn lần trước”).

- Preflight mạng **PASS** (Wi-Fi + Safari + Events online).
- Staff + scope OK; `gate-manual-submit` **enabled** khi submit.
- Sau ≥1 (và thêm) UUID giả: Lịch sử vẫn empty; Scan báo **Trực tuyến** nhưng **Chưa mở phiên cổng**, không toast, không pagination.
- Cần **Issue riêng** (điều tra: `submitScan` / mở phiên `/sessions` / `persist`+`buildDeviceScanHistory` khi Manual clear sớm; toast không hiện trên tab Nhập tay). **Chưa mở Issue trong worker này** (chỉ report qua orchestration).

**Cập nhật bảng tóm tắt:** #600 → **FAIL** tại thời điểm Thanh (trên build cũ / trước #608). **Đã PASS** sau rebuild Van — xem mục Verify #608 bên dưới.

---

## Verify #608 fix trên Dexter (worker Van)

**Phiên:** 2026-10-20 ~23:14–23:26 ICT · Dexter `00008140-000605803C01801C` · Release rebuild **sau** merge PR #609 · WDA `/tmp/van-608-uat.py` (+ oneshot 13th UUID) · artifacts `van608-*` trong `apps/mobile/.uat-artifacts/dexter-live-uat/` (worktree `main`). **Không sửa code / không commit.**

### Build provenance

| Trường | Giá trị |
| --- | --- |
| Worktree build | `/Users/admin/orca/workspaces/main/uat-608-postfix` @ `c55b07a3fa9406e5a8c0d814e32e462d89bcc957` (merge PR #609) |
| Script | `apps/mobile/scripts/release-ios-dexter.sh` → CFBundleVersion **26**, team `BLUA62D52G`, install Dexter **Complete 100%** |
| Embedded | `extra.gitCommitSha` = `c55b07a3fa9406e5a8c0d814e32e462d89bcc957` trong `EXConstants.bundle/app.config` |
| Khác build cũ | Các phiên UAT trước dùng `8e3aa26` (chưa có fix Hermes `randomUUID`) — phiên này **rebuild** với SHA merge |

### 1) Staff login + scope

| Bước | Kết quả | Evidence |
| --- | --- | --- |
| Guest → KC `staff@example.com` / `staff-demo` (Return trên Password) | **OK** — staff tabs | `van608-32-filled.png`, `van608-33-after-login.png` (`staff_login_ok: true`) |
| Scope | **MFest · Demo** (đã scoped sẵn sau login) | `van608-50-manual.png` |

### 2) Nhập tay 1 UUID giả → phản hồi (#608)

| Bước | Kết quả | Evidence |
| --- | --- | --- |
| Nhập UUID `dbfd30d3-2793-4941-b659-84051405af05` + `gate-manual-submit` | Submit **enabled=true**; field clear sau press | `van608-601-type.png` |
| Tab **Scan** ngay sau submit | Chrome **「Sẵn sàng quét」** + **「Trực tuyến」** — **không** còn 「Chưa mở phiên cổng」 (khác FAIL Thanh trên build cũ) | `van608-601-scan-1s.png`, `van608-601-scan-3s.png` |
| Tab **Lịch sử** ngay sau 1 lượt | **≥1 bản ghi**: 「Không cho vào」 + `dbfd30d3-2…` + 「Đã tải 1 lượt」 + 「Đã xem hết…」 | `van608-70-history-after-1.png` |

→ Gate session + persist history **không** còn im lặng trống sau Hermes `crypto.randomUUID()` footgun.

### 3) Seed ≥12 + pagination #600

| Bước | Kết quả | Evidence |
| --- | --- | --- |
| Submit thêm tới **12** UUID giả (page size = 12) | Footer 「Đã tải 12 lượt」 + 「Đã xem hết…」; **không** hiện 「Tải thêm」 (đúng khi `total == PAGE_SIZE`) | `van608-80-history-final.png` |
| Submit UUID thứ **13** | Hiện nút **「Tải thêm lượt quét」** + vẫn 「Đã tải 12 lượt」 (page 1) | `van608-91-history-13.png` (+ XML `has_load_more: true`) |
| Bấm 「Tải thêm lượt quét」 | 「Đã tải 13 lượt」 + 「Đã xem hết lịch sử lưu trên máy này」; hết nút Tải thêm | `van608-92-after-load-more.png` |

### Verdict

| Issue | Verdict | Ghi chú |
| --- | --- | --- |
| **#608** (gate session / history im lặng) | **PASS** | Rebuild `c55b07a` trên Dexter: session mở (「Sẵn sàng quét」), deny ghi lịch sử ≥1 ngay sau manual UUID |
| **#600** pagination (Gap A) | **PASS** | 「Đã tải N lượt」 + 「Tải thêm」 (tại N=13) + 「Đã xem hết」 sau load-more — đóng gap trước đây không test được vì history luôn 0 |

**Cập nhật bảng tóm tắt:** #600 → **PASS** (verify Van sau #608 fix); #608 live Dexter → **PASS**.

---

## Verify #610 fix (wallet refresh loop) trên Dexter (worker Van)

**Phiên:** 2026-10-20 ~23:56–00:00 ICT · Dexter `00008140-000605803C01801C` · Release install qua `apps/mobile/scripts/release-ios-dexter.sh` · WDA session-stable (`/tmp/van-610-uat.py`) · **Không sửa code / không commit.**

**Build:** source SHA `ca818ac270309a42e3a2011c9af526d2d8d6e885` (PR #611 `useMemo` `fetchScope` — khớp `origin/main` tại lúc build) · CFBundleVersion **26** · artifacts `van610-*` trong `apps/mobile/.uat-artifacts/dexter-live-uat/` (worktree `main`).

### Preflight

| Kiểm tra | Kết quả |
| --- | --- |
| Worktree tip | `ca818ac` = merge PR #611 |
| `expo prebuild` + Release → Dexter | **OK** (`Build Succeeded`, install Complete 100%) |
| Session | Đã **verified** attendee trên máy (`Vé đã xác minh`); tab **Vé của tôi** mở được |

### Quan sát ổn định UI (≥10s idle)

Proxy chống nháy/loop: hash SHA-12 của accessibility XML mỗi ~1–2s khi idle trên tab ví (không tương tác).

| Cửa sổ | Samples | Unique XML | Đồng bộ | Evidence |
| --- | --- | --- | --- | --- |
| Idle sau mount | 6 | **1** (`b3cf82b29ed6`) | `2026-10-20T15:58:57.029Z` cố định | `van610-idle-t00.png` … `van610-idle-t05.png` (+ XML cùng hash) |
| Sau pull-to-refresh | 3 | **1** (`957eb4c23303`) | `…15:59:51.623Z` (đã cập nhật) | `van610-after-pull.png`, `van610-postpull-t00..t02.png` |
| Sau **Làm mới vé** + idle ≥10s | 6 | **1** (`71b0993feddc`) | ổn định sau 1 lần refresh | `van610-fu-03-refresh.png`, `van610-fu-idle-t00..t05.png` |

→ **Không** còn pattern nháy/reset liên tục (unique XML ≫1 mỗi giây). JSON tóm tắt: `van610-summary.json` / `van610-observe.json`.

### Pull-to-refresh

| Bước | Kết quả | Evidence |
| --- | --- | --- |
| Swipe pull trên ví | Timestamp **Đồng bộ** `15:58:57Z` → `15:59:51Z`; UI không gãy | `van610-idle-t00.png` vs `van610-after-pull.png` |
| Tap **Làm mới vé** | Refresh chạy; sau đó idle lại **1** unique XML | `van610-fu-03-refresh.png` |

### Network / `probeMeTickets`

Không bắt được đếm HTTP `/me/tickets` trên phiên này (syslog `OsTraceService` lỗi khởi tạo; không Safari Web Inspector). Proxy UI ở trên là evidence chính chống infinite remount/refresh loop.

### Gap dữ liệu (không đảo verdict #610)

Ví hiện **「Chưa có vé trong ví」** (empty state) dù session verified + chip `MFest↗`. #610 là bug **VerifiedWallet refresh loop** — empty state vẫn mount cùng code path và đã ổn định; không chứng minh được danh sách có vé, nhưng **không** cần vé để bác bỏ vòng `fetchScope` object-literal.

### Verdict #610

**PASS** — sau fix `ca818ac` / PR #611 trên Dexter Release build 26: tab **Vé của tôi** idle ≥10s không nháy; pull-to-refresh + **Làm mới vé** cập nhật Đồng bộ bình thường; không có dấu hiệu remount/API-loop UI.


---

## Verify #612 fix (token refresh) trên Dexter (worker Van)

**Phiên:** 2026-10-21 ~00:32–00:43 ICT · Dexter `00008140-000605803C01801C` · Release rebuild sau merge PR #613 · WDA `/tmp/van-612-uat.py` · artifacts `van612-*` trong `apps/mobile/.uat-artifacts/dexter-live-uat/` (worktree `main`). **Không sửa code / không commit.**

### Build provenance

| Trường | Giá trị |
| --- | --- |
| Worktree build | `/Users/admin/orca/workspaces/main/uat-612-postfix` @ `cbec5cff337ce01fd0eab2b3fe2feecc52d6d7f7` (merge PR #613) |
| Script | `apps/mobile/scripts/release-ios-dexter.sh` → CFBundleVersion **26**, team `BLUA62D52G`, install Dexter **Complete 100%** |
| Embedded | `extra.gitCommitSha` = `cbec5cff337ce01fd0eab2b3fe2feecc52d6d7f7` trong `EXConstants.bundle/app.config` |
| Tài khoản UAT | `attendee@example.com` / `attendee-demo` (**không** dùng `u1@gmail.com`) |

### Timeline chờ TTL (access token 300s)

| Mốc | Thời gian (ICT) | Ghi chú |
| --- | --- | --- |
| Login + Account pre OK | `2026-10-21T00:36:27+08:00` | `attendee@` + **Đăng xuất**; **không** 「Không tải được hồ sơ」 |
| Wallet pre OK | `2026-10-21T00:36:32+08:00` | **Vé của tôi** + Đồng bộ + 2 vé |
| Background app (Home) | `2026-10-21T00:36:34+08:00` | bắt đầu chờ |
| Hết chờ | `2026-10-21T00:42:44+08:00` | **370s** thực tế (≥6 phút; > TTL 300s) |
| Account post | `2026-10-21T00:42:51+08:00` | vẫn `attendee@` + **Đăng xuất** |
| Wallet post | `2026-10-21T00:42:56+08:00` | vẫn **Vé của tôi** (không guest) |

### Kết quả UI

| Bước | Kết quả | Evidence |
| --- | --- | --- |
| Pre — tab **Tài khoản** | Hồ sơ tải OK (`attendee@example.com`); không lỗi tải hồ sơ; không guest | `van612-10-account-pre.png` / `.xml` |
| Pre — tab **Vé của tôi** | Đã đăng nhập; Đồng bộ + danh sách vé | `van612-11-wallet-pre.png` / `.xml` |
| Sau ≥370s background → mở lại **Tài khoản** | Hồ sơ **tự tải lại OK**; **không** 「Không tải được hồ sơ」; **không** bị đăng xuất guest | `van612-20-account-post.png` / `.xml` |
| Sau chờ — **Vé của tôi** | Vẫn session attendee; không văng logout | `van612-21-wallet-post.png` / `.xml` |

JSON tóm tắt: `van612-summary.json` (`verdict: PASS`, `wait_seconds_actual: 370`).

### Verdict #612

**PASS** — trên Dexter Release build SHA `cbec5cf` (PR #613): sau **370s** background vượt TTL access token 300s, tab **Tài khoản** vẫn hiện `attendee@example.com` + Đăng xuất (transparent refresh), không lỗi 「Không tải được hồ sơ」, không về guest; tab **Vé của tôi** cũng giữ session.

