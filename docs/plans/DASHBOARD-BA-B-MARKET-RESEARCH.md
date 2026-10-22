# D11 — Nghiên cứu thị trường Dashboard (Nhóm B): Cvent · Bizzabo · Swoogo

| Trường | Giá trị |
| ------ | ------- |
| Role | `product-ba` (`docs/agents/roles/product-ba.md`) |
| Agent | cursor (theo `orca-agent-routing-coordinator.mdc`) |
| Ngày truy cập nguồn web | **2026-10-18** |
| Workspace HEAD SHA | `e8512d0055e0e9d6585007e8363b6224a7138b12` |
| Branch (không đổi) | `hangndat/d11-implementation-evidence` |
| Ownership artifact | **chỉ** file này |
| Trọng tâm | Event operations dashboard, phân quyền, event readiness, báo cáo/analytics, giám sát check-in — đối chiếu Vemoki MVP |
| Phương pháp | Duyệt trang chính thức (help/docs/product/PDF/developer); đối chiếu PRD + source reporting/test; **không** đăng nhập, **không** tạo account/trial trả phí, **không** vượt paywall |

**Chú giải mức bằng chứng**

| Ký hiệu | Ý nghĩa |
| ------- | ------- |
| **V** | *Verified* — nội dung trang đã đọc được (WebFetch / PDF / developer docs) |
| **D** | *Documented* — trích từ index tìm kiếm trỏ URL chính thức; body HTML full không lấy được (JS shell / 503) nên không xác nhận 100% wording hiện tại |
| **M** | *Marketing claim* — trang bán hàng; **không** dùng làm runtime evidence |
| **I** | *Inference* — suy luận BA; không phải bằng chứng sản phẩm |

---

## 1. Executive findings

1. **Ba sản phẩm là nền tảng quản trị sự kiện enterprise / mid-market**, tối ưu registration → onsite → engagement → ROI/CRM — **không phải mẫu MVP ticketing invite-code** như Vemoki. Sao chép feature “vì nổi tiếng” sẽ phình scope (session heatmaps, badge hardware, SmartBadge, CRM attribution, payment onsite).
2. **Pattern vận hành cổng đáng học (không copy stack):** (a) dashboard check-in gần realtime theo thời gian / loại đăng ký / phiên; (b) tách quyền planner vs onsite scanner; (c) cột readiness trên danh sách event (published + số checked-in / awaiting); (d) offline check-in + sync lại — có evidence **V/D** ở Cvent OnArrival và Swoogo Go Onsite.
3. **Vemoki đã có lõi báo cáo read-only theo event** (`report.read`, counts vé/quota/pending) và **fail-closed khi số liệu không tin cậy** (web không hiện số khi 5xx/mạng) — khớp hướng an toàn vận hành; **thiếu** so PRD M11: check-in thành công/từ chối theo lý do·cổng, email lỗi, freshness/as-of, export, drilldown.
4. **Event readiness** trên thị trường gắn publish state + guest status counts trên portfolio; Vemoki Project #3 đang có Story readiness `#228` / Task web `#229` (**Chờ duyệt** lúc snapshot) — đề xuất KPI readiness **phải** khớp PRD (publish ≠ mở đổi vé/check-in) và **không** nhầm sang BI đa event kiểu Cvent/Bizzabo.
5. **Độ phù hợp MVP:** học **IA + dictionary KPI + permission + trạng thái dữ liệu**; **không** đưa payment/revenue/seat/Wallet/Android/RFID/sponsor ROI vào đề xuất triển khai. Mọi mục dưới đây là **proposed**, chưa approved.

---

## 2. Persona / JTBD (đối chiếu PRD §3)

