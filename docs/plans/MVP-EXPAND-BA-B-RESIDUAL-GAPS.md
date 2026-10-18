# MVP Expand — BA-B: Inventory gap còn lại (độc lập)

**Role:** `product-ba` · `docs/agents/roles/product-ba.md`  
**Ngày soạn:** 2026-10-18  
**HEAD worktree:** `e8512d0055e0e9d6585007e8363b6224a7138b12`  
**Loại:** đề xuất ưu tiên — **không** tự approve coding / merge / deploy / store / đóng board.

> Nghiên cứu độc lập wave BA-B. **Không** đọc artifact `MVP-EXPAND-BA-A-*`. Không sửa `apps/**`. Không spawn worker con.

---

## 0. Phân loại bằng chứng

| Loại | Nghĩa | Ví dụ dùng trong báo cáo này |
| --- | --- | --- |
| **Quan sát (observed)** | File/board/PR/source tại thời điểm viết | Project #3 active items; PR #242; D4 UAT invite CSRF; `vemoki.com/privacy` 404 trong baseline D11; `EventReport` trên HEAD này chỉ ticket/quota/pending |
| **Suy luận (inferred)** | Kết luận hợp lý từ PRD + observed | Multi-event Owner overview còn thiếu vì admin gắn báo cáo per-event; validate-only chưa có symbol trong Gate |
| **Giả thuyết (hypothesis)** | Cần user chốt — **không** là yêu cầu đã duyệt | Độ rộng đợt sau D11; có mở S-P1-C Gate modes hay không |

**Graph CRG:** `code-review-graph-ticket` tại lúc soạn trả 0 node + `head_matches_build=false` (built `3921f2e…`, head `e8512d0…`) — **không** dùng làm proof; spot-check bằng source/docs.

**Thiếu artifact bắt buộc trong task:** `docs/plans/D11-IMPLEMENTATION-TRACKER.md` **không tồn tại** trên disk (chỉ có `D11-UX-PRODUCTION-PLAN.md`, `D11-BA-RESEARCH.md`, `D11-REVIEW-PACKAGE.md`). Theo dõi tiến độ D11 lấy từ **Project #3** + plan/specs `docs/tasks/d11/`.

---

## 1. Inventory gap còn lại vs PRD MVP + evidence

Baseline chức năng D0–D10: ROADMAP đối chiếu live ghi D0–D10 **Hoàn thành** trên board (snapshot lịch sử 17/10 trong ROADMAP §1 không dùng làm status). PRD §4 MVP mở rộng + §5 ma trận vẫn yêu cầu vài bề mặt ops/UX chưa đóng bằng evidence production-path.

### 1.1 Board Project #3 (chỉ Sẵn sàng / Đang làm / Chờ duyệt)

Checkpoint `gh project item-list 3 --owner hangndat --limit 200` (2026-10-18):

| Status | # | Title |
| --- | --- | --- |
| Đang làm | 222 | [D11] Mở rộng MVP: nghiên cứu và thiết kế UX/UI cho vận hành production |
| Đang làm | 230 | [D11-S3] Trải nghiệm nhân viên cổng rõ kết quả và đồng bộ |
| Sẵn sàng | 232 | [D11-S3-T2] Web Gate: phản hồi rõ và fail-closed khi mất mạng |
| Sẵn sàng | 233 | [D11-S4] Trải nghiệm khách nhận vé và mở QR xuyên web/iOS |
| Đang làm | 234 | [D11-S4-T1] Web khách: nội dung, đổi mã, khôi phục lỗi và vé |
| Đang làm | 235 | [D11-S4-T2] iOS khách: sự kiện, đổi mã, ví và QR dễ dùng |
| Đang làm | 236 | [D11-S5] Bằng chứng UAT và nghiệm thu UX/UI tích hợp |
| Chờ duyệt | 241 | [D11] Backend: mở rộng EventReport theo O12 (Wave P1) |

**Đếm:** Chờ duyệt **1** · Sẵn sàng **2** · Đang làm **5**. WIP duyệt **chưa đầy** (≥3 Chờ duyệt).

