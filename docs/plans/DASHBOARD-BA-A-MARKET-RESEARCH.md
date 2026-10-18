# Dashboard Vemoki — Nghiên cứu thị trường Nhóm A (BA độc lập)

| Trường | Giá trị |
| ------ | ------- |
| Role | `product-ba` (`docs/agents/roles/product-ba.md`) |
| Agent | cursor (theo `orca-agent-routing.mdc`) |
| Ngày truy cập nguồn web | **2026-10-18** |
| Source HEAD SHA đối chiếu | `e8512d0055e0e9d6585007e8363b6224a7138b12` |
| Branch tại thời điểm research | `hangndat/d11-implementation-evidence` (không đổi branch/index) |
| Ownership artifact | Chỉ file này — `docs/plans/DASHBOARD-BA-A-MARKET-RESEARCH.md` |
| Sản phẩm nghiên cứu | Eventbrite, Ticket Tailor, Humanitix |
| Phương pháp | Help center / docs / trang tính năng chính thức qua WebFetch; **không** đăng nhập, **không** tạo account/trial trả phí, **không** vượt paywall |
| Graph CRG | `semantic_search_nodes_tool` trả 0 (graph stale vs HEAD); đối chiếu bằng lean-ctx + đọc source — **hạn chế** ghi ở §9 |

**Trạng thái Project #3 (live `gh`, 2026-10-18):** D0–D10 phần lớn `Hoàn thành`; Epic D11 `#222` `Đang làm`; Stories/Tasks D11-S2…S5 đang `Đang làm` / `Sẵn sàng`. `#21` reporting APIs và `#22` web admin dashboard = `Hoàn thành` trên board — **không** tự chứng minh PRD M11 đầy đủ hay UAT Dashboard. Đề xuất dưới đây = **proposed**, chưa = approved product change.

---

## 1. Executive findings

1. **Dashboard organizer phổ biến = hai lớp rõ:** (a) **tóm tắt event** (inventory / đã bán-đã cấp / check-in / việc chờ) và (b) **báo cáo chi tiết + export** (attendees, check-ins, analytics theo time range). Vemoki hiện có (a) rất mỏng: aggregate `ticketsByState` + `quota` + `pendingApprovalCount`; thiếu check-in / email lỗi / từ chối theo cổng trong payload report (đối chiếu source §5).
2. **KPI dictionary là điểm khác biệt lớn nhất với marketing.** Ticket Tailor **documented** tách *Checked in* (đang trong) vs *Attended* (đã vào ≥1 lần kể cả check-out). Humanitix **documented** *Completed orders* ≠ số vé; *Sales totals* trong analytics ≠ earnings sau refund. Eventbrite **documented** Check-ins report chỉ gồm vé đã check-in; Analytics có Sales (quantity/gross/net) vs Attendees. Vemoki cần dictionary riêng cho mô hình **mã/quota/miễn phí** (không copy “sold/revenue”).
3. **Việc cần xử lý (work queue) ít khi nằm trên thẻ KPI analytics** ở các sản phẩm bán vé — thường là attendees / orders / box office. Vemoki có JTBD riêng: pending duyệt, email lỗi, conflict Gate — PRD M11 liệt kê rõ; đây là **khoảng trống học được từ domain ops**, không copy revenue dashboard.
4. **Permissions tách Basic vs Advanced / check-in-only** (Eventbrite glossary) và **ẩn dữ liệu nhạy cảm trên app check-in** (Ticket Tailor marketing + help offline caveats) khớp PRD: Scanner không export; `report.read` đã được test deny. Cần mở rộng surface “tóm tắt theo quyền” (app nhân viên) mà không gộp financial.
5. **Offline / freshness:** Ticket Tailor help **documented** offline scan được nhưng **không sync** → rủi ro double-scan và lệch count app↔dashboard đến khi sync. Humanitix documented multi-device sync khi online. Vemoki D7 offline Gate + watermark freshness trên Dashboard là học đúng domain; **không** lấy claim “works offline” marketing làm runtime evidence.