| Persona Vemoki | JTBD liên quan dashboard | Góc nhìn từ thị trường (học gì) | Không học / ngoài MVP |
| -------------- | ------------------------ | ------------------------------- | --------------------- |
| Event Manager | “Sự kiện sẵn sàng phát vé / mở cổng chưa? Quota và duyệt còn tắc không?” | Cột Published + counts trên Events Dashboard (Cvent/Splash **D**); Command Center hub (Bizzabo **M/V**) | Website builder, multi-track agenda |
| Supervisor | “Cổng đang vào bao nhiêu? Có lệch thiết bị / sync?” | OnArrival Stats: check-ins over time, by type, sessions (**D**); Go Onsite Analytics tab (**V** PDF + blog) | RFID location heatmaps |
| CS | “Email lỗi / yêu cầu chờ — xử lý mà không đụng config” | Thị trường nghiêng attendee list + status filter (**D** Splash); Vemoki đã có CS riêng — dashboard chỉ surface count | Lead retrieval, sponsor ROI |
| Scanner | “Quét nhanh, kết quả rõ” | App onsite + quyền hạn chế (**D** Cvent roles); offline sync (**V** Swoogo) | Kiosk thanh toán Stripe |
| Tenant Owner | “Nhiều event — cái nào cần chú ý?” | Cross-event reporting / portfolio (**M/D**) | Cross-event BI full enterprise |
| Platform Operator | Multi-tenant health | Bizzabo multi-tenant + RBAC mô tả cao (**V** security) | SOC marketing làm AC sản phẩm |

---

## 3. Bảng benchmark (mỗi dòng có source)

Ngày truy cập: **2026-10-18**.

### 3.1 Cvent (Event Management / OnArrival / Splash Events Dashboard trên domain support.cvent.com)

