# Roadmap — Event Ticketing Platform

Ngày: 2026-10-16  
Nguồn: [PRD](./PRD.md), [Technical Design](./TECHNICAL-DESIGN.md), [Agent Development Plan](./AGENT-DEVELOPMENT-PLAN.md), [W0 report](./W0-FOUNDATION-REPORT.md)  
Tracking lâu dài: GitHub Issues + Project (tiếng Việt). Project: https://github.com/users/hangndat/projects/3 Orca Task/Dispatch chỉ là lần giao thực thi.

**Chưa chốt lịch / thời lượng.** Không gắn ngày giả. Timeline Project có thể tạo view trước, ngày mục tiêu để trống đến khi người dùng chốt.

**Roadmap đã được user duyệt (2026-10-16).** Đợt tiếp theo: D1 — Quyết định & Identity. Không mở business endpoints (nhận vé/Gate) trước khi identity đủ proof.

## 1. Trạng thái hiện tại

| Mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| W0 Foundation | **Hoàn thành** (user duyệt) | Prototype/foundation — **không** đồng nghĩa production auth, isolation mọi module, hoặc ticketing xong. Issues #1/#8/#9 đóng; milestone D0 closed. |
| Identity / OIDC | **Keycloak self-host đã chốt**; gỡ Clerk | Live P4 UAT **PASS** (script + web BFF + iOS Simulator Sign in). Device native install/launch xong. [smoke](./reviews/D1-P4-KEYCLOAK-SMOKE.md) |
| Mã / quota / issue / outbox | Chưa bắt đầu | Thuộc đợt nhận vé |
| Gate / check-in | Chưa bắt đầu | Thuộc đợt check-in |
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
| D1 | Quyết định & Identity | Chốt O01–O08 liên quan, OIDC provider, membership/revocation proof | Identity spike đạt criteria; chưa mở business endpoints thiếu auth |
| D2 | Nhận vé xuyên web/app | Mã/quota/issue/outbox + web redeem + iOS ví với API thật | Demo đổi vé web → thông báo → cùng user mở vé trên app; concurrency quota/idempotency |
| D3 | Check-in | Gate reserve/confirm/recovery + web Gate + iOS scan | Hai thiết bị; race revoke/timeout; không chỉ mock camera |
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

Mỗi nhóm dưới đây tương ứng parent Issue trên GitHub; sub-issues mang tiêu chí nghiệm thu cụ thể. D0 đã **Hoàn thành**; D1 **Sẵn sàng**; D2+ vẫn **Bị chặn** / chưa lên lịch cho đến identity.

### D0 — W0 Foundation (đã duyệt)

- [x] Xác nhận W0 foundation đủ để đóng đợt (tooling, CI, RLS test, web shell, iOS shell, chính sách no EAS Cloud Build) — Issues #1/#9
- [x] Bảo toàn commit/policy/lockfile trên remote `main` và CI Node 24 có iOS JS export — Issue #8, commit `76986e1`

### D1 — Quyết định & Identity