---

## 2. Persona / JTBD (đối chiếu PRD §3 + thị trường)

| Persona Vemoki | JTBD Dashboard (suy luận từ PRD + pattern thị trường) | Pattern thị trường (verified docs) | Ghi chú MVP |
| -------------- | ----------------------------------------------------- | ---------------------------------- | ----------- |
| Event Manager | Biết còn bao nhiêu suất, bao nhiêu pending, event “ổn” chưa | Event summary / Ticket counts / Reporting groups | Có — ưu tiên |
| Supervisor | Bao nhiêu đã vào cổng, lỗi/conflict, thiết bị nào | Live check-in count; check-in by device (TT); Hosts app | Có — học freshness |
| CS | Việc cần xử lý (email lỗi, resend) — không từ thẻ KPI mơ hồ | Attendee/order search + export; ít gắn analytics | Có — queue riêng |
| Tenant Owner | Nhiều event tổng quan | Multi-event Analytics (EB); Global reports (HX) | Pha sau event-first |
| Scanner | Không cần full report | Check-in permission tách (EB); hide sensitive (TT) | Có — non-goal full dash |
| Platform Operator | Health ≠ business dash | Không thấy trong help organizer | Tách surface |

**In scope học cho Dashboard ops:** inventory (quota/issued), attendees list/export theo quyền, check-in progress + định nghĩa mẫu số, filters/time range, work items (pending/email fail), permissions, empty/error/unknown.

**Out of MVP (không đề xuất vào Dashboard Vemoki từ nghiên cứu này):** payment/revenue/gross-net, payouts, seat map, Apple/Google Wallet, Android native Hosts app parity, marketing heatmaps/UTM tối ưu bán hàng, Tap to Pay / door sales.

---

## 3. Bảng benchmark (mỗi dòng có source)

Chú giải provenance: **D** = documented help/docs đã fetch; **M** = marketing page (không dùng làm runtime evidence); **I** = suy luận BA; **U** = chưa xác minh (cần đăng nhập / plan).

### 3.1 Eventbrite

