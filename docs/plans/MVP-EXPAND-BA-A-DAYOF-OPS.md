# MVP Expand BA-A — Day-of operations (command center / scanner / resolution / escalation)

| Trường | Giá trị |
| --- | --- |
| Role | `product-ba` — [`docs/agents/roles/product-ba.md`](../agents/roles/product-ba.md) |
| Ownership | **Chỉ** file này (`docs/plans/MVP-EXPAND-BA-A-DAYOF-OPS.md`) |
| Ngày soạn | 2026-10-18 |
| Parent | Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) (O11 / D11) |
| Ủy quyền | Research docs-only — **không** feature coding / deploy / store; **không** tự Hoàn thành Issue |
| Ngôn ngữ | Tiếng Việt (giữ ID, API, SHA, URL nguyên bản) |
| Trạng thái | **Đề xuất** — chưa tự nâng thành scope coding đã duyệt |
| Architecture impact | **Không** (research). Contract mới chỉ là **đề xuất phụ thuộc** — cần user/coordinator chốt trước BE |

### Ranh giới tuyên bố

| Được | Không được |
| --- | --- |
| Phân biệt quan sát / suy luận / giả thuyết | Bịa interview, metrics đã đo, UAT venue thật |
| Benchmark public Help Center (không login competitor) | Hồi sinh Android / payment / seat / Wallet / RFID / badge print |
| Đề xuất Story + Given/When/Then AC + ownership | Đổi invariant O05 / tenant / quota / check-in chống trùng |
| Map gap vs source HEAD + D11 #228–#235 | Sửa `apps/**`; spawn worker con; claim pilot ready |

---

## 1. Problem / outcome theo persona