| Chủ đề | Nhận định | Mức | Source |
| ------ | --------- | --- | ------ |
| Báo cáo đa sản phẩm | Cvent có Reports theo từng sản phẩm (Event, OnArrival, Cross Event, BI, …); widget Summary / Grid / Graph; filter, save, schedule, share | **V** | [Your Guide to Running Reports in Cvent](https://support.cvent.com/articles/en_US/Knowledge/Your-Guide-to-Running-Reports-in-Cvent) — tiêu đề đúng URL; đã đọc full |
| Check-in realtime | OnArrival Event Stats: check-ins over time, Overall Stats, Check-ins by Type, Active Sessions; filter toàn event / today / last hour; session stats (registration type, capacity); RFID Locations (nếu có) | **D** | [Viewing Your Event's Stats in OnArrival](https://support.cvent.com/s/communityarticle/Viewing-Your-Event-s-Stats-in-OnArrival) — index hữu ích; WebFetch/curl = 503 / JS shell |
| Báo cáo OnArrival → Event Management | Mapping report: Event check-ins, by time, session attendance, device sync (OnArrival Device Details) | **D** | [Which report should I run to view OnArrival data?](https://support.cvent.com/s/communityarticle/Which-report-should-I-run-to-view-OnArrival-data) |
| Phân quyền onsite | Role OnArrival: Planner Full Access settings+app; Onsite Staff Full app / No settings; Temp/Scanner Read-Only hoặc No Access; login cần OnArrival login Full Access | **D** | [What permissions should I configure for OnArrival users?](https://support.cvent.com/s/communityarticle/What-permissions-should-I-configure-for-OnArrival-users); [Insufficient User Rights…](https://support.cvent.com/s/communityarticle/Why-am-I-seeing-Insufficient-User-Rights-when-logging-in-to-OnArrival) |
| Ai xem data OnArrival | Chỉ user Cvent có access event tương ứng trong Event Management; data trên device encrypted | **D** | [Who can access data collected in OnArrival?](https://support.cvent.com/s/communityarticle/Who-can-access-data-collected-in-OnArrival) |
| Portfolio / readiness UI | Events Dashboard cột: Published, dates, owner, Awaiting Reply, Attending, Checked-in Guests (+ Unique Page Visitors trong mô tả) | **D** | [What can I view on my Events Dashboard?](https://support.cvent.com/s/communityarticle/What-can-I-view-on-my-Events-Dashboard) — nội dung Splash-branded trên support Cvent |
| Analytics trang event | Page views, invited, RSVPs, checked-in, calendar adds; export CSV; Reporting tab đa event | **D** | [How do I view my event page analytics?](https://support.cvent.com/s/communityarticle/How-do-I-view-my-event-page-analytics) |
| Publish readiness | Published = guest-accessible; unpublished = team/collaborator; Coming Soon cho visitor | **D** | [Publish and Unpublish Events](https://support.cvent.com/s/communityarticle/Publish-and-Unpublish-Events) |
| Guest status / filter | Status lifecycle (Awaiting Reply → Attending → Checked In); filter + counts phục vụ báo cáo/email | **D** | [Navigating list with Columns, Statuses, and Filters](https://support.cvent.com/s/communityarticle/3-Navigating-your-list-with-Columns-Statuses-and-Filters) |
| Phù hợp Vemoki | Học: Stats gần realtime, quyền scanner hẹp, cột portfolio; **không** copy RFID / Cross-Event BI / hospitality suite | **I** | Tổng hợp trên |

### 3.2 Bizzabo

| Chủ đề | Nhận định | Mức | Source |
| ------ | --------- | --- | ------ |
| Analytics product | Dashboard tập trung; metrics nêu: check-ins, session attendance, ratings, app adoption; “real-time”; share nội/ngoài | **M** (+ **V** trang) | [Event Data Analytics](https://www.bizzabo.com/event-management-software/event-data-analytics) — đã đọc; là marketing |
| Command Center | Hub: check-in onsite, badge, permissions, registration/ticket types | **M/V** | [Product](https://www.bizzabo.com/product); PDF [Solutions Overview](https://welcome.bizzabo.com/hubfs/Bizzabo_Event_Experience_Operating_System-Solutions_Overview.pdf) |
| Onsite check-in | Dashboard + Onsite Command App: check-in event/session bằng tên hoặc QR; badge; SmartBadge/heatmap = engagement | **M/V** | [Onsite Event Management](https://www.bizzabo.com/event-management-software/onsite-event-management-software) |
| Phân quyền / bảo mật | RBAC: account admin quản team; event leaders quản attendee content; SSO/OAuth; multi-tenant logical segregation (mô tả) | **V** (policy-level) | [Security](https://www.bizzabo.com/security) |
| Knowledge Center | Docs how-to nằm sau login (`/hc/en-us/restricted`) | **V** (paywall/login) | [llms.txt → Knowledge Center](https://www.bizzabo.com/llms.txt); URL restricted — **chưa xác minh** chi tiết KPI dictionary / UI states trong KB |
| Onboarding FAQ | Có module “Creating first event + Event Dashboard”, “Data & Analytics”; Help Hub in-app | **V** | [Bizzabo Onboarding Workshop FAQ](https://events.bizzabo.com/Bizzabo-Onboarding-Workshop/page/4915332/custom-tab) |
| Pricing / audience | Annual subscription, enterprise mid-market; Knowledge + API cần account | **V** | [llms.txt Pricing](https://www.bizzabo.com/llms.txt) |
| Phù hợp Vemoki | Học: một hub ops + RBAC; **không** copy ROE/sponsor ROI, SmartBadge, virtual venue, CRM pipeline | **I** | Tổng hợp |

### 3.3 Swoogo

| Chủ đề | Nhận định | Mức | Source |
| ------ | --------- | --- | ------ |
| Live dashboards (marketing) | Live dashboards registrations/attendance/engagement; custom report builder; cross-event; CRM sync; revenue attribution | **M/V** | [In-Person Events](https://swoogo.events/in-person-events/) |
| Go Onsite check-in | Event/session/package check-in; QR hoặc tên; real-time attendance by registration type; VIP planner alerts; offline store-and-forward; Analytics tab trên app | **V** | [Go Onsite](https://swoogo.events/mobile/go-onsite/); [Blog 2024-11-08](https://swoogo.events/blog/introducing-go-onsite-swoogos-new-mobile-check-in-app/); PDF hướng dẫn NL [Go Onsite Check-In](https://assets.swoogo.com/uploads/6213886-694aa243548d3.pdf) |
| KPI dictionary (API) | `registered`, `checked_in`, `no_show`, `attendance_rate_percent` theo session; scan = audit trail | **V** | [Attendance MCP/API](https://developer.swoogo.com/mcp/tools/attendance); [Session scans overview](https://developer.swoogo.com/api-reference/overviews/session-scans) |
| Offline | Check-in offline; sync khi có mạng; badge printing vẫn cần Wi‑Fi (ghi chú sản phẩm) | **V** | Go Onsite product page |
| Onsite user | Onsite user có thể login nhiều device; enable app trong event settings | **V** | PDF hướng dẫn |
| Help Center public | `swoogo.supporthero.io` hầu như shell — **không** lấy được bài sâu | — | [Help Center](https://swoogo.supporthero.io/content) — chưa xác minh nội dung |
| Ngoài MVP | Onsite payment Stripe, kiosk Pro, CRM/revenue attribution | **M/V** | Go Onsite feature table; in-person page |
| Phù hợp Vemoki | Gần Vemoki nhất về **QR check-in + offline + analytics mỏng trên app**; vẫn thừa session/package/payment | **I** | Tổng hợp |

---

## 4. Đối chiếu Vemoki (PRD + source — không chỉ docs cũ)

### 4.1 Project #3 (snapshot `gh`, 2026-10-18)

- D0–D10 nhiều Epic/Task **Hoàn thành** (gồm `#21` reporting APIs, `#22` web admin dashboard) — **board Hoàn thành ≠ chứng minh PRD M11 đủ / UAT production**.
- D11 Epic `#222` **Đang làm**; Story readiness `#228` **Đang làm**; Task web readiness `#229` **Chờ duyệt**; Gate UX `#231` **Đang làm**; Web Gate `#232` **Sẵn sàng**.
- Đề xuất dưới đây là **proposed** cho review — không tự coi đã approved.

### 4.2 PRD (đã đối chiếu)

- **M11:** Dashboard: mã khả dụng, pending, vé cấp/hủy, quota còn, email lỗi, check-in thành công, từ chối theo lý do/cổng; định nghĩa chỉ số + thời gian cập nhật; trễ mục tiêu ≤ 10s pilot; export nền + audit; không lộ tenant khác.
- **M10:** Check-in một lượt/event (không session multi-checkpoint trong MVP); Supervisor undo có lý do; mất mạng không thành công giả.
- **Ngoài MVP:** payment/refund/transfer; seat map; Apple/Google Wallet; Android native.
- **Publish ≠** cửa sổ đổi vé / check-in (cấu hình độc lập).

### 4.3 Source đã đọc (graph CRG stale → lean-ctx + đọc file)

| Artifact | Kết luận ngắn |
| -------- | ------------- |
| `packages/backend/src/reporting.ts` | `readEventReport`: permission `report.read`; trả `ticketsByState` (ACTIVE/REVOKED/CANCELLED/USED), `quota.capacity/allocated`, `pendingApprovalCount`; **không** PII; **không** check-in/email metrics |
| `apps/api/src/reporting.ts` | `GET tenants/:tenantId/events/:eventId/report` |
| `apps/web/src/admin/report.ts` | `interpretEventReport`: 5xx/0/network → `unknown`, **không** hiện số giả |
| `apps/web/app/admin/admin-form.tsx` § Báo cáo sự kiện | UI thủ công “Tải báo cáo”; a11y heading + `role="status"` khi unknown |
| `apps/web/tests/admin-report.test.ts` | Bảo vệ không hiện stale counts khi lỗi |
| `packages/backend/test/reporting.test.cjs` | Isolation DB + `report.read` |
| Role map / migration | Owner/Manager có `report.read` (seed) |

**Graph limitation:** `user-code-review-graph-ticket` báo graph build SHA `3921f2e9…` ≠ HEAD `e8512d00…` — không dựa graph để kết luận; đã verify source.

### 4.4 Ma trận: hiện có / thiếu / chưa biết / không phù hợp

| Năng lực | Hiện có (source/PRD) | Thiếu vs PRD M11 / ops thị trường | Chưa biết (cần đo/UAT) | Không phù hợp MVP (từ thị trường) |
| -------- | -------------------- | ---------------------------------- | ---------------------- | ---------------------------------- |
| KPI vé theo state | Có | — | Đồng bộ wording UI với PRD “cấp/hủy” | — |
| Quota capacity/allocated | Có | “Quota còn lại” chưa expose explicit remaining | Denominator khi capacity null | — |
| Pending approval | Có | Deep-link CS/duyệt từ thẻ | — | — |
| Check-in success / reject by reason·gate | **Thiếu** trong report API | Cần aggregate từ Gate | Latency ≤10s | Session check-in multi-track (Cvent/Swoogo/Bizzabo) |
| Email lỗi count | **Thiếu** trên dashboard report | PRD M11 yêu cầu | — | Marketing email campaign analytics |
| Freshness / as-of timestamp | **Thiếu** trên payload | PRD “thời gian cập nhật” | Polling vs push | Scheduled enterprise report email |
| Filters / drilldown / export | Export quyền có trên role map; **chưa** xác minh đủ M11 trong scope báo cáo này | Filter theo cổng/thời gian | — | Cross-event BI, Splash RSVP funnel |
| Offline / device sync visibility | Gate offline là scope D7/D11 Gate — **chưa** surface trên admin report | Supervisor “thiết bị lệch” | Conflict queue UX `#231` | RFID live location |
| Portfolio readiness columns | Event list admin tồn tại; Story readiness `#228/#229` | Chuẩn checklist publish/windows/quota | AC `#229` đang Chờ duyệt | Page-view Unique Visitors |
| Permissions multi-tenant | `withTenant` + `report.read` | Scanner không cần report — đã tách hướng Cvent | Support impersonation M12 | Account-level marketing SSO attendee |
| Loading / empty / stale / error / a11y | Unknown + rejected có; empty = zeros sau 200 | Loading skeleton / empty copy; auto-refresh | — | Share dashboard public link (Bizzabo M) |

---

## 5. Ưu tiên proposed (impact · effort · risk)

Thang: Impact/Effort/Risk = Cao / Trung / Thấp. **Không** điền baseline/target số bịa.

| # | Đề xuất | Impact | Effort | Risk | Ghi chú |
| - | ------- | ------ | ------ | ---- | ------- |
| P1 | Bổ sung KPI check-in vào event report: success count + reject theo lý do (+ gate nếu có trong schema) | Cao | Trung | Trung | Khớp PRD M11 + pattern OnArrival/Go Onsite; cần dictionary denominator |
| P2 | Thêm `asOf` / nguồn dữ liệu + giữ fail-closed (đã có) khi stale | Cao | Thấp | Thấp | PRD freshness; thị trường nói “real-time” nhưng Vemoki cần honest latency |
| P3 | Surface email lỗi (count + deep-link CS), không resend từ KPI card | Cao | Trung | Thấp | PRD M11; JTBD CS |
| P4 | Portfolio readiness: cột publish + cửa sổ đổi vé/check-in + quota/pending (không copy RSVP Splash) | Cao | Trung | Trung | Align `#228/#229`; publish ≠ open windows |
| P5 | Auto-refresh có chủ đích (vd. khi event live) + empty/loading copy | Trung | Thấp | Thấp | Ops day-of; tránh spam API (TD: dashboard quá tải → giảm reporting trước Gate) |
| P6 | Drilldown reject/check-in list theo quyền | Trung | Cao | Trung | Sau P1; PII mask |
| P7 | Cross-event analytics / CRM / ROE / badge hardware | — | — | — | **Reject** cho MVP |

---

## 6. User stories + AC kiểm chứng được (proposed)

### US-B1 — Supervisor xem nhịp check-in theo event

**Given** user có `report.read` trên event đang mở cổng  
**When** mở báo cáo sự kiện (hoặc readiness ops view)  
**Then** thấy số check-in thành công và từ chối theo lý do (và theo cổng nếu có dữ liệu)  
**And** payload có `asOf` (ISO timestamp)  
**And** khi API 5xx/mạng: **không** hiện số cũ (giữ hành vi `interpretEventReport`)  
**Evidence:** test backend aggregate + web unknown; UAT headless admin.

### US-B2 — Event Manager đọc readiness không nhầm publish

**Given** event đã publish nhưng cửa sổ check-in chưa mở  
**When** xem danh sách/workspace readiness  
**Then** trạng thái phân biệt “đã publish” vs “đang mở check-in” vs “đang mở đổi vé”  
**And** không dùng một badge “Live” gộp cả ba  
**Evidence:** AC UI + fixture event; khớp PRD cửa sổ độc lập.

### US-B3 — CS thấy áp lực email lỗi từ dashboard

**Given** có outbox/email failed trong event  
**When** Manager/CS được quyền xem  
**Then** thẻ “email lỗi” = count; click → CS list đã có (không resend từ thẻ)  
**Evidence:** count đối soát query; a11y `role="status"` khi unknown.

### US-B4 — Scanner không cần (và không được) report portfolio

**Given** membership Scanner chỉ Gate  
**When** gọi report API  
**Then** 403 Authz  
**Evidence:** mở rộng `reporting.test.cjs` (đã có pattern `report.read`).

### Non-goals (AC phủ định)

- Không có session attendance rate / no-show theo agenda track trong MVP.
- Không có payment/refund KPI, seat occupancy, Wallet attach rate, Android native ops.
- Không public share link dashboard cho stakeholder ngoài tenant.

---

## 7. Đề xuất roadmap ownership + dependencies

| Wave | Việc | Ownership | Phụ thuộc |
| ---- | ---- | --------- | --------- |
| 0 | User chốt dictionary KPI check-in + có/không auto-refresh | Sản phẩm / BA | Câu hỏi §8 |
| 1 | Extend `EventReport` + tests | Backend (`packages/backend`, `apps/api`) | Schema Gate / check-in reasons đã có từ D3 |
| 1∥ | Web render KPI + asOf + copy VI | Web (`apps/web`) | Contract OpenAPI từ BE |
| 1∥ | Readiness columns (nếu chưa cover `#229`) | Web | Story `#228`; **không** trùng ownership nếu `#229` đang Chờ duyệt — coordinator hòa merge |
| 2 | Email failure count + link CS | Backend + Web | Outbox/notification model |
| 2 | Optional Gate device/sync summary cho Supervisor | Backend + iOS/Web Gate | D11-S3 `#230/#231/#232` |
| — | Export M11 đầy đủ | Backend + Web | Sau KPI ổn định; audit |

**Không** mở Story payment/CRM/sponsor vì benchmark enterprise.

---

## 8. Câu hỏi cần user quyết định

1. Dashboard day-of ưu tiên **Supervisor check-in** trước hay **Manager readiness/quota/duyệt** trước khi mở thêm KPI?
2. Denominator check-in: theo **vé USED** hay theo **lượt confirm Gate** (có thể khác nếu undo)?
3. Có chấp nhận **poll thủ công** (như UI hiện tại) cho pilot, hay bắt buộc auto-refresh ≤10s theo PRD?
4. `#229` readiness đang Chờ duyệt — research này chỉ **đề xuất bổ sung KPI**, hay được phép ảnh hưởng AC đã nộp?
5. Có cần **surface offline queue/conflict** trên admin web (học Swoogo/Cvent device report) trong D11, hay để Gate-only?

---

## 9. Giới hạn research

- Không đăng nhập Cvent/Bizzabo/Swoogo → **không** có runtime evidence UI đã authenticated.
- Cvent Community articles: body full **không** fetch được (503 / LEX shell); dựa **D** từ search index URL chính thức.
- Bizzabo Knowledge Center **restricted** — KPI/widget chi tiết **chưa xác minh**.
- Swoogo Help Center public gần như trống; bù bằng product/blog/PDF/developer API (**V**).
- Marketing “real-time / ROE / AI” **không** dùng làm SLO Vemoki.
- CRG ticket graph stale so với HEAD; đối chiếu source trực tiếp.
- Không đọc `docs/plans/DASHBOARD-RESEARCH.md` hay báo cáo BA nhóm khác trước khi chốt file này.
- Không đổi branch/git/code/board; không tạo Run/Dispatch.

---

## 10. File / nguồn đã đối chiếu (Vemoki)

- `docs/PRD.md` (§3 persona, §4 scope, M10–M12)
- `docs/TECHNICAL-DESIGN.md` (dashboard load / capacity notes)
- `docs/DECISION-LOG.md` (D11 UX nghiên cứu — tham chiếu ngắn)
- `docs/ROADMAP.md` (D11 gate)
- `docs/agents/roles/product-ba.md`, `docs/agents/README.md`
- `packages/backend/src/reporting.ts`, `report-error.ts`
- `packages/backend/test/reporting.test.cjs`
- `apps/api/src/reporting.ts`
- `apps/web/src/admin/report.ts`
- `apps/web/app/admin/admin-form.tsx` (section báo cáo)
- `apps/web/tests/admin-report.test.ts`
- Project #3 qua `gh project item-list` (snapshot cùng ngày)

**HEAD SHA ghi nhận:** `e8512d0055e0e9d6585007e8363b6224a7138b12`

---

*Hết báo cáo Nhóm B. Proposed ≠ approved.*