| Chủ đề | Nhận định | Provenance | Source |
| ------ | --------- | ---------- | ------ |
| Analytics entry | Event Dashboard → Reporting → Analytics; Sales (qty/gross/net) hoặc Attendees; time presets 30/60/90/all/custom; chọn 1 hoặc nhiều event; Group By; filter ticket type; Export Data | D | [How to use the Analytics tool](https://www.eventbrite.com/help/en-us/articles/237711/how-to-use-the-analytics-tool/) — truy cập 2026-10-18 |
| Check-ins report | Reporting → Event reports → Check-ins; preview ≤25 rows; export CSV/XLS; chỉ vé đã check-in; filter order date, check-in status, guests; cần permission Basic reports | D | [Download your Check-ins report](https://www.eventbrite.com/help/en-us/articles/876912/download-your-check-ins-report/) — 2026-10-18 |
| Attendees report | Event reports → Attendees; itemized theo order/attendee + ticket type; multi-event qua account Reporting; filter order date, organizer profile, currency, guests | D | [Download an Attendees report](https://www.eventbrite.com/help/en-us/articles/496608/download-an-attendees-report/) — 2026-10-18 |
| Ticket Counts KPI | Sold / Open / Face value / Manual / Holds / Free; toggle ticket types; share/schedule | D + giới hạn | [View and share ticket count reports](https://www.eventbrite.com/help/en-us/articles/360112/how-to-view-report-data-for-multiple-live-events-with-eventbrite-music/) — 2026-10-18; **NOTE documented:** chỉ Eventbrite Music, không nhận khách mới |
| Check-in app | Organizer app: scan / manual; settings ticket types, auto-check-in, scan behavior Default / check-out / Validate Only | D | [Check in attendees…](https://www.eventbrite.com/help/en-us/articles/741083/how-to-check-in-attendees-at-the-event-with-eventbrite-organizer/) — snippet search + title confirmed 2026-10-18 |
| Permissions | Tách Check-in attendees; Basic reports vs Advanced reports; View aggregate financial data | D | [Permissions Glossary](https://www.eventbrite.com/help/en-us/articles/362073/permissions-definitions/) — 2026-10-18 |
| Real-time sales on dash | “Monitor ticket sales in real time” / live check-in trên app | M | [Event Analytics & Reporting Tools](https://www.eventbrite.com/features/analytics/) — marketing; **không** verify latency |
| UI loading/a11y | — | U | Chưa xác minh (cần tài khoản) |

### 3.2 Ticket Tailor

| Chủ đề | Nhận định | Provenance | Source |
| ------ | --------- | ---------- | ------ |
| Event summary KPI | Tickets issued, sales revenue, checked in, days to go, event views; referral/discount từ summary | D | [What analytics do I get?](https://help.tickettailor.com/en/articles/950008-what-analytics-do-i-get) — 2026-10-18 (Updated over a month ago) |
| Check-in dictionary | *Checked in* = đang checked in; *Attended* = đã check-in ≥1 lần kể cả sau check-out | D | [How to see your check-in data](https://help.tickettailor.com/en/articles/5028380-how-to-see-your-check-in-data) — 2026-10-18 (Written July 30, 2026) |
| Check-in report | Event reports → Check-in report: theo thời gian và theo device; export qua Orders + checkbox Checked in | D | Cùng bài check-in data + analytics article |
| Offline | App scan offline được; **không** sync giữa thiết bị / không tải ticket mới → có thể double-scan; count lệch đến khi sync; recommend online; app chỉ giữ ~2 tuần past events | D | Cùng bài § Things to note |
| Live reporting trên app | Dashboard trong app hiện check-in count | D + M | Help (D) + [Free check-in app](https://www.tickettailor.com/en-us/free-checkin-app) (M: offline, hide sensitive, multi-profile) |
| Revenue | Gross revenue; refunds removed; net = subtract fees/tax; Payment plans / Transactions by payment method | D | Analytics article — **ngoài MVP Vemoki** |
| Seat / door sales | Seat number report; Tap to Pay / cash at door | D/M | FAQ/marketing — **ngoài MVP** |

### 3.3 Humanitix

| Chủ đề | Nhận định | Provenance | Source |
| ------ | --------- | ---------- | ------ |
| Event analytics | Reports → Analytics per event; Views, Unique visitors, Completed orders, Conversion; date filter; heatmaps location/time; traffic/UTM; device/browser | D | [Understanding your event analytics](https://help.humanitix.com/en/articles/9425001-understanding-your-event-analytics) — 2026-10-18 (page dated January 7, 2026) |
| Denominator | Completed orders ≠ tickets; sales totals = order value, **không** trừ refund/cancel (marketing performance, không earnings) | D | Cùng bài FAQ |
| Export analytics | Analytics **không** export PDF/CSV hiện tại | D | Cùng bài |
| Reporting groups | Nhóm ticket types cho sales + check-ins; không ảnh hưởng capacity; filter channel/time; pin group lên listing | D | [Create reporting groups…](https://help.humanitix.com/en/articles/9503868-create-reporting-groups-to-help-track-sales-and-check-ins) — 2026-10-18 (December 8, 2025) |
| Check-in | Hosts app (scan/search); console attendees check-in/out; CSV/PDF guest list; multi-device sync (documented) | D | [How to check in your attendees](https://help.humanitix.com/en-us/articles/8896951-how-to-check-in-your-attendees) — 2026-10-18 (June 4, 2026) |
| Cross-event | Global reports (attendees, event summary w/ tickets sold + earnings + checked in, orders, …); CSV export; 1 currency / report | D | [Generate global reports…](https://help.humanitix.com/en/articles/11883373-generate-global-reports-for-your-events) — 2026-10-18 (September 23, 2025) |
| Offline Hosts app | — | U | Help mô tả sync multi-device; **chưa** xác minh offline mode chi tiết |

---

## 4. Ma trận đối chiếu Vemoki

| Năng lực | Thị trường (pattern) | Vemoki hiện có (source) | Gap | Phân loại |
| -------- | -------------------- | ----------------------- | --- | --------- |
| Event summary counts | Issued / sold / open / checked-in | `ticketsByState` ACTIVE/REVOKED/CANCELLED/USED + `quota.capacity/allocated` + `pendingApprovalCount` | Thiếu check-in success, email fail, từ chối theo lý do/cổng, “mã khả dụng” riêng | **Thiếu** vs PRD M11 |
| KPI dictionary | Checked-in vs Attended; orders vs tickets | State enum vé; chưa document dictionary Dashboard UI | Cần glossary ops | **Thiếu** (docs+UI) |
| Time range / trend | 30/60/90/custom; check-ins over time | Snapshot hiện tại khi GET report | Không có time series | **Thiếu** |
| Multi-event overview | Analytics / Global reports | Report scoped 1 `eventId` | Owner overview | **Chưa biết** ưu tiên / **proposed** pha sau |
| Filters / drilldown | Ticket type, device, channel | Không trong report API | Drill theo nguồn/loại vé | **Thiếu** |
| Attendee list / export | Attendees CSV | Export job + CS search tồn tại admin (ngoài payload report) | Liên kết từ Dashboard → việc | **Hiện có một phần** |
| Check-in live | App dashboard count | Gate + D7 (board); **không** trong `EventReport` | Wire check-in aggregates vào dash | **Thiếu** trên dash |
| Offline freshness | TT documented skew | D7 offline Gate (PRD) | Watermark / stale banner | **Thiếu** UX |
| Permissions | Basic/Advanced; check-in-only | `report.read` + event assignment; test deny clerk/unassigned | App “tóm tắt theo quyền” | **Hiện có một phần** |
| Loading / empty / error | — (U trên competitor) | Web: `shown` / `unknown` / `rejected`; không hiện số khi unknown | Empty zero vs unknown | **Hiện có** (web interpret) |
| a11y | U | `aria-labelledby`, `role="status"` trên report section | Chưa audit đầy đủ | **Chưa biết** |
| Revenue / payouts | EB/TT/HX mạnh | Non-goal MVP | — | **Không phù hợp MVP** |
| Seat / Wallet / Android | TT/HX/EB có khía cạnh | Non-goal MVP | — | **Không phù hợp MVP** |

### Source Vemoki đã đối chiếu (SHA `e8512d0055e0e9d6585007e8363b6224a7138b12`)

| File | Nội dung liên quan |
| ---- | ------------------ |
| `docs/PRD.md` | §3 personas; §5 Dashboard; §6 M11 CS/báo cáo |
| `docs/TECHNICAL-DESIGN.md` | Dashboard overload / capacity notes |
| `docs/ROADMAP.md` | D4 reporting; D11 gate BA |
| `docs/DECISION-LOG.md` | O11 BA/PD D11 (match regex) |
| `packages/backend/src/reporting.ts` | `readEventReport`; permission `report.read`; counts only |
| `apps/api/src/reporting.ts` | `GET …/events/:eventId/report` |
| `apps/web/src/admin/report.ts` | `interpretEventReport` shown/unknown/rejected |
| `apps/web/app/admin/admin-form.tsx` | Section “Báo cáo sự kiện” + `loadReport` |
| `apps/web/app/api/bff/admin/report/route.ts` | BFF forward |
| `packages/backend/test/reporting.test.cjs` | Aggregate-only; no email/code; authz deny |

**PRD M11 (draft):** Dashboard cần mã khả dụng, pending, vé đã cấp/hủy, quota còn lại, email lỗi, check-in thành công, từ chối theo lý do/cổng; export có filter/audit/TTL; nghiệm thu đối soát với nguồn giao dịch. **Board Hoàn thành #21/#22 ≠ đủ M11.**

---

## 5. Ưu tiên (impact × effort × risk) — proposed

| # | Đề xuất | Impact | Effort | Risk | Ownership gợi ý |
| - | ------- | ------ | ------ | ---- | --------------- |
| P1 | KPI dictionary + mở rộng report aggregates: check-in success, email fail (count), reject-by-reason (tối thiểu), “còn lại” = f(quota) có định nghĩa | Cao (khớp M11 + JTBD Manager/Supervisor) | Trung (BE query + contract) | Trung (sai mẫu số) | BE → web |
| P2 | Dashboard “việc cần làm”: deep-link pending / email lỗi / CS — không nhồi vào analytics marketing | Cao ops | Thấp–trung (web) | Thấp | web (+ CS API sẵn) |
| P3 | Freshness/stale: watermark thời điểm snapshot; banner khi Gate offline queue chưa sync | Cao event-day | Trung | Trung (D7 dep) | BE+web+iOS Gate |
| P4 | Drilldown theo ticket type / issuance source (reporting groups kiểu HX, **không** capacity) | Trung | Trung | Thấp | BE → web |
| P5 | Time-bucket check-in (by hour/device) | Trung event-day | Cao | Trung (perf) | BE → web |
| P6 | Multi-event Tenant Owner overview | Trung | Cao | Thấp–trung | BE → web — **sau** event-first |
| — | Revenue/UTM/heatmap/door sales | — | — | — | **Reject MVP** |

Không điền baseline/target số % bịa.

---

## 6. User stories + AC kiểm chứng được

### US-A1 — Event Manager xem tóm tắt event đúng định nghĩa

**Story:** Là Event Manager có `report.read`, tôi muốn thấy số vé theo trạng thái, quota, pending, check-in thành công và email lỗi với chú thích mẫu số, để quyết định có cần can thiệp trước giờ mở cổng.

**AC (proposed):**

1. Given assignment + `report.read`, When GET report 200, Then payload có đủ trường đã chốt dictionary (không hiện số khi 5xx/network — giữ `unknown`).
2. Given fixture ACTIVE/USED/REVOKED/CANCELLED + PENDING_REVIEW + 1 email FAILED, When đọc report, Then counts khớp SQL nguồn (test isolation PostgreSQL).
3. Given thiếu quyền / thiếu assignment, When GET, Then 403 và UI `rejected` — không hiện số 0 giả.
4. Given dictionary UI, When hover/help, Then phân biệt “USED/check-in thành công” vs bất kỳ metric Attended/Checked-in nếu có check-out sau này.

### US-A2 — Supervisor theo dõi vào cổng + freshness

**Story:** Là Supervisor, tôi muốn biết đã check-in bao nhiêu và dữ liệu có thể lệch do offline, để không tin count “xanh” khi watermark cũ.

**AC (proposed):**

1. Given check-in operations thành công N, When refresh dash, Then check-in count = N (không đếm retry thất bại).
2. Given offline queue chưa sync, When mở dash, Then hiện stale/watermark (copy đã chốt) — không im lặng.
3. Given Scanner role, When mở admin report đầy đủ, Then bị từ chối; tóm tắt app (nếu có) không export PII.

### US-A3 — CS xử lý việc từ Dashboard

**Story:** Là CS, tôi muốn từ khu “việc cần làm” mở danh sách email lỗi / pending mà không sửa quota.

**AC (proposed):**

1. Given pendingApprovalCount > 0, When click CTA, Then vào luồng duyệt hiện có với cùng tenant/event context.
2. Given email fail count > 0, When click, Then CS list filter phù hợp (hoặc deep-link documented); resend vẫn theo quyền CS hiện tại.
3. Given CTA, When thiếu quyền CS, Then CTA ẩn hoặc 403 — không lộ PII trên thẻ KPI.

---

## 7. Roadmap ownership + dependencies (proposed)

```text
Wave 0 (docs/product): chốt KPI dictionary M11 ↔ state máy vé/Gate/outbox
  owner: product-ba + user quyết định §8
Wave 1 (contract): mở rộng EventReport DTO + OpenAPI
  owner: backend; dep: Wave 0
Wave 2a (web): render KPI + unknown/empty + work CTAs
  owner: web; dep: Wave 1
Wave 2b (tests): reporting.test mở rộng + web interpret
  owner: backend + web
Wave 3 (freshness): watermark + D7 offline semantics trên dash
  owner: backend + web (+ ios nếu app tóm tắt); dep: D7 design
Wave 4 (optional): reporting groups / time buckets / multi-event
  owner: backend → web; chỉ sau Wave 1–2 ổn định
```

**Không** spawn coding từ artifact này. Coordinator / Epic planner mới được dispatch.

---

## 8. Câu hỏi cần user quyết định

1. **Mẫu số check-in trên Dashboard:** đếm `tickets.state=USED`, đếm operations check-in thành công, hay tách *đang trong* / *đã từng vào* (kiểu Ticket Tailor)? Có check-out trong MVP không?
2. **Email lỗi:** đếm notification `FAILED` hiện tại, hay chỉ “cần CS xử lý” (đã hết retry)?
3. **Phạm vi Dashboard đợt tới:** chỉ event-scoped (khuyến nghị) hay bắt buộc multi-event Owner ngay?
4. **Reporting groups** theo ticket type/source: có cần pin lên danh sách event không, hay chỉ trong trang report?
5. **Độ tươi:** chấp nhận pull-on-load, interval poll, hay chỉ watermark thủ công refresh?

---

## 9. Giới hạn research

- Không đăng nhập / không trải nghiệm organizer authenticated; mọi nhận định UI runtime = **chưa xác minh** trừ khi help mô tả flow.
- Không đọc `docs/plans/DASHBOARD-RESEARCH.md` hay báo cáo BA nhóm khác trước khi chốt (độc lập).
- Eventbrite Ticket Counts = Music-only (documented) — không ngoại suy cho mọi tài khoản EB.
- Marketing pages (TT check-in app, EB features) chỉ dùng làm gợi ý JTBD, không làm evidence latency/offline correctness — help TT đã bổ sung caveats offline.
- CRG ticket graph stale (`built_at_sha` ≠ HEAD); đối chiếu source qua lean-ctx/read.
- Chưa chạy test reporting trong session này; dựa trên nội dung test file đã đọc.
- Project board `Hoàn thành` không thay UAT/PRD completeness.
- Humanitix analytics export: documented *không* có CSV — pattern “analytics ≠ operational export”.

---

## 10. Kết luận ngắn cho handoff

Nhóm A cho thấy organizer cần **event ops summary + dictionary rõ + check-in/freshness + việc cần làm**, còn analytics bán hàng/revenue là lớp riêng **ngoài MVP Vemoki**. Source hiện tại đã có nền aggregate an toàn (no PII, authz, unknown UI) nhưng **chưa đủ M11**. Ưu tiên P1–P3 trước multi-event và marketing analytics.

---

**Artifact path:** `docs/plans/DASHBOARD-BA-A-MARKET-RESEARCH.md`

### 5 phát hiện quan trọng

1. Thị trường tách **summary ops** vs **reports/export/analytics**; Vemoki mới có summary rất mỏng.
2. **KPI dictionary** (Checked in vs Attended; orders vs tickets; sales vs earnings) là bài học bắt buộc trước khi thêm số.
3. PRD M11 yêu cầu check-in / email lỗi / từ chối theo cổng — **chưa có trong `readEventReport`**.
4. Ticket Tailor **documented** rủi ro offline double-scan → Dashboard phải có **freshness/stale**, không chỉ số đẹp.
5. Payment/revenue/seat/Wallet/Android = **không phù hợp MVP**; học check-in inventory + permissions + work queue thay vì copy sales dashboard.
