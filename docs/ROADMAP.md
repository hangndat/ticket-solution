# Roadmap — Event Ticketing Platform

Ngày: 2026-10-16  
Nguồn: [PRD](./PRD.md), [Technical Design](./TECHNICAL-DESIGN.md), [Agent Development Plan](./AGENT-DEVELOPMENT-PLAN.md), [W0 report](./W0-FOUNDATION-REPORT.md)  
Tracking lâu dài: GitHub Issues + Project (tiếng Việt). Project: https://github.com/users/hangndat/projects/3 Orca Task/Dispatch chỉ là lần giao thực thi.

**Chưa chốt lịch / thời lượng.** Không gắn ngày giả. Timeline Project có thể tạo view trước, ngày mục tiêu để trống đến khi người dùng chốt.

**Không bắt đầu code nghiệp vụ wave mới** cho đến khi roadmap này được người dùng review.

## 1. Trạng thái hiện tại

| Mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| W0 Foundation | Có evidence, đã tích hợp main | Prototype/foundation — **không** đồng nghĩa production auth, isolation mọi module, hoặc ticketing xong |
| Identity / OIDC | Chưa chốt provider | ADR-09 còn mở; cần spike trước mở tenant business endpoints |
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
| D0 | W0 Foundation | Monorepo, CI, Compose, API health, RLS prototype, web shell, iOS shell | Đã có evidence W0; đánh dấu Hoàn thành trên board sau review user |
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

Mỗi nhóm dưới đây tương ứng parent Issue trên GitHub; sub-issues mang tiêu chí nghiệm thu cụ thể. Trạng thái ban đầu: D0 có evidence → **Chờ duyệt**; phần còn lại → **Chưa lên lịch** hoặc **Sẵn sàng** nếu không bị chặn quyết định.

### D0 — W0 Foundation (đã có code + evidence)

- [ ] Xác nhận W0 foundation đủ để đóng đợt (tooling, CI, RLS test, web shell, iOS shell, chính sách no EAS Cloud Build)
- [ ] Bảo toàn commit/policy/lockfile trên remote `main` và CI Node 24 có iOS JS export

### D1 — Quyết định & Identity

- [ ] Chốt / ghi log O01–O08 (app chung, staff app, tải pilot, form/ngôn ngữ, tái nhập cổng, retention/SLA, custom domain, DB riêng)
- [ ] Spike + chọn managed OIDC (email verify, PKCE iOS, MFA staff, revocation)
- [ ] Membership tenant/event + deny-by-default; thu hồi chặn request tiếp theo
- [ ] Session web (BFF/cookie) và iOS SecureStore; logout xóa dữ liệu cục bộ
- [ ] Không mở endpoint nghiệp vụ tenant khi chưa chứng minh identity/membership

### D2 — Nhận vé

- [ ] Backend: mã/quota → issue transaction → ticket → outbox/email adapter
- [ ] Web: form đổi mã, trạng thái verify, success/ticket qua API thật
- [ ] iOS: My Tickets, QR, cache tối thiểu; vé web xuất hiện cùng identity
- [ ] Kiểm thử độc lập: tranh suất cuối, idempotency key, email lỗi không mất vé

### D3 — Check-in

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
| O01 | App chung hay app riêng từng công ty? | App chung hai chế độ | Store, pipeline, identity, deep link |
| O02 | App riêng cho staff? | Staff trong app chung | UX, quyền, phân phối thiết bị |
| O03 | Tải / số tenant / cổng thực tế? | Baseline pilot PRD mục 9 | Capacity, SLO, test |
| O04 | Form dữ liệu và ngôn ngữ? | Tiếng Việt; schema mở rộng | Nội dung, email, privacy |
| O05 | Tái nhập cổng / nhiều ngày? | Một vé một lượt | Entitlement, check-in model |
| O06 | Retention, vùng dữ liệu, SLA? | Chưa chốt | Hạ tầng, lifecycle |
| O07 | Custom domain/sender ngay release đầu? | Subdomain + sender platform | DNS, deliverability |
| O08 | Database riêng theo tổ chức? | Shared DB + RLS | Deployment, isolation tier |
| ADR-09 | Provider OIDC cụ thể? | Managed OIDC + PKCE | Toàn bộ D1+ |

## 8. Quy ước tracking GitHub

- **Project:** private, gắn repo `hangndat/ticket-solution`.
- **Fields (tiếng Việt):** Trạng thái, Ưu tiên, Đợt bàn giao, Nhóm phụ trách, Ngày bắt đầu, Ngày mục tiêu.
- **Trạng thái:** Chưa lên lịch · Sẵn sàng · Đang làm · Chờ duyệt · Bị chặn · Hoàn thành.
- **Labels:** đợt (`dot-d0`…), nhóm (`nhom-backend`…), loại (`loai-quyet-dinh`, `loai-tinh-nang`, `loai-ha-tang`, `loai-kiem-thu`), ưu tiên.
- **Views:** Tổng quan/Backlog, Board theo trạng thái, Roadmap (không gắn ngày giả).
- **Parent / sub-issues** theo nhóm module; **blocked-by** khi phụ thuộc thật (ví dụ D2 bị chặn bởi D1 identity).

## 9. Liên kết vận hành

- Repo: https://github.com/hangndat/ticket-solution
- W0 evidence: [W0-FOUNDATION-REPORT.md](./W0-FOUNDATION-REPORT.md)
- Chính sách iOS: không bao giờ Expo/EAS Cloud Build — xem root/mobile `AGENTS.md`, README, PRD, technical design.

## 10. Bước sau khi user review

1. User xác nhận / chỉnh đợt, thứ tự, quyết định ưu tiên.
2. Cập nhật Issue statuses và dependencies cho khớp.
3. Chỉ khi đó mới dispatch coding D1/D2 (identity trước business issuance).