**Vấn đề (suy luận từ PRD §3 + source + benchmark):** Vemoki đã có Gate reserve/confirm, offline iOS (D7/ADR-18), CS tra cứu/resend, và báo cáo event cơ bản — nhưng **ngày sự kiện** vẫn thiếu mô hình vận hành tách vai rõ: làn quét nhanh vs bàn xử lý ngoại lệ vs giám sát Supervisor vs “command center” cho Manager. D11 (#228–#235) cải thiện UX theo bề mặt; **chưa** đóng gói day-of ops như một hệ thống handoff.

| Persona | JTBD ngày sự kiện | Outcome mong muốn (đề xuất) |
| --- | --- | --- |
| **Scanner** | Khi hàng đông / mạng kém, quét QR và biết ngay admitted / queued / denied / unknown — **không** dừng làn để tra cứu dài | Throughput cao; không vào trùng (O05); escalate nhanh khi không resolve trong vài giây |
| **Supervisor** | Khi Scanner báo unknown / conflict / nhầm admit, xử lý ngoại lệ có lý do + audit; quyết định cho vào / giữ / undo | Exception có dấu vết; Scanner không tự override vé giả/sai event/thu hồi (PRD M10) |
| **CS** | Khi khách mất email/QR hoặc email DEAD, tra cứu + resend **không** chen vào làn scan | Hỗ trợ song song cổng; không sửa quota; không biến CS thành “force admit” không policy |
| **Event Manager** | Khi cửa mở, muốn thấy nhịp check-in / reject / queue / email cần CS — **aggregate**, không PII | “Command center” đọc được trong vài giây; quyết định thêm thiết bị / đổi làn / gọi Supervisor |

**Outcome nghiên cứu này:** đủ AC để Epic planner tách Story/Task day-of **sau** user chốt §7 — không tự mở coding.

---

## 2. In / out of scope

### In (đề xuất — khớp O10 / O11 / O12 vận hành)

| In | Ghi chú |
| --- | --- |
| Pattern **3 bề mặt day-of**: Scanner lane · Resolution desk · Supervisor escalation | Map PRD M10 + M11; không bắt buộc app staff riêng (O02) |
| **Command center** (Manager): live/định kỳ EventReport + trạng thái vận hành | Phụ thuộc O12 EventReport Wave P1 (#241 / PR #242) + consumer web |
| Fail-closed web Gate; iOS offline queue clarity (tiếp #230/#232, không thay ADR-18) | Giữ D7 |
| Handoff Scanner → Supervisor (và tuỳ chọn CS) bằng quy trình + quyền hiện có / tối thiểu | Không invent “force admit” vô audit |
| Manual lookup / door-list **chỉ** khi user chốt mở capability (O11 từng **cấm tự mở**) | Có thể = resolution desk; contract cần escalate |

### Out / reject (khớp O10 + O11 + hủy #7)

| Out | Lý do |
| --- | --- |
| Android native / Google Play | O10 hủy |
| Payment / refund / transfer / bán vé cửa | O10; Humanitix “Tap to Pay” **không** copy |
| Seat map / RFID / badge print / kiosk hardware | O10 + reject research này |
| Apple/Google Wallet | O10 hủy |
| Re-entry / multi-session mặc định | O05 một vé → một lượt |
| Custom domain/sender, SSO, billing, workflow builder | O07 / sau MVP |
| Deploy prod / store submit / O06 số liệu retention | Cần ủy quyền riêng |

### O12 — tái lập từ vận hành board (quan sát có hạn chế)

`docs/DECISION-LOG.md` trên HEAD worktree này (**chưa** có mục O12 văn bản). O12 được **điều phối coi là đã chốt** qua Issue [#241](https://github.com/hangndat/ticket-solution/issues/241) / PR [#242](https://github.com/hangndat/ticket-solution/pull/242) (DoD PASS with known gap trên SHA `4f6530bfb3d81a514493c7f1385896757e2e9428`): mở rộng `EventReport` aggregate-only (`checkInSuccessCount`, `rejectByReason`, `quotaRemaining`/`quotaCapacityState`, `emailNeedsCsCount`, `asOf`); giữ `report.read` + assignment; **không** breakdown theo cổng trong wave P1.

`docs/plans/DASHBOARD-MARKET-SYNTHESIS.md` — **không có trên disk** worktree này / `origin/main` tại thời điểm research; tham chiếu #241. Insight dashboard lấy từ PRD M11 + public Ticket Tailor/Humanitix + contract O12 ở trên (ghi §7).

---

## 3. Gap vs source + D11 đã duyệt (#228–#235)

### 3.1 Source HEAD (quan sát code)

**Source HEAD research:** `e8512d0055e0e9d6585007e8363b6224a7138b12` (`git rev-parse HEAD`).

CRG `code-review-graph-ticket` build tại cùng SHA (`head_matches_build=true`); verify source sau graph.

| Vùng | Hiện trạng (quan sát) | Gap day-of |
| --- | --- | --- |
| BE Gate `packages/backend/src/gate.ts` | `openStaffSession` / `reserveCheckin` / `confirmCheckin` / `undoCheckin` (reason) / `revokeTicket` | Có exception API; **chưa** model handoff/escalation ticket giữa Scanner–Supervisor |
| BE CS `packages/backend/src/cs.ts` | `listCsTickets` / `getCsTicket` (timeline) / `resendTicketEmail` | CS = hỗ trợ email/vé; **không** gắn “resolution desk tại cổng” |
| BE Report `reporting.ts` (HEAD này) | `ticketsByState`, quota, `pendingApprovalCount` | Thiếu field O12 live-ops; PR #242 chưa nằm trên HEAD này |
| iOS `apps/mobile/src/gate/gate-scan.ts` | Phases + offline queue + `classifySupervisorOp` (admission vs not-admission) | UX/state D11-S3-T1 (#231) đã đóng; **chưa** door-list / escalate UI có chủ đích |
| Web `/gate` | Fail-closed offline; copy hướng iOS queue ADR-18 | #232 còn OPEN — phản hồi rõ + fail-closed khi mất mạng |
| Web admin | `admin-form.tsx` vẫn gom CS + report; #228/#229 CLOSED (workspace theo việc) — pixel live phụ thuộc merge `main` | Chưa có **command center day-of** riêng (live check-in / reject / emailNeedsCs) |

### 3.2 D11 board (#228–#235) — trạng thái tại thời điểm research

| Issue | Tiêu đề rút gọn | State | Liên hệ day-of |
| --- | --- | --- | --- |
| [#228](https://github.com/hangndat/ticket-solution/issues/228) | S2 Admin theo việc / readiness | CLOSED | Nền IA admin; **chưa** = command center live |
| [#229](https://github.com/hangndat/ticket-solution/issues/229) | S2-T1 Web admin workspace | CLOSED | AC admin; O12 consumer **không** nằm trong AC #229 |
| [#230](https://github.com/hangndat/ticket-solution/issues/230) | S3 Staff Gate rõ kết quả / sync | OPEN | Parent Gate day-of |
| [#231](https://github.com/hangndat/ticket-solution/issues/231) | S3-T1 iOS Gate queue/conflict | CLOSED | Scanner/offline UX nền |
| [#232](https://github.com/hangndat/ticket-solution/issues/232) | S3-T2 Web Gate fail-closed | OPEN | Web dự phòng cổng |
| [#233](https://github.com/hangndat/ticket-solution/issues/233)–[#235](https://github.com/hangndat/ticket-solution/issues/235) | Attendee web/iOS | OPEN | Khách nhận QR — **ngoài** day-of staff ops (phụ thuộc gián tiếp: QR sẵn sàng) |

O11 phê duyệt thực thi: **không** tự mở validate-only / manual lookup / metrics mới. O12 Wave P1 (#241) là ngoại lệ metrics/report đã điều phối riêng.

### 3.3 Benchmark thị trường (public, 2026-10-18 — không login)

| Pattern | Ticket Tailor | Humanitix | Áp dụng Vemoki (suy luận) |
| --- | --- | --- | --- |
| Scanner lane | Tab Scanner; green/red; offline sau download event | Scan tab; confirm ngắn rồi next | Khớp iOS Gate + #231; giữ fail-closed |
| Resolution / door list | Doorlist search + manual check-in | Search name/order; check-in groups/filters | = **resolution desk**; Vemoki chưa có; O11 cấm tự mở → cần chốt §7 |
| Command center | App Dashboard count + box-office reports | Host prep + filters; sync khi có mạng | = EventReport O12 + UI Manager |
| Escalation | Multi-user; ẩn PII check-in users | “Dedicated scanners… know who/when to escalate” | Supervisor + CS tách khỏi làn quét |
| Reject copy | On-door sales, seated, Android parity | Tap to Pay, Wallet, Android | **Reject** (O10) |

Nguồn: [TT Check-in collection](https://help.tickettailor.com/en/collections/2969840-check-in-and-event-day), [TT check-in data](https://help.tickettailor.com/en/articles/5028380-how-to-see-your-check-in-data), [Humanitix get ready](https://help.humanitix.com/en/articles/8896580-get-ready-to-check-in-your-event), [Humanitix Hosts app](https://help.humanitix.com/en/articles/13753417-how-to-use-the-humanitix-for-hosts-app).

---

## 4. Proposed stories + AC (Given/When/Then) + ownership

> **Chưa approved coding.** ID tạm `DOF-*` cho planner map Issue mới hoặc mở rộng #230.

### DOF-S1 — Scanner lane “không dừng hàng” (P0 UX / quy trình)

**Ownership:** `ios` (chính) · `web` (Gate dự phòng, sau/∥ #232) · BE chỉ nếu thiếu projection (escalate)

**AC**

1. **Given** nhân viên Scanner có quyền Gate và session staff active, **When** quét QR hợp lệ online, **Then** UI hiển thị trạng thái admitted trong một bước nhìn (không lẫn queued/unknown) và không tạo check-in trùng (O05).
2. **Given** mất mạng trên iOS sau khi đã có session, **When** quét tiếp với offline queue, **Then** phase queued/pending **không** dùng màu/copy thành công; sync ADR-18 khi có mạng (DUPLICATE/CONFLICT/REJECTED phân biệt).
3. **Given** kết quả `unknown` / conflict / denied không resolve được trong policy Scanner, **When** Scanner chọn escalate, **Then** UI chỉ dẫn Supervisor (copy VI + không auto-admit); Scanner không gọi `undoCheckin` / revoke.

### DOF-S2 — Resolution desk (manual lookup) — **optional, cần user chốt**

**Ownership:** `ios` ± `web` · `backend` **chỉ nếu** thiếu search/admit-by-id contract (Issue riêng; **không** auto-approve OpenAPI)

**AC** (chỉ hiệu lực khi user chọn IN)

1. **Given** khách không mở được QR, **When** staff resolution desk tìm theo trường được phép (email/mã hiển thị/ticket id — chốt §7), **Then** thấy trạng thái vé + check-in hiện tại; thao tác admit đi qua cùng reserve/confirm (hoặc equivalent) với audit.
2. **Given** role Scanner-only, **When** mở resolution desk, **Then** không export danh sách đầy đủ / không sửa quota; PII tối thiểu theo policy.
3. **Given** O05 vé đã check-in, **When** tra cứu, **Then** không admit lần hai; escalate Supervisor nếu cần undo.

### DOF-S3 — Supervisor escalation desk (P0 nghiệp vụ)

**Ownership:** `ios` + `web` (bề mặt Supervisor) · BE sẵn `undoCheckin` — chỉ mở rộng nếu thiếu list-unknown / audit query

**AC**

1. **Given** op Gate `unknown` hoặc conflict, **When** Supervisor mở danh sách ngoại lệ phiên/event, **Then** thấy đủ ngữ cảnh để quyết định (ticket/event, phase, message) **không** hiện như đã admitted.
2. **Given** admit nhầm, **When** Supervisor `undoCheckin` kèm reason bắt buộc, **Then** audit giữ lịch sử gốc; Scanner không thực hiện được thao tác này.
3. **Given** vé giả / sai event / thu hồi, **When** Scanner hoặc Supervisor xử lý, **Then** không có đường “force admit” bỏ validation backend.

### DOF-S4 — Command center Manager (P1 — phụ thuộc O12 merge)

**Ownership:** `web` (consumer) · `backend` đã có Wave P1 #241 — **không** trộn AC #229

**AC**

1. **Given** Manager có `report.read` + assignment event, **When** mở command center / panel Cổng ngày sự kiện, **Then** thấy tối thiểu: `checkInSuccessCount`, `rejectByReason` (top), `quotaRemaining`/`quotaCapacityState`, `emailNeedsCsCount`, `asOf` — hoặc trạng thái unknown fail-closed (không số giả).
2. **Given** HTTP 5xx / network error, **When** refresh report, **Then** UI `unknown` — không giữ số cũ như đang đúng (cùng tinh thần `interpretEventReport` hiện tại).
3. **Given** chỉ quyền Scanner, **When** gọi report API, **Then** bị từ chối; UI không lộ aggregate vượt quyền.

### DOF-S5 — CS song song cổng (P1 quy trình + IA)

**Ownership:** `web` (CS workspace) · BE `cs.ts` hiện có

**AC**

1. **Given** `emailNeedsCsCount` > 0 (sau O12), **When** Manager/CS mở Hỗ trợ, **Then** vào được luồng list/resend hiện có; không đi qua Gate admit.
2. **Given** CS resend email, **When** thành công/idempotent, **Then** không đổi trạng thái check-in; audit/notification theo contract hiện tại.

---

## 5. Dependencies

| Dependency | Loại | Ghi chú |
| --- | --- | --- |
| **D7 / ADR-18** offline Gate | Hard (đã có) | Không thay protocol; DOF-S1 xây trên queue iOS |
| **O12 EventReport** #241 / PR #242 | Hard cho DOF-S4 | Tip DoD `4f6530bf…`; HEAD research chưa merge — consumer web chờ integration |
| **D11 #230 / #232** Gate UX | Soft/parallel | Hoàn thiện nền Scanner web/iOS trước hoặc ∥ DOF-S1 |
| **D11 #228 / #229** admin IA | Soft | Chỗ gắn command center (nhóm Cổng) — không reopen AC #229 tùy tiện |
| **S-P1-C validate-only / manual lookup** (D11 BA) | Gate user | = DOF-S2; O11 cấm tự mở |
| Contract mới (door-list search, escalate thread) | Optional | Architecture impact **Có** nếu user chọn IN — escalate coordinator |
| Attendee #233–#235 | Soft | QR/email sẵn sàng giảm tải resolution desk |
| PD handoff day-of | Soft | Flows Scanner / Supervisor / Manager — có thể song song sau user chốt |

---

## 6. Non-goals + câu hỏi cần user chốt

### Non-goals (đợt đề xuất này)

- RFID, badge printer, kiosk PIN hardware, seat assignment UI  
- On-door payment / Tap to Pay / revenue dashboard  
- Android staff app; Wallet pass  
- Re-entry / check-out mode (khác O05)  
- Realtime websocket bắt buộc (poll/`asOf` đủ cho P1 trừ khi user đòi)  
- Claim pilot/venue-ready chỉ vì có Story

### Câu hỏi chốt (user)

1. **Resolution desk (DOF-S2 / S-P1-C):** IN đợt này, DEFER sau #232, hay REJECT tới sau pilot?  
2. **Trường tra cứu được phép** tại cổng: email? mã hiển thị? tên? (PII vs tốc độ)  
3. **Escalate:** chỉ copy/handoff miệng + quyền Supervisor, hay cần queue ngoại lệ có ID trong product?  
4. **Command center:** chỉ web admin (Manager), hay thêm tóm tắt iOS staff theo quyền?  
5. **O12 consumer:** ship web ngay sau merge #242, hay gói chung Story day-of?  
6. Có cần **ghi O12 + DASHBOARD-MARKET-SYNTHESIS** vào `docs/` trên `main` (hiện thiếu file) trước wave UI?

---

## 7. Source HEAD + giới hạn research

| Mục | Giá trị |
| --- | --- |
| Worktree branch | `hangndat/mvp-expand-ba-a-dayof` |
| **Source HEAD** | `e8512d0055e0e9d6585007e8363b6224a7138b12` |
| Graph | `code-review-graph-ticket` full build @ cùng SHA; verify `gate.ts` / `cs.ts` / `gate-scan.ts` / `/gate` / `reporting.ts` |
| O12 code tham chiếu | PR #242 tip `4f6530bfb3d81a514493c7f1385896757e2e9428` (sibling worktree) — **không** merge vào HEAD research |
| Không có | User study; venue UAT; `DASHBOARD-MARKET-SYNTHESIS.md` on-disk; mục O12 trong `DECISION-LOG.md` @ HEAD/`main` |
| Không chạy | Feature coding; deploy; store; đổi Project → Hoàn thành |

**Phân loại bằng chứng:** bảng source/board/benchmark = quan sát; JTBD/story ưu tiên = suy luận BA; câu trả lời §6 = giả thuyết chờ user.

---

## 8. Handoff

- Artifact cho Epic planner / coordinator: map `DOF-S*` → Issue/Task, wave max fan-out (BE contract optional ∥ web command center ∥ iOS escalate) sau khi user trả lời §6.  
- PD: prototype day-of (Scanner lane vs resolution vs Supervisor) **sau** chốt DOF-S2.  
- Không spawn coding từ file này.