**Đang chạy D11 (không liệt kê lại như “gap chưa mở”):** Gate feedback/offline (#230/#232), attendee web/iOS recovery (#233–#235), UAT tích hợp (#236). Phê duyệt O11/ROADMAP: validate-only/manual lookup, metrics mới, O06 số liệu, publish privacy, deploy prod, store submit **không** tự mở từ D11.

### 1.2 Gap inventory (residual sau / ngoài wave D11 đang chạy)

| ID | Gap | PRD / quyết định | Evidence observed | Trạng thái vs D11 |
| --- | --- | --- | --- | --- |
| G1 | **Owner invite onboarding** (UI HTTP thành công + copy lỗi VI; không SQL bypass) | PRD §3 Owner; §7 demo bước 1; M02 invite | Source: `packages/backend/src/membership-invite.ts` (`createMembershipInvite` / `acceptMembershipInvite`); web `/invite` + BFF accept. **Gap:** [D4-TENANT2-PROD-UAT](../reviews/D4-TENANT2-PROD-UAT.md) — CSRF/`CSRF_ORIGIN_MISMATCH` trên `/invite`; UAT dùng DB `accept_membership_invite`; outbox invite email PENDING. Spec đề xuất `D11-B2-web-invite` **CHƯA** Issue Sẵn sàng trên board | **Ngoài** Stories D11 đang Đang làm; vẫn P0 residual |
| G2 | **CS / email recovery UX** (timeline + resend rõ PENDING≠DELIVERED; brand preview) | PRD M09 resend; M11 CS lookup/timeline | Source: BE `cs.ts` (`listCsTickets` / `getCsTicket`+timeline / `resendTicketEmail`); web `apps/web/src/admin/cs.ts` + BFF resend. D4 UAT CS list PASS (masked). Gap UX: copy delivery/user-facing + template brand (BA P1-4); deliverability ops (O07 sender platform) | CS surface gắn admin IA; attendee “khôi phục” #234 ≠ CS ops |
| G3 | **Pilot gates — O06 chưa chốt** | DECISION-LOG O06 **Giữ mở**; `docs/ops/O06-OPTIONS.md` | Không có số retention/region/SLA trong DECISION-LOG. Chặn ingest PII thật | **Pilot blocker** — không phải gap code D11 |
| G4 | **Privacy URL + store prep ≠ submit** | PRD §11–12; D10; O11 cấm tự submit | [D11-DISCOVERY-BASELINE](../reviews/D11-DISCOVERY-BASELINE.md) + D10 ASC: `https://vemoki.com/privacy` **404**; draft docs có, host live chưa | **Pilot/store blocker**; D11 OUT publish privacy |
| G5 | **O12 Dashboard Wave P1 (EventReport)** vs **multi-event Owner overview (defer)** | PRD M11 dashboard; Issue #241 tham chiếu O12 | Board: #241 **Chờ duyệt**; PR [#242](https://github.com/hangndat/ticket-solution/pull/242) tip `4f6530bf…`, DoD PASS w/ known gap, CI xanh — **chưa merge**. Trên HEAD worktree này `EventReport` vẫn chỉ `ticketsByState` / `quota` / `pendingApprovalCount` (`reporting.ts`). Admin: báo cáo **một** event trong `admin-form.tsx` (~1930 LOC) + `listEvents` — **không** có màn Owner multi-event overview | Wave P1 = contract report **per event**; **multi-event overview = defer** (task BA-B) |
| G6 | **Validate-only / manual lookup Gate** | PRD M10 “nhập mã thủ công theo quyền”; D11 OUT cứng | Spot-check: **0** match `validate_only` / `manual lookup` trong `gate.ts`; không thấy `manualCode`/`scanMode` trong BE/api/mobile qua rg. Spec optional `D11-B4-backend-validate-only` CHƯA APPROVED | **OUT D11** — chỉ mở sau user chốt + audit capability |
| G7 | **Instrumentation / metrics product** | PRD §13 chỉ số; D11 OUT metrics mới | BA: baseline analytics **chưa đo**. Spec `D11-B7-*` TEMPLATE. Không có product event analytics production trong evidence D0–D10 đã đọc | **P2 / optional** — không block code complete D11 |
| G8 | **DECISION-LOG thiếu mục O12 trên HEAD này** | Issue #241 body trích `DECISION-LOG.md` O12 | File `docs/DECISION-LOG.md` trên HEAD kết thúc O11; **không** có bảng O12 | Docs drift vs board — coordinator cần ghi O12 khi merge/đóng quyết định |
| G9 | **O07 custom domain/sender** | DECISION-LOG O07 **Không** trong MVP | Đã chốt sau MVP | **Reject/defer cứng** |
| G10 | **Phạm vi hủy O10** | Android / payment / seat / Wallet | ROADMAP §6; O10 | **Reject cứng** |

### 1.3 Source spot-check (invite / CS / email) — tóm tắt

| Path | Quan sát |
| --- | --- |
| `membership-invite.ts` | API create/accept/revoke; Owner first accept → tenant ACTIVE; TTL từ security config |
| `apps/web/app/invite/*` | Token qua `#fragment` + sessionStorage; POST BFF accept; có state loading/error |
| `cs.ts` (BE) | `cs.lookup` / `cs.resend`; mask email; timeline; resend idempotent outbox |
| `support-grant.ts` | Platform support grant TTL + audit read — liên quan CS platform, không thay CS tenant UX |
| `email-adapter` / notification | Resend ≠ issue vé mới (khớp M09) — chi tiết delivery vẫn ops |

---

## 2. Đề xuất ưu tiên P0–P3 (ownership + dep thật)

> Chỉ đề xuất. Coordinator / user duyệt trước khi tạo Issue coding. **Architecture impact:** ghi rõ khi đụng contract.

### P0 — Nên làm trước khi tuyên bố gần pilot / production-path Owner

| ID | Việc | Ownership | Dep thật | Architecture impact |
| --- | --- | --- | --- | --- |
| P0-A | **Prod revalidate invite HTTP** + copy lỗi VI (đóng G1) | `web` (+ `reviewer-dod` ± security) | Soft: PD invite notes; **không** invent invite API. Revalidate sau mọi CSRF/BFF fix còn lại | **Không** (trừ escalate nếu thiếu field) |
| P0-B | **Chốt O06** retention/region/SLA tối thiểu (đóng G3) | User/product + ops → coordinator ghi DECISION-LOG | Chặn trước PII thật / DPA | Policy — không code bắt buộc ngay |
| P0-C | **Privacy nội dung duyệt + host 200** khi ủy quyền deploy (G4) | `web` + coordinator deploy **có ủy quyền** | Nội dung legal duyệt; O06 không bịa số trên page | **Không** contract |
| P0-D | Hoàn tất wave D11 đang chạy (Gate + attendee + UAT #230–#236) theo AC Issue | `web` / `ios` / coordinator UAT | Đã Đang làm / Sẵn sàng — không mở thêm feature cùng slice nếu WIP | Theo từng Task |

### P1 — Sau / song song khi slot rảnh (không block P0 policy)

| ID | Việc | Ownership | Dep thật | Architecture impact |
| --- | --- | --- | --- | --- |
| P1-A | **Merge + integrate EventReport O12 Wave P1** (#241 / PR #242) sau DoD đã PASS | coordinator integration (đã có DoD) | CI xanh trên SHA `4f6530bf…`; không đụng web/iOS trong PR đó | **Có — contract EventReport** (đã đề xuất trên PR; consumer web **sau** merge = Task `web` riêng) |
| P1-B | **CS / email recovery UX** trên admin (delivery state, resend cooldown copy, timeline dễ đọc) | `web` | BE CS API đã có; soft sau/gộp admin IA nếu còn P0 admin trong D11 | **Không** trừ khi thiếu field delivery |
| P1-C | Web consumer hiển thị field EventReport mới (check-in/reject/quotaRemaining/emailNeedsCs/asOf) | `web` | **Hard:** merge #242 + OpenAPI regenerated trên `main` | Consume contract — không tự đổi schema |
| P1-D | Admin readiness / IA residual nếu D11 admin chưa phủ CS panel | `web` | Soft: sau P0 admin D11 nếu còn | **Không** |

### P2 — Backlog có chủ đích

| ID | Việc | Ownership | Dep thật | Architecture impact |
| --- | --- | --- | --- | --- |
| P2-A | **Multi-event Owner overview** (đã defer khỏi O12 Wave P1) | `web` ± `backend` | Cần product chốt IA (danh sách event + KPI cross-event). Nếu cần aggregate API mới → proposal riêng | **Có nếu** API aggregate mới; **Không** nếu chỉ compose `listEvents` + N×`readEventReport` (cân nhắc perf) |
| P2-B | Metrics instrumentation tối thiểu (PRD §13) | `backend` + coordinator docs | Soft: định nghĩa metric BA; user muốn đo | **Có** nếu event schema/analytics mới |
| P2-C | Invite email DELIVERED trên SMTP prod (ops) | backend/ops | ADR-13 SMTP; không transactional SaaS | Ops — không UX-only |
| P2-D | a11y / motion residual | `web` hoặc `ios` | Sau P0 surfaces | **Không** |

### P3 — Sau MVP / chỉ khi user mở lại

| ID | Việc | Ghi chú |
| --- | --- | --- |
| P3-A | Custom domain / sender (O07) | Đã chốt **sau MVP** |
| P3-B | Validate-only + manual lookup Gate (G6) | D11 OUT; PRD M10 gợi ý — cần capability audit + user duyệt; có thể cần contract |
| P3-C | Supervisor exception UX polish sâu | Không block pilot path tối thiểu |

---

## 3. Explicit REJECT / defer

| Mục | Quyết định đề xuất | Lý do |
| --- | --- | --- |
| Android native; payment/refund/transfer; seat map; Apple/Google Wallet | **REJECT** (MVP) | O10 / PRD §4 |
| Custom domain/sender ngay release đầu | **DEFER** sau MVP | O07 đã chốt |
| Validate-only / manual lookup trong wave D11 hiện tại | **DEFER** (OUT phê duyệt D11) | ROADMAP/O11; mở = quyết định user riêng |
| Metrics instrumentation tự mở từ D11 | **DEFER** | O11 cấm tự mở |
| Multi-event Owner overview trong O12 Wave P1 | **DEFER** (đã tách) | #241 chỉ EventReport per-event; overview = P2-A |
| Deploy prod / store submit “vì D11 xong” | **REJECT** suy diễn | Cần ủy quyền task riêng |
| Tuyên bố pilot ready từ `worker_done` / prototype / board Hoàn thành D0–D10 | **REJECT** | ROADMAP §1.1 |
| Đọc/merge kết luận BA-A để “thống nhất” trong artifact này | **REJECT** (constraint task) | Wave độc lập; reconcile do coordinator |

---

## 4. Pilot-ready blockers (tách khỏi code complete)

| Gate | Blocker? | Evidence / ghi chú |
| --- | --- | --- |
| **O06** retention / region / SLA | **Có** | DECISION-LOG Giữ mở; O06-OPTIONS chưa ký số |
| **Privacy URL live + nội dung duyệt** | **Có** (store/public trust) | 404 tươi baseline D11 |
| **Invite Owner path HTTP trên prod** | **Có** (onboarding pilot tenant) | D4 known gap — chưa revalidate PASS |
| **Device UAT** camera/push/venue | **Có** nếu claim pilot gate đầy đủ | Headless/sim ≠ device; một phần D5 |
| **EventReport O12 merge** | **Không** bắt buộc pilot tối thiểu; **Có** nếu claim dashboard M11 đủ số | #241 Chờ duyệt — code complete ≠ acceptance đến khi merge+Hoàn thành |
| **Multi-event overview** | **Không** block pilot 1-event | Đã defer |
| **Instrumentation** | **Không** block pilot tối thiểu | PRD §13 chưa đo — nêu rõ “chưa đo” |
| **Deploy prod ủy quyền** | Theo task | Không mặc định |
| **Store submit** | **Có** nếu mục tiêu public App Store | D10 prep ≠ submit |

**Phân biệt:** D11 Stories Đang làm → hướng **acceptance UX**; đóng hết #230–#236 **không** tự bằng pilot ready.

---

## 5. Câu hỏi user cần chốt

1. **O06:** Chọn khung retention (ngày/anonymize), region (A/B/C trong O06-OPTIONS), SLA support P1 trong cửa sổ event — hay “không ingest PII ngoài demo đến khi chốt”?
2. **Invite P0:** Ưu tiên Issue `web` invite revalidate **ngay** (song song D11 attendee) hay xếp sau khi #234/#235 xong (cùng ownership `web` — chỉ 1 feature Dispatch)?
3. **O12:** Xác nhận (a) Wave P1 = chỉ EventReport per-event (#241) và (b) **multi-event Owner overview = defer** — có muốn ghi chính thức vào DECISION-LOG O12 trên `main`?
4. **CS email UX (P1-B):** Có đưa vào đợt ngay sau D11 admin/attendee, hay gộp milestone “ops CS” riêng?
5. **Validate-only / manual lookup:** Giữ OUT đến sau pilot 1-event, hay mở spike capability (docs-only) trước?
6. **Privacy:** Duyệt nội dung `docs/asc/privacy-policy-draft.md` để ủy quyền deploy `/privacy`, hay giữ 404 đến khi O06 chốt?
7. **Metrics (P2-B):** Có cần đo baseline PRD §13 trước pilot MFest, hay chấp nhận “chưa đo” có kiểm soát?

---

## 6. HEAD SHA + giới hạn

| Trường | Giá trị |
| --- | --- |
| Worktree HEAD | `e8512d0055e0e9d6585007e8363b6224a7138b12` |
| PR #242 tip (O12 EventReport, chưa merge vào HEAD này) | `4f6530bfb3d81a514493c7f1385896757e2e9428` |
| Artifact | `docs/plans/MVP-EXPAND-BA-B-RESIDUAL-GAPS.md` |
| Architecture impact (báo cáo này) | **Không** tự đề xuất contract mới; ghi nhận contract EventReport đã có trên PR #242; multi-event/validate-only/metrics **có thể** cần contract sau — escalate |

### Giới hạn nghiên cứu

- Không đọc `MVP-EXPAND-BA-A-*`; không có `DASHBOARD-MARKET-SYNTHESIS.md` trên disk worktree này.
- Không có `D11-IMPLEMENTATION-TRACKER.md`.
- CRG stale/empty → spot-check source thủ công, không claim coverage toàn graph.
- Không phỏng vấn user thật; không chạy UAT/prod curl trong task này (dùng evidence đã ghi).
- Không đổi Project Status / không Hoàn thành board.
- Snapshot ROADMAP §1 (D5 Đang làm, D7–D10 Chưa lên lịch) là **lịch sử 17/10** — status động = Project #3 + note live đầu ROADMAP.

---

## 7. Handoff coordinator / Epic planner

1. Giữ D11 coding theo board (#230–#236); idle-fill #232 khi slot `web` Gate rảnh.
2. DoD/integration #241 khi đủ quyền merge — rồi mới mở consumer `web` report fields (P1-C).
3. Tạo Issue P0-A invite **chỉ sau** user trả lời §5 Q2 (tránh đụng Dispatch `web` attendee).
4. Ghi O12 vào DECISION-LOG khi user xác nhận Q3.
5. Không dispatch validate-only / metrics / multi-event overview trừ khi user chốt §5.

**Kết luận điều hành:** Sau D0–D10 + D11 UX đang chạy + O12 Wave P1 (EventReport) đang Chờ duyệt, residual có evidence rõ nhất cho **pilot path** là **O06 + privacy host + invite HTTP prod**; residual **sản phẩm Owner** tiếp theo là **CS email UX** và (defer) **multi-event overview**; **validate-only/manual lookup** và **instrumentation** giữ ngoài đợt trừ khi user mở lại.
