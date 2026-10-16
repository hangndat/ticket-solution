# Roadmap — Event Ticketing Platform

Ngày: 2026-10-17  
Nguồn: [PRD](./PRD.md), [Technical Design](./TECHNICAL-DESIGN.md), [Agent Development Plan](./AGENT-DEVELOPMENT-PLAN.md), [W0 report](./W0-FOUNDATION-REPORT.md)  
Tracking lâu dài: GitHub Issues + Project (tiếng Việt). Project: https://github.com/users/hangndat/projects/3 Orca Task/Dispatch chỉ là lần giao thực thi.  
Tiến độ D2 (evidence): [reviews/D2-ACCEPTANCE-2026-10-17.md](./reviews/D2-ACCEPTANCE-2026-10-17.md)

**Chưa chốt lịch / thời lượng.** Không gắn ngày giả. Timeline Project có thể tạo view trước, ngày mục tiêu để trống đến khi người dùng chốt.

**Roadmap đã được user duyệt (2026-10-16).** D1 Identity đã đóng (Keycloak P4). Đợt đang làm: **D2 — Nhận vé**. **Không** mở D3 (Gate/check-in) đến khi cổng D2 đủ (merge iOS + UAT xuyên suốt). Không production publish; iOS build **cấm** Expo/EAS Cloud Build.

## 1. Trạng thái hiện tại

| Mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| W0 Foundation | **Hoàn thành** (user duyệt) | Prototype/foundation — **không** đồng nghĩa production auth, isolation mọi module, hoặc ticketing xong. Issues #1/#8/#9 đóng; milestone D0 closed. |
| Identity / OIDC | **Hoàn thành (D1)** — Keycloak self-host; gỡ Clerk | Live P4 UAT **PASS** (script + web BFF + iOS Simulator Sign in). Parent [#2](https://github.com/hangndat/ticket-solution/issues/2) CLOSED / Project Hoàn thành. [smoke](./reviews/D1-P4-KEYCLOAK-SMOKE.md) |
| Mã / quota / issue / outbox | **Đạt (D2 backend + QA)** | [#14](https://github.com/hangndat/ticket-solution/issues/14) + [#17](https://github.com/hangndat/ticket-solution/issues/17) Hoàn thành; fix rejection `fb3da05` → merge `7cc05d0`; CI [38936102204](https://github.com/hangndat/ticket-solution/actions/runs/38936102204) success |
| Web redeem | **Đạt (D2 web)** | [#15](https://github.com/hangndat/ticket-solution/issues/15) Hoàn thành; PR [#30](https://github.com/hangndat/ticket-solution/pull/30) merge `64242d1`; CI [38937723644](https://github.com/hangndat/ticket-solution/actions/runs/38937723644) success; UAT Keycloak redeem 201 + owner list |
| iOS ví / QR display | **Đang làm — Chờ duyệt / UAT từng phần** | [#16](https://github.com/hangndat/ticket-solution/issues/16) OPEN; PR [#31](https://github.com/hangndat/ticket-solution/pull/31) **OPEN** head `e475216`; review PASS + CI PR xanh; Expo Go: login+vé+QR+logout sạch OK; còn switch/offline/Mailpit — chưa full PASS |
| Parent D2 | **Đang làm** (chưa Hoàn thành) | [#3](https://github.com/hangndat/ticket-solution/issues/3) OPEN — xem [D2 acceptance](./reviews/D2-ACCEPTANCE-2026-10-17.md) |
| Gate / check-in | Chưa bắt đầu | **D3 chưa mở** — chờ cổng D2 |
| Admin / platform đầy đủ | Chưa bắt đầu | Thuộc đợt hoàn thiện |
| Hardening / UAT / phát hành iOS | Chưa bắt đầu | Build native chỉ local Xcode; **cấm** Expo/EAS Cloud Build |
| Android / thanh toán / seat map / white-label | Ngoài MVP | Giai đoạn sau theo PRD |

## 2. Định nghĩa hoàn thành (Definition of Done)

Một đầu việc trên board chỉ chuyển **Hoàn thành** khi:

1. Đã review (security-sensitive: reviewer khác tác giả).
2. Đã tích hợp vào nhánh tích hợp (`main`).
3. CI pass trên commit tích hợp (check + database-isolation khi liên quan).
4. Có evidence nghiệm thu đúng tiêu chí Issue (lệnh, log, test — không chỉ `worker_done`).

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

## 4. Đợt bàn giao (Milestones)

Gợi ý từ kế hoạch agent, tinh chỉnh thêm cổng quyết định/identity trước W1.

| Đợt | Tên | Mục tiêu | Gate |
| --- | --- | --- | --- |
| D0 | W0 Foundation | Monorepo, CI, Compose, API health, RLS prototype, web shell, iOS shell | **Đã duyệt / Hoàn thành** (2026-10-16) |
| D1 | Quyết định & Identity | Chốt O01–O08 liên quan, OIDC provider, membership/revocation proof | **Hoàn thành** — Keycloak P4; parent #2 đóng |
| D2 | Nhận vé xuyên web/app | Mã/quota/issue/outbox + web redeem + iOS ví với API thật | **Đang làm** — BE/QA/web đạt; iOS chờ merge + UAT; demo web→app + concurrency/idempotency |
| D3 | Check-in | Gate reserve/confirm/recovery + web Gate + iOS scan | **Chưa mở** — hai thiết bị; race revoke/timeout; không chỉ mock camera |
| D4 | Admin & Platform | Permissions, import, approval, config publish, CS, reporting, app feature còn lại | Tenant thứ hai tự tạo event/brand qua admin, không hardcode pilot |
| D5 | Hardening & phát hành | Security review, capacity, restore, device UAT, local signed iOS / TestFlight | Evidence đạt tiêu chí technical design; publish/store là task riêng |

Android, payment/refund, seat map, Apple/Google Wallet, offline Gate multi-device, white-label app: **sau MVP**, không gắn vào D2–D5 trừ khi user mở rộng phạm vi.

## 5. Ánh xạ module PRD → đợt

| Module | Tên | Đợt chính | Phụ thuộc trước |
| --- | --- | --- | --- |
| M01 | Tenant và cách ly dữ liệu | D0 (prototype) → D1/D4 (đầy đủ) | — |
| M02 | Identity và quyền | D1 | Quyết định provider; O01/O02 |
| M03 | Event lifecycle | D2 skeleton → D4 đầy đủ | M01, M02 |
| M04 | Branding và nội dung | D0 fixture → D4 publish | M03 |
| M05 | Loại vé, nguồn phát, quota | D2 | M03; identity verified trước issue |
| M06 | Import mã và khách mời | D4 | M05 |
| M07 | Redemption và duyệt | D2 (auto-approve) → D4 (duyệt thủ công) | M05, M02 |
| M08 | Ticket và ví vé | D2 | M07 |
| M09 | Email và push | D2 (email sandbox) → D4 (push/retry) | Outbox; M08 |
| M10 | Gate và check-in | D3 | M08 |
| M11 | CS, báo cáo, vận hành | D3 tối thiểu → D4 | M07–M10 |
| M12 | Platform Operations | D4–D5 | M01 |

## 6. Backlog đầu việc (nhóm Issue)

Mỗi nhóm dưới đây tương ứng parent Issue trên GitHub; sub-issues mang tiêu chí nghiệm thu cụ thể. D0 + D1 **Hoàn thành**; D2 **Đang làm** (BE/QA/web đạt; mobile còn UAT/merge); D3+ **Chưa lên lịch** đến khi cổng D2 đóng.

### D0 — W0 Foundation (đã duyệt)

- [x] Xác nhận W0 foundation đủ để đóng đợt (tooling, CI, RLS test, web shell, iOS shell, chính sách no EAS Cloud Build) — Issues #1/#9
- [x] Bảo toàn commit/policy/lockfile trên remote `main` và CI Node 24 có iOS JS export — Issue #8, commit `76986e1`

### D1 — Quyết định & Identity (**Hoàn thành**)

- [x] Chốt / ghi log O01–O08 — [DECISION-LOG.md](./DECISION-LOG.md), Issue #10
- [x] Spike OIDC code POC ban đầu (Issue #11) — **đã chuyển ADR-09 → Keycloak**; gỡ Clerk SDK
- [x] Membership tenant/event + deny-by-default; thu hồi — Issue #12
- [x] Session web BFF + iOS SecureStore (phủ bởi #11) — Issue #13
- [x] Live P4 smoke trên **Keycloak local** (PKCE, email verified, MFA gate, revoke refresh, logout, account switch, iOS Simulator Sign in) — [D1-P4-KEYCLOAK-SMOKE](./reviews/D1-P4-KEYCLOAK-SMOKE.md)
- [x] Mở D2 sau P4 + membership đủ proof — coordinator đã mở; parent [#2](https://github.com/hangndat/ticket-solution/issues/2) CLOSED

### D2 — Nhận vé (**Đang làm** — chưa Hoàn thành đợt)

- [x] Backend: mã/quota → issue transaction → ticket → outbox/email adapter — [#14](https://github.com/hangndat/ticket-solution/issues/14), PR [#29](https://github.com/hangndat/ticket-solution/pull/29) → `3921f2e`
- [x] Web: form đổi mã, trạng thái verify, success/ticket qua API thật — [#15](https://github.com/hangndat/ticket-solution/issues/15), PR [#30](https://github.com/hangndat/ticket-solution/pull/30) head `8c15e58` → merge `64242d1`; CI [38937723644](https://github.com/hangndat/ticket-solution/actions/runs/38937723644) success; test **19/19**; UAT Keycloak redeem 201
- [ ] iOS: My Tickets, QR **display** (`ticket.display`, không JWS Gate), cache tối thiểu; vé web xuất hiện cùng identity — [#16](https://github.com/hangndat/ticket-solution/issues/16), PR [#31](https://github.com/hangndat/ticket-solution/pull/31) head `e475216` **OPEN**; review PASS + CI PR [38931597664](https://github.com/hangndat/ticket-solution/actions/runs/38931597664) success; UAT **từng phần** trên Expo Go SDK 58 (login Keycloak cùng user web, vé ACTIVE + Display QR, logout→relaunch sạch) — **chưa** account switch B / offline cold start / Mailpit; **chưa** full PASS; không phải native/TestFlight
- [x] Kiểm thử độc lập: tranh suất cuối, idempotency key, terminal rejection durable — [#17](https://github.com/hangndat/ticket-solution/issues/17), fix PR [#32](https://github.com/hangndat/ticket-solution/pull/32) `fb3da05` → merge `7cc05d0`; review PASS `test:db` **4/4**; CI [38936102204](https://github.com/hangndat/ticket-solution/actions/runs/38936102204) success

Chi tiết SHA / hạn chế / provenance: [D2-ACCEPTANCE-2026-10-17.md](./reviews/D2-ACCEPTANCE-2026-10-17.md).

### D3 — Check-in (**chưa mở**)

- [ ] Backend: staff session, reserve/confirm/status, revoke/undo, audit
- [ ] Web Gate dự phòng + CS lookup tối thiểu
- [ ] iOS: camera scan, dedupe, recovery sau restart/mạng
- [ ] Hai thiết bị / race / timeout recovery theo runbook

### D4 — Admin & Platform

- [ ] Backend: permissions, import, approval, config version/publish, notification retry, reporting APIs
- [ ] Web admin: event setup, mã/quota, approval/CS, preview/publish, dashboard/export
- [ ] iOS: đổi mã trên app, nội dung event, push/deep link, supervisor UX, a11y
- [ ] Tenant thứ hai tự vận hành qua cấu hình, không hardcode FUN FEST

### D5 — Hardening & phát hành

- [ ] Review/test độc lập RLS, authorization, transaction races
- [ ] Observability, backup/restore drill, load/admission
- [ ] UAT thiết bị thật / TestFlight (camera, deep link, push, offline ví, revoke) — build **local** signed
- [ ] Runbook, release checklist; theo dõi submitted / approved / available riêng

### Sau MVP (không lên lịch MVP)

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

- **Project:** https://github.com/users/hangndat/projects/3 — private, gắn `hangndat/ticket-solution`.
- **Fields (tiếng Việt):** Trạng thái, Ưu tiên, Đợt bàn giao, Nhóm phụ trách, Ngày bắt đầu, Ngày mục tiêu.
- **Trạng thái:** Chưa lên lịch · Sẵn sàng · Đang làm · Chờ duyệt · Bị chặn · Hoàn thành.
- **Labels:** đợt (`dot-d0`…), nhóm (`nhom-backend`…), loại (`loai-quyet-dinh`, `loai-tinh-nang`, `loai-ha-tang`, `loai-kiem-thu`), ưu tiên.
- **Views:** Tổng quan/Backlog, Board theo trạng thái, Roadmap (không gắn ngày giả).
- **Parent / sub-issues** theo nhóm module; **blocked-by** khi phụ thuộc thật (ví dụ D3 bị chặn bởi cổng D2).
- **Đồng bộ board:** không chờ user duyệt từng bước Status; `worker_done` ≠ Hoàn thành — xem `.cursor/rules/github-project-tracking.mdc`.
- **GitHub Flow:** feature branch → commit → push → PR → Cursor DoD review → CI → coordinator merge `main`. Không commit feature thẳng `main` — xem `.cursor/rules/git-workflow.mdc`.
- **Orca:** coding song song `--agent cursor`; plan/design Codex (fallback Cursor); idle worker nhận task `Sẵn sàng` ngay — xem `orca-*.mdc` trong `.cursor/rules/`.

## 9. Liên kết vận hành

- Repo: https://github.com/hangndat/ticket-solution
- Agent rules: root [AGENTS.md](../AGENTS.md) + `.cursor/rules/*.mdc`
- W0 evidence: [W0-FOUNDATION-REPORT.md](./W0-FOUNDATION-REPORT.md)
- D1 P4: [reviews/D1-P4-KEYCLOAK-SMOKE.md](./reviews/D1-P4-KEYCLOAK-SMOKE.md)
- D2 tiến độ: [reviews/D2-ACCEPTANCE-2026-10-17.md](./reviews/D2-ACCEPTANCE-2026-10-17.md)
- Chính sách iOS: không bao giờ Expo/EAS Cloud Build — xem root/mobile `AGENTS.md`, README, PRD, technical design.

## 10. Sau khi duyệt roadmap (cập nhật 2026-10-17)

1. ~~User xác nhận roadmap / đóng D0~~ — đã duyệt.
2. ~~D1 Identity / Keycloak P4~~ — parent [#2](https://github.com/hangndat/ticket-solution/issues/2) CLOSED / Hoàn thành.
3. **D2 đang làm:** backend [#14](https://github.com/hangndat/ticket-solution/issues/14) + QA [#17](https://github.com/hangndat/ticket-solution/issues/17) + web [#15](https://github.com/hangndat/ticket-solution/issues/15) đạt trên `main`; mobile [#16](https://github.com/hangndat/ticket-solution/issues/16) / PR [#31](https://github.com/hangndat/ticket-solution/pull/31) còn merge + UAT — **không** đánh dấu D2 Hoàn thành.
4. **D3:** giữ chưa mở đến khi cổng D2 (UAT xuyên web→app + merge iOS) đóng.