- [x] Chốt / ghi log O01–O08 — [DECISION-LOG.md](./DECISION-LOG.md), Issue #10
- [x] Spike OIDC code POC ban đầu (Issue #11) — **đã chuyển ADR-09 → Keycloak**; gỡ Clerk SDK
- [x] Membership tenant/event + deny-by-default; thu hồi — Issue #12
- [x] Session web BFF + iOS SecureStore (phủ bởi #11) — Issue #13
- [x] Live P4 smoke trên **Keycloak local** (PKCE, email verified, MFA gate, revoke refresh, logout, account switch, iOS Simulator Sign in) — [D1-P4-KEYCLOAK-SMOKE](./reviews/D1-P4-KEYCLOAK-SMOKE.md)
- [ ] Không mở endpoint nghiệp vụ tenant khi chưa có live P4 evidence / membership đủ proof — P4 API/web đạt; mở D2 khi coordinator xác nhận scope

### D2 — Nhận vé

- [x] Backend: mã/quota → issue transaction → ticket → outbox/email adapter
- [x] Web: form đổi mã, trạng thái verify, success/ticket qua API thật
- [x] iOS: My Tickets, QR, cache tối thiểu; vé web xuất hiện cùng identity
- [x] Kiểm thử độc lập: tranh suất cuối, idempotency key, email lỗi không mất vé

### D3 — Check-in

- [x] Backend: staff session, reserve/confirm/status, revoke/undo, audit
- [x] Web Gate dự phòng + CS lookup tối thiểu
- [x] iOS: dedupe và recovery sau restart/mạng. Camera thiết bị thật hoãn sang D5 (#26)
- [x] Hai thiết bị / race / timeout recovery theo test Postgres và quyết định unknown trên web/iOS

### D4 — Admin & Platform

- [x] Backend: permissions, import, approval, config version/publish, notification retry, reporting APIs — Issues #21; PRs #38/#43/#48
- [x] Web admin: event setup, mã/quota, approval, preview/publish, dashboard số liệu — Issue #22; PRs #40/#49/#50. CS và export vẫn chưa có API
- [x] iOS: đổi mã trên app, nội dung fixture qua deep link, supervisor unknown trên Gate, a11y, push fail-closed — Issue #23; PRs #39/#44/#46. APNs thật và TestFlight vẫn hoãn #26
- [ ] Tenant thứ hai tự vận hành qua cấu hình, không hardcode FUN FEST — chưa nghiệm thu end-to-end trên UI với tenant thật thứ hai

### D5 — Hardening & phát hành

- [x] Review/test độc lập RLS, authorization, transaction races — Issue #24; PR #47 (+ test:db gate/issue/approval)
- [x] Backup/restore drill cục bộ — Issue #25. Lệnh đúng: `./scripts/d5-backup-drill.sh` (hai container Postgres vứt bỏ, không đụng `ticket_dev`). Pass chỉ chứng minh một dòng fixture đánh dấu còn sau `pg_dump` và restore. Không phải backup production và không phải SLO.
- [ ] Business/key restore drill — `./scripts/d5-business-restore-drill.sh` (AES-GCM decrypt + API reconnect + RPO dump-point). **Chưa tick Done:** continuous RPO ≤15 phút / RTO prod ≤2h chưa đo trên hạ tầng đích. Evidence: [D5-ISSUE-25-EVIDENCE.md](./reviews/D5-ISSUE-25-EVIDENCE.md)
- [ ] Observability (hạ tầng local) — overlay Prometheus + exporters (`infra/observability/`, `./scripts/d5-observability-smoke.sh`). **Chưa đạt §16 / chưa Done:** API Prometheus `/metrics` text là BE follow-up; scrape Bearer file đã chuẩn bị.
- [ ] Load/admission — harness `./scripts/d5-load-baseline.sh` (S3 sustained) + `./scripts/d5-admission-s4.sh` (nginx edge isolated). **Chưa tick Done** tới khi evidence đạt 50 issue/s + 20 confirm/s ≥60s, 50 scanner/event × 2, và không claim SLO prod. Chi tiết: evidence #25.
- [ ] UAT thiết bị thật / TestFlight (camera, deep link, push, offline ví, revoke) — build **local** signed
- [x] Runbook, release checklist, O06 options (chưa chốt số) — `docs/ops/RUNBOOK.md`, `RELEASE-CHECKLIST.md`, `O06-OPTIONS.md`. Store submitted/approved/available vẫn theo dõi ở #26.

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
- **Parent / sub-issues** theo nhóm module; **blocked-by** khi phụ thuộc thật (ví dụ D2 bị chặn bởi D1 identity).
- **Đồng bộ board:** không chờ user duyệt từng bước Status; `worker_done` ≠ Hoàn thành — xem `.cursor/rules/github-project-tracking.mdc`.
- **GitHub Flow:** feature branch → commit → push → PR → Cursor DoD review → CI → coordinator merge `main`. Không commit feature thẳng `main` — xem `.cursor/rules/git-workflow.mdc`.
- **Orca:** coding song song `--agent cursor`; plan/design Codex (fallback Cursor); idle worker nhận task `Sẵn sàng` ngay — xem `orca-*.mdc` trong `.cursor/rules/`.

## 9. Liên kết vận hành

- Repo: https://github.com/hangndat/ticket-solution
- Agent rules: root [AGENTS.md](../AGENTS.md) + `.cursor/rules/*.mdc`
- W0 evidence: [W0-FOUNDATION-REPORT.md](./W0-FOUNDATION-REPORT.md)
- Chính sách iOS: không bao giờ Expo/EAS Cloud Build — xem root/mobile `AGENTS.md`, README, PRD, technical design.

## 10. Sau khi duyệt (đã xong 2026-10-16)

1. ~~User xác nhận roadmap / đóng D0~~ — đã duyệt.
2. ~~Cập nhật Issue statuses~~ — D0 Hoàn thành; D1 code slice (#10–#13) xong; parent #2 Chờ duyệt.
3. **Trước D2:** P4 Keycloak API/web UAT đã có evidence ([smoke](./reviews/D1-P4-KEYCLOAK-SMOKE.md)); iOS device smoke khuyến nghị trước pilot. Business endpoints vẫn chờ coordinator mở D2.
