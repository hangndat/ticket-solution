# Roadmap — Event Ticketing Platform

Ngày cập nhật nội dung: 2026-10-17  
Đối chiếu live: `origin/main` `05618b5ed1401a3e524243a5823ed336b8731796` (Merge PR [#94](https://github.com/hangndat/ticket-solution/pull/94) D6 S7 docs; coding PR [#92](https://github.com/hangndat/ticket-solution/pull/92) web `eb0d078…`, PR [#93](https://github.com/hangndat/ticket-solution/pull/93) iOS `b93124b…`) và [GitHub Project #3](https://github.com/users/hangndat/projects/3) cùng ngày.  
Nguồn phạm vi: [PRD](./PRD.md), [Technical Design](./TECHNICAL-DESIGN.md), [Agent Development Plan](./AGENT-DEVELOPMENT-PLAN.md), [W0 report](./W0-FOUNDATION-REPORT.md).  
Tracking lâu dài: GitHub Issues + Project (tiếng Việt). Orca Task/Dispatch chỉ là lần giao thực thi.

**Chưa chốt lịch / thời lượng.** Không gắn ngày giả. Timeline Project có thể tạo view trước; ngày mục tiêu để trống đến khi người dùng chốt.

## 0. Ai là nguồn trạng thái động?

| Artifact | Vai trò |
| --- | --- |
| **[Project #3](https://github.com/users/hangndat/projects/3)** | **Nguồn trạng thái động** (Status Issues: Chưa lên lịch · Sẵn sàng · Đang làm · Chờ duyệt · Bị chặn · Hoàn thành). Agent/coordinator đồng bộ board theo sự kiện — không chờ user duyệt từng bước Status. |
| **Roadmap này** | Phạm vi đợt, gate nghiệm thu, ánh xạ module, Definition of Done, hạn chế bằng chứng (proof limits). **Không** thay Status live trên Project. Khi checkbox §6 lệch board, **board thắng**; sửa roadmap trong PR docs riêng. |
| **GitHub Milestone** | Nhóm đợt; `open`/`closed` của milestone có thể chậm hơn Status Project — không dùng milestone state làm authority. |
| **Orca `worker_done`** | Chỉ báo worker kết thúc attempt — **không** = Hoàn thành trên Project. |

**Roadmap đã được user duyệt lần đầu (2026-10-16)** — đóng D0 và mở D1. Các đoạn “đợt tiếp theo = D1 / chưa mở business endpoints” bên dưới §10 là **lịch sử**; không còn mô tả hiện tại.

**Trọng tâm hiện tại (Project #3, 2026-10-17):** parent **D5 (#6)** đang **Đang làm** (Gate camera staff + push DELIVERED; MinIO/APNs prod). Parent **D0–D4 (#1–#5)** và **D6 UX/UI (#81)** đã **Hoàn thành**/closed — Tenant 2 prod UAT: [D4-TENANT2-PROD-UAT.md](./reviews/D4-TENANT2-PROD-UAT.md); D6 web [#92](https://github.com/hangndat/ticket-solution/pull/92) / iOS [#93](https://github.com/hangndat/ticket-solution/pull/93) / docs [#94](https://github.com/hangndat/ticket-solution/pull/94). Sau MVP (#7) **Chưa lên lịch**. Không tuyên bố pilot production sẵn sàng.

## 1. Trạng thái hiện tại (tóm tắt theo Project + main)

Cột **Board** = Status parent Issue trên Project #3 tại thời điểm đối chiếu. Chi tiết sub-issue luôn lấy từ board.

| Mục | Board (parent) | Mức hoàn thành | Ghi chú / proof limits |
| --- | --- | --- | --- |
| W0 Foundation | **Hoàn thành** (#1) | Nghiệm thu đợt | Prototype — **không** = production auth hay ticketing xong. Evidence: [W0-FOUNDATION-REPORT](./W0-FOUNDATION-REPORT.md) |
| Identity / OIDC (D1) | **Hoàn thành** (#2) | Nghiệm thu đợt | Keycloak self-host; gỡ Clerk. Live P4 smoke: [D1-P4-KEYCLOAK-SMOKE](./reviews/D1-P4-KEYCLOAK-SMOKE.md). O06 retention vẫn mở |
| Nhận vé (D2) | **Hoàn thành** (#3) | Nghiệm thu đợt | Mã/quota/issue/outbox + web redeem + iOS ví đã có trên `main` (PRs #30–#32…) |
| Check-in (D3) | **Hoàn thành** (#4) | Nghiệm thu đợt (có ngoại lệ UAT) | Gate + web Gate + iOS scan/recovery trên `main`. **Camera thiết bị thật** hoãn sang D5 (#26) — không ghi là UAT camera physical đã PASS |
| Admin & Platform (D4) | **Hoàn thành** (#5) | Nghiệm thu đợt (PASS with known gap) | Tenant 2 prod: [D4-TENANT2-PROD-UAT.md](./reviews/D4-TENANT2-PROD-UAT.md). Gap CSRF invite UI / MinIO export / invite email → theo dõi D5 ops |
| Hardening / UAT / phát hành (D5) | **Đang làm** (#6) | Child #24/#25/#26/#56 **Hoàn thành** trên board; parent chưa đóng | Còn Gate camera staff + push **DELIVERED** trên thiết bị (TF 0.1.0 (7)); APNs/MinIO chưa gắn prod. Build native **chỉ** local Xcode; **cấm** Expo/EAS Cloud Build |
| UX/UI polish (D6) | **Hoàn thành** (#81) | Nghiệm thu đợt (acceptance) | Web [#92](https://github.com/hangndat/ticket-solution/pull/92) · iOS [#93](https://github.com/hangndat/ticket-solution/pull/93) · docs S7 [#94](https://github.com/hangndat/ticket-solution/pull/94). #82–#85/#87–#89 + parent #81 closed; Milestone #8 closed. Plan [`D6-UX-UI-PLAN.md`](./plans/D6-UX-UI-PLAN.md). **Proof limits:** D6 ≠ pilot ready / store / production |
| Android / payment / seat map / white-label | **Chưa lên lịch** (#7) | Ngoài MVP | Theo PRD — không gắn D2–D6 |

### 1.1 Ba mức hoàn thành (bắt buộc phân biệt)

| Mức | Nghĩa | Không được suy ra |
| --- | --- | --- |
| **Code complete** | Implementation đã merge `main` (hoặc PR sẵn), CI liên quan xanh trên commit tích hợp | Chưa đủ để Status **Hoàn thành** nếu thiếu review/evidence Issue |
| **Acceptance complete** (board **Hoàn thành**) | Đủ DoD §2: review độc lập (khi security-sensitive), merge, CI, evidence đúng tiêu chí Issue | Chưa = sẵn sàng pilot / production / store |
| **Pilot ready** | Gate D5 đạt theo technical design: security/capacity/restore có số liệu rõ; UAT thiết bị thật (camera, deep link, push, offline ví, revoke) với build **local signed**; runbook; chỉ số chưa đạt được nêu rõ | Demo pass, Simulator-only, hoặc `ACCEPTED` APNs **không** đủ |

### 1.2 Ngoại lệ UAT thiết bị thật & hạn chế bằng chứng

- **Headless UAT** (Playwright / `scripts/web-uat.sh`, AXe / `scripts/sim-uat.sh`, Orca embedded browser) là mặc định agent — **không** thay thế UAT camera/push trên **thiết bị vật lý** khi Issue yêu cầu (#26).
- Pass **Simulator** / Expo Go ≠ Pass TestFlight / device signed.
- `./scripts/d5-backup-drill.sh` PASS chỉ chứng minh fixture còn sau `pg_dump`/restore trên Postgres vứt bỏ — **không** backup production, **không** SLO.
- Push: đăng ký token / outbox `ACCEPTED` ≠ `DELIVERED` đến thiết bị.
- Không dùng EAS Cloud Build làm bằng chứng phát hành.

## 2. Định nghĩa hoàn thành (Definition of Done)

Một đầu việc trên board chỉ chuyển **Hoàn thành** khi:

1. Đã review (security-sensitive: reviewer khác tác giả / khác session implementer).
2. Đã tích hợp vào nhánh tích hợp (`main`).
3. CI pass trên commit tích hợp (check + database-isolation khi liên quan).
4. Có evidence nghiệm thu đúng tiêu chí Issue (lệnh, log, test, SHA — không chỉ `worker_done`).

`worker_done` / Dispatch settled **không** đồng nghĩa task đã hoàn thành trên GitHub Project.

**Agent sync (bắt buộc):** Cập nhật Status Project theo sự kiện (Đang làm / Chờ duyệt / Bị chặn / Hoàn thành) **không chờ user duyệt board**. Khi vào Chờ duyệt, spawn một Orca worker `--agent cursor` đóng vai người duyệt (khác session implementer). Chi tiết: `.cursor/rules/github-project-tracking.mdc`.

## 3. Vai trò phụ trách

| Nhóm | Ownership | Không tự ý |
| --- | --- | --- |
| Coordinator | Backlog, dependencies, quyết định, root tooling, lockfile, CI, contracts, merge | Không đổi nghiệp vụ đã freeze chỉ để giải conflict |
| Backend | `apps/api`, `apps/worker`, `packages/backend`, schema/migrations, RLS tests | UI web/mobile; contract chưa thống nhất |
| Web | `apps/web` | Database, auth policy, native app |
| iOS | `apps/mobile` | Backend rules, web, store submission ngoài task |
| QA / Security (hardening) | Review độc lập RLS/authz/races, load, restore | Không tự viết lại kiến trúc trong task review |

## 4. Đợt bàn giao (Milestones) — phạm vi & gate

Gợi ý từ kế hoạch agent; cổng identity trước business đã **đi qua** (D1 Hoàn thành trên board).

| Đợt | Tên | Mục tiêu | Gate | Board (2026-10-17) |
| --- | --- | --- | --- | --- |
| D0 | W0 Foundation | Monorepo, CI, Compose, API health, RLS prototype, web/iOS shell | Foundation integrated; no EAS Cloud Build policy | Hoàn thành |
| D1 | Quyết định & Identity | O01–O08 liên quan, OIDC, membership/revocation proof | Identity spike đạt criteria trước khi mở business endpoints | Hoàn thành |
| D2 | Nhận vé xuyên web/app | Mã/quota/issue/outbox + web redeem + iOS ví API thật | Demo đổi vé web → thông báo → cùng user mở vé trên app; concurrency quota/idempotency | Hoàn thành |
| D3 | Check-in | Gate reserve/confirm/recovery + web Gate + iOS scan | Hai thiết bị / race / recovery; camera physical có thể tách D5 nếu ghi rõ | Hoàn thành (UAT camera device → #26) |
| D4 | Admin & Platform | Permissions, import, approval, config publish, CS, reporting, app feature còn lại | Tenant thứ hai tự tạo event/brand qua admin, không hardcode pilot | Hoàn thành |
| D5 | Hardening & phát hành | Security review, capacity, restore, device UAT, local signed iOS / TestFlight | Evidence đạt technical design; publish/store là task riêng → **pilot ready** | Đang làm |
| D6 | Hoàn thiện UX/UI | Polish brand Vemoki + IA/states/a11y trên web & iOS đã có chức năng | Brand test + headless/sim screenshots; không gộp D5 hardening | Hoàn thành (#81 closed; PRs #92/#93/#94) |

Android, payment/refund, seat map, Apple/Google Wallet, offline Gate multi-device, white-label app: **sau MVP**, không gắn vào D2–D6 trừ khi user mở rộng phạm vi.

## 5. Ánh xạ module PRD → đợt

| Module | Tên | Đợt chính | Phụ thuộc trước |
| --- | --- | --- | --- |
| M01 | Tenant và cách ly dữ liệu | D0 (prototype) → D1/D4 (đầy đủ) | — |
| M02 | Identity và quyền | D1 | Quyết định provider; O01/O02 |
| M03 | Event lifecycle | D2 skeleton → D4 đầy đủ | M01, M02 |
| M04 | Branding và nội dung | D0 fixture → D4 publish → **D6 polish platform+event surfaces** | M03 |
| M05 | Loại vé, nguồn phát, quota | D2 | M03; identity verified trước issue |
| M06 | Import mã và khách mời | D4 | M05 |
| M07 | Redemption và duyệt | D2 (auto-approve) → D4 (duyệt thủ công) | M05, M02 |
| M08 | Ticket và ví vé | D2 | M07 |
| M09 | Email và push | D2 (email sandbox) → D4 (push/retry) | Outbox; M08 |
| M10 | Gate và check-in | D3 | M08 |
| M11 | CS, báo cáo, vận hành | D3 tối thiểu → D4 | M07–M10 |
| M12 | Platform Operations | D4–D5 | M01 |

## 6. Backlog đầu việc (checkbox = tiến độ docs; Status live = Project)

Mỗi nhóm tương ứng parent Issue trên GitHub; sub-issues mang tiêu chí nghiệm thu cụ thể.  
**Cập nhật Status luôn theo Project #3.** Checkbox dưới đây phản ánh evidence đã ghi trên `main` / Issue tại lần đối chiếu `ed6f0dd` — nếu lệch board, sửa docs, không “sửa” thực tế bằng cách đánh dấu sớm.

### D0 — W0 Foundation (board: Hoàn thành)

- [x] Xác nhận W0 foundation đủ để đóng đợt — Issues #1/#9
- [x] Bảo toàn commit/policy/lockfile trên remote `main` và CI Node 24 có iOS JS export — Issue #8

### D1 — Quyết định & Identity (board: Hoàn thành)

- [x] Chốt / ghi log O01–O08 — [DECISION-LOG.md](./DECISION-LOG.md), Issue #10
- [x] Spike OIDC → **Keycloak**; gỡ Clerk — Issue #11 / PR #28
- [x] Membership tenant/event + deny-by-default; thu hồi — Issue #12
- [x] Session web BFF + iOS SecureStore — Issue #13
- [x] Live P4 smoke Keycloak local — [D1-P4-KEYCLOAK-SMOKE](./reviews/D1-P4-KEYCLOAK-SMOKE.md)
- [x] Mở D2 sau identity proof — parent #2/#3 Hoàn thành trên Project (lịch sử: từng chặn business endpoints trước P4)

### D2 — Nhận vé (board: Hoàn thành)

- [x] Backend: mã/quota → issue → ticket → outbox/email — #14
- [x] Web: form đổi mã, verify, success/ticket API thật — #15
- [x] iOS: My Tickets, QR, cache; đồng bộ identity — #16
- [x] Kiểm thử độc lập quota/idempotency — #17

### D3 — Check-in (board: Hoàn thành)

- [x] Backend Gate: staff session, reserve/confirm/status, revoke/undo, audit — #18
- [x] Web Gate dự phòng + CS lookup tối thiểu — #19
- [x] iOS: dedupe và recovery sau restart/mạng — #20. **Camera thiết bị thật → D5 #26**
- [x] Race / timeout recovery theo test Postgres; unknown trên web/iOS theo quyết định sản phẩm

### D4 — Admin & Platform (board: Hoàn thành)

- [x] Backend platform (permissions, import, approval, config publish, reporting) — #21; PRs #38/#43/#48
- [x] Web admin đầy đủ (#22) — board Hoàn thành
- [x] iOS hoàn thiện (#23) — board Hoàn thành; APNs client trên `main`; device UAT theo dõi #26/#6
- [x] Backend D4/D5 còn lại (#56) — board Hoàn thành
- [x] Tenant thứ hai self-serve trên prod — PASS with known gap: [D4-TENANT2-PROD-UAT.md](./reviews/D4-TENANT2-PROD-UAT.md) (tenant `26c16ee9…` / event `5295ef1a…` / ticket `7d8c18df…`). Gap CSRF invite / MinIO export / invite email → D5 ops

### D5 — Hardening & phát hành (board: Đang làm)

- [x] Review/test độc lập RLS, authorization, transaction races — Issue #24; PR #47
- [x] Backup/restore + obs/load drills (board #25 Hoàn thành) — evidence [D5-ISSUE-25-EVIDENCE.md](./reviews/D5-ISSUE-25-EVIDENCE.md). **Proof limits:** continuous RPO/RTO prod và SLO prod **chưa** claim.
- [x] UAT thiết bị / TestFlight partial (#26 closed trên board) — ví/offline/deep link PASS; **Gate camera staff + push DELIVERED còn mở trên parent #6** (TF `0.1.0 (7)`; Part C từng BLOCKED session signed-out trên build 5)
- [x] Runbook, release checklist, O06 options — `docs/ops/RUNBOOK.md`, `RELEASE-CHECKLIST.md`, `O06-OPTIONS.md`
- [ ] **Parent #6 còn lại:** Gate camera admit trên thiết bị thật (staff session) + push **DELIVERED** (APNs key chưa gắn VPS) + MinIO export prod; không tuyên bố pilot ready

### D6 — Hoàn thiện UX/UI (board: Hoàn thành)

- [x] Tokens & design contract — D6-S1 (#82) — closed; consumed by PR #92 + #93
- [x] Web guest / redeem / claim / event — D6-S2 (#83) — merge PR [#92](https://github.com/hangndat/ticket-solution/pull/92) `eb0d0784f300571dc7a557c0db3ecd865c4e9cfe` (DoD PASS w/ gaps @ `ec8eac6…`)
- [x] Web gate & account — D6-S3 (#84) — cùng PR #92
- [x] Web admin & platform — D6-S4 (#85) — cùng PR #92
- [x] iOS theme + Events/Redeem/Claim — D6-S5 (#87) — merge PR [#93](https://github.com/hangndat/ticket-solution/pull/93) `b93124b58eb1740d263fc5191ddd9a9aad4506f6` (DoD PASS w/ gaps @ `a3eabf2…`)
- [x] iOS ví + Staff scan UX — D6-S6 (#88) — cùng PR #93
- [x] ROADMAP sync & nghiệm thu đợt — D6-S7 (#89) — merge PR [#94](https://github.com/hangndat/ticket-solution/pull/94) `05618b5ed1401a3e524243a5823ed336b8731796`; parent #81 **Hoàn thành**/closed

Parent [#81](https://github.com/hangndat/ticket-solution/issues/81) **Hoàn thành**/closed. Milestone [D6 — Hoàn thiện UX/UI Vemoki](https://github.com/hangndat/ticket-solution/milestone/8) **closed**.  
**Gate:** xem [docs/plans/D6-UX-UI-PLAN.md](./plans/D6-UX-UI-PLAN.md) §7 — đợt acceptance xong trên board. **Proof limits:** D6 ≠ pilot ready / store submission / production deploy.

### Sau MVP (board: Chưa lên lịch)

- Android native
- Thanh toán / refund / chuyển nhượng
- Seat map; Apple/Google Wallet
- Offline check-in nhiều thiết bị; white-label app; SSO/billing nâng cao

## 7. Quyết định còn mở (chặn thiết kế liên quan)

| ID | Câu hỏi | Baseline tạm | Ảnh hưởng |
| --- | --- | --- | --- |
| O01–O05, O07–O08 | (xem DECISION-LOG) | **Đã chốt MVP** | [DECISION-LOG.md](./DECISION-LOG.md) |
| O06 | Retention, vùng dữ liệu, SLA? | Chưa chốt số | Trước dữ liệu user thật |
| ADR-09 | Provider OIDC cụ thể? | **Keycloak self-host đã chốt** — POC P4 local | [spikes/D1-OIDC-PROVIDER.md](./spikes/D1-OIDC-PROVIDER.md) |
| ADR-11…15 | SaaS cấm; MinIO/SMTP/APNs/Caddy | **Đã chốt MVP** | [DECISION-LOG.md](./DECISION-LOG.md) |

## 8. Quy ước tracking GitHub

- **Project:** https://github.com/users/hangndat/projects/3 — private, gắn `hangndat/ticket-solution`. **Authority trạng thái động.**
- **Fields (tiếng Việt):** Trạng thái, Ưu tiên, Đợt bàn giao, Nhóm phụ trách, Ngày bắt đầu, Ngày mục tiêu.
- **Trạng thái:** Chưa lên lịch · Sẵn sàng · Đang làm · Chờ duyệt · Bị chặn · Hoàn thành.
- **Labels:** đợt (`dot-d0`…), nhóm (`nhom-backend`…), loại (`loai-quyet-dinh`, `loai-tinh-nang`, `loai-ha-tang`, `loai-kiem-thu`), ưu tiên.
- **Views:** Tổng quan/Backlog, Board theo trạng thái, Roadmap (không gắn ngày giả).
- **Parent / sub-issues** theo nhóm module; **blocked-by** khi phụ thuộc thật (ví dụ lịch sử: D2 từng bị chặn bởi D1 identity).
- **Đồng bộ board:** không chờ user duyệt từng bước Status; `worker_done` ≠ Hoàn thành — xem `.cursor/rules/github-project-tracking.mdc`.
- **GitHub Flow:** feature branch → commit → push → PR → Cursor DoD review → CI → coordinator merge `main`. Không commit feature thẳng `main` — xem `.cursor/rules/git-workflow.mdc`.
- **Orca:** coding song song `--agent cursor`; plan/design Codex (fallback Cursor); idle worker nhận task `Sẵn sàng` ngay — xem `orca-*.mdc` trong `.cursor/rules/`.

## 9. Liên kết vận hành

- Repo: https://github.com/hangndat/ticket-solution
- Agent rules: root [AGENTS.md](../AGENTS.md) + `.cursor/rules/*.mdc`
- W0 evidence: [W0-FOUNDATION-REPORT.md](./W0-FOUNDATION-REPORT.md)
- Chính sách iOS: không bao giờ Expo/EAS Cloud Build — xem root/mobile `AGENTS.md`, README, PRD, technical design.
- Bàn giao Cursor W0→roadmap (lịch sử): [BAN-GIAO-CURSOR.md](./BAN-GIAO-CURSOR.md)

## 10. Lịch sử — sau duyệt roadmap lần đầu (2026-10-16)

> **Chỉ mang tính lịch sử.** Không dùng làm trạng thái hiện tại. Trạng thái live: §0–§1 và Project #3.

1. ~~User xác nhận roadmap / đóng D0~~ — đã duyệt 2026-10-16.
2. ~~Cập nhật Issue statuses lúc mở D1~~ — D0 Hoàn thành; D1 code slice (#10–#13) rồi Chờ duyệt / đóng.
3. ~~Trước D2:~~ P4 Keycloak API/web UAT có evidence ([smoke](./reviews/D1-P4-KEYCLOAK-SMOKE.md)); business endpoints đã được mở và D2/D3 đã **Hoàn thành** trên board sau đó.
4. **2026-10-17:** docs process sync — sửa văn bản “đợt tiếp theo = D1 / D2–D5 chưa bắt đầu” còn sót sau PR #51 (chỉ cập nhật checkbox §6, chưa sửa §1). Đối chiếu `ed6f0dd` + Project #3.
