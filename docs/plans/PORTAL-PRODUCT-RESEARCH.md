# Portal admin Vemoki — Nghiên cứu sản phẩm & roadmap đề xuất

| Trường | Giá trị |
| --- | --- |
| Role | `product-ba` — [`docs/agents/roles/product-ba.md`](../agents/roles/product-ba.md) |
| Ownership | **Chỉ** file này (`docs/plans/PORTAL-PRODUCT-RESEARCH.md`) |
| Ngày soạn | 2026-10-18 |
| Source HEAD đối chiếu | `400ad87a1401972476c79f17c4fd726ca7538063` |
| Ủy quyền | User/coordinator: discovery + design + roadmap — **không** feature coding / commit / push / PR / deploy / DNS / cài package |
| Architecture impact | **Có** — host `portal.vemoki.com`, cookie/OIDC audience, ranh giới Gate & platform; BA **không** tự quyết |
| Ngôn ngữ | Tiếng Việt (giữ ID, API, path, SHA, URL nguyên bản) |
| Trạng thái | **Revalidation 2026-10-18** — product **đã confirmed** `portal.vemoki.com` + antd; chỉ **implementation / ADR options** còn proposal. Không sửa ROADMAP / PRD / DECISION-LOG |
| Revalidation | Coordinator fix-pass: không hỏi lại “có muốn portal?”; O12 web consumer + CS = source hiện tại (board Hoàn thành, source wins); UX-11 Keycloak verified email (không OTP attendee); team **song song** BA∥architect∥PD; pending list = Nest GET có / BFF GET chưa |

### Ranh giới tuyên bố

| Được | Không được |
| --- | --- |
| Audit source `/admin` `/platform` `/gate` + API/BFF (read-only) | Sửa `apps/**`, `infra/**`, lockfile |
| Benchmark public Help/marketing (URL + ngày truy cập; ghi rõ public docs vs thực nghiệm) | Đăng nhập competitor / trial / scrape auth |
| Roadmap capability + P0/P1/P2; ADR options Gate/platform/cookie/stack | Hỏi lại product đã confirmed; mặc định chuyển quyền Gate/platform; tự mở SSO/billing/custom-domain |
| Tách **nâng UX / API gap / new proposal / defer** | Android / payment / refund / transfer / seat / Wallet |
| Metrics đo được từ evidence hiện có hoặc gate UAT sau này | Invent tracking/analytics pipeline mới |
| Phân biệt quan sát / suy luận / giả thuyết | Claim “professional portal đã sẵn” / pilot ready; serialize BA→architect→PD |

**Liên quan đã có (không thay file này):** [O13 GTM subdomain](../DECISION-LOG.md#o13--trang-bán-platform-gtm--tách-subdomain-18102026) (`vemoki.com` sales · `app.vemoki.com` product); [D11-BA-RESEARCH](./D11-BA-RESEARCH.md); [DASHBOARD-MARKET-SYNTHESIS](./DASHBOARD-MARKET-SYNTHESIS.md) (O12 KPI); [UX-11](../DECISION-LOG.md) Keycloak verified email.

---

## 1. Vấn đề / outcome

### 1.1 Vấn đề (quan sát + suy luận)

Hiện staff admin và platform ops sống **cùng app web** với attendee (`/admin`, `/platform`, `/gate` trên cùng origin với redeem/claim). Surface quản trị đã có chức năng rộng (PRD M01–M12) nhưng IA vẫn là **một workspace dày** (`admin-form.tsx` ~2390 dòng; job tabs Chuẩn bị / Khách & mã / Cổng / Hỗ trợ). O13 đã chốt marketing vs product host. **User đã yêu cầu product:** portal admin riêng **`portal.vemoki.com` + Ant Design (antd)** — không còn câu hỏi “có tách portal hay giữ admin trên app”. Architect/PD/web làm **song song** trên ADR options + IA; BA không serialize hàng đợi team.

### 1.2 Outcome (research này)

1. Định nghĩa **“professional portal”** cho Vemoki (ops invite-code + Gate, không suite bán vé).
2. Ma trận capability: hiện có / nâng UX / API gap / new (cần duyệt riêng) / defer.
3. **ADR options** còn mở: Gate host, platform co-location, cookie/OIDC wiring, `apps/portal` vs skin `apps/web` — không tự thi hành DNS/deploy.
4. Roadmap P0/P1/P2 + JTBD + AC + metrics cho Epic planner / ownership workers chạy song song khi capacity cho phép.

---

## 2. Phương pháp & hạn chế bằng chứng

| Bước | Nguồn | Loại |
| --- | --- | --- |
| Personas / modules | [`docs/PRD.md`](../PRD.md) §3, §5–§6 | Quan sát |
| Host đã chốt | [`docs/DECISION-LOG.md`](../DECISION-LOG.md) O13 | Quan sát |
| Dashboard KPI | [`DASHBOARD-MARKET-SYNTHESIS.md`](./DASHBOARD-MARKET-SYNTHESIS.md) O12 | Quan sát (đã chốt dictionary) |
| UX pain admin | [`D11-BA-RESEARCH.md`](./D11-BA-RESEARCH.md) §2–§3 | Quan sát + suy luận |
| Source admin/platform/API | `apps/web/app/admin/**`, `apps/web/app/platform/**`, `apps/web/app/gate/**`, `apps/web/app/api/bff/**`, `apps/api/src/*.ts` @ HEAD trên | Quan sát code |
| Graph | code-review-graph-ticket `list_graph_stats_tool` (2026-10-18): nodes/edges sẵn; semantic search theo tên symbol hạn chế → bổ sung lean-ctx + `rg` | Quan sát có hạn chế |
| Benchmark | Eventbrite, Ticket Tailor, Cvent, Ant Design / Ant Design Pro — **ngày truy cập 2026-10-18** | **Public docs / marketing only** (WebFetch hoặc search snippet có URL); **không** thực nghiệm đăng nhập / trial / UI nội bộ |

**Không có trong phiên này:** UAT headless runtime `/admin` trên prod; phỏng vấn user; metrics production; đăng nhập competitor; thao tác trong organizer dashboard đối thủ.

**Working tree:** có thay đổi user/Run khác tại `apps/mobile` và `infra` — **không đụng**; research chỉ đọc và ghi file output này.

---

## 3. Host model (product confirmed; ADR options còn mở — Architecture impact: Có)

### 3.1 Ba lớp host (product)

| Host | Vai trò | Ai dùng | Trạng thái |
| --- | --- | --- | --- |
| `vemoki.com` | Marketing / GTM sales | Prospect Owner + Agency | **Đã chốt O13** |
| `app.vemoki.com` | Attendee product: redeem, claim, event public, account khách | Attendee | **Đã chốt O13** product; sau cutover portal = **attendee-facing** (staff chuyển `portal`) |
| `portal.vemoki.com` | Staff admin portal (**antd**): org, event ops, CS, reports, settings; platform console theo ADR G2 | Owner / Manager / CS / Supervisor / (tuỳ Gate) / Platform Operator | **Product confirmed** (user yêu cầu). ADR còn: DNS/TLS, OIDC clients, cookie, cutover |

### 3.2 ADR options — Gate & platform boundary (không mặc định chuyển quyền)

Product **đã** chọn portal riêng; bảng dưới chỉ **implementation / security options** (architect ∥ PD ∥ security — song song, không chờ BA tuần tự).

| # | Câu hỏi ADR | Phương án A | Phương án B | Khuyến nghị BA (suy luận) |
| - | ----------- | ----------- | ----------- | ------------------------ |
| G1 | Web Gate (`/gate`) nằm host nào? | `portal.*` cùng staff | `app.*` hoặc host `gate.*` riêng (device shared) | **A cho Supervisor/report deep-link**; cân nhắc B nếu thiết bị cổng không nên có full admin cookie |
| G2 | Platform Operator (`/platform`) | Cùng `portal.*` (nav tách, audience OIDC riêng như hiện tại) | Host `ops.*` / nội bộ | **A** giai đoạn đầu (giảm DNS); giữ verifier platform riêng (xem `apps/api/src/platform.ts` Deps comment MFA/platform audience) |
| G3 | Cookie / session scope | Cookie host-only per subdomain | Shared parent `.vemoki.com` | **Host-only** — khớp hướng [`TECHNICAL-DESIGN.md`](../TECHNICAL-DESIGN.md) (session cookie HttpOnly/Secure/**host-only**; subdomain không chia sẻ session tenant-wide). Architect xác nhận OIDC redirect URI + BFF `PUBLIC_WEB_ORIGIN` |
| G4 | iOS staff Gate | Giữ app native (không đổi) | — | Không đưa native vào portal web; portal deep-link tới event context thôi |
| G5 | Redirect sau login staff | `portal` mặc định nếu `staffEligible` | User chọn surface | PD + auth flow; **không** phá attendee Keycloak verified-email (UX-11 Option A — OTP/magic link = sau MVP) |

**Invariant không đàm phán:** tenant context transaction-local + RLS; deny-by-default RBAC; quota/check-in nguồn PostgreSQL; không impersonate âm thầm (PRD M12). Guest redeem: **Keycloak + email verified** (UX-11), không coi OTP attendee là invariant MVP.

### 3.3 Ant Design — product confirmed; stack wiring = ADR

| Mục | Product | ADR / PD (song song) |
| --- | --- | --- |
| Design system portal | **antd** bắt buộc (user) — pattern ProLayout / ProTable / Form từ [Ant Design](https://ant.design/docs/spec/introduce) & [Ant Design Pro](https://github.com/ant-design/ant-design-pro) | Fork `apps/portal` vs route group trong `apps/web`? |
| Brand attendee | **Không** áp antd lên guest redeem/event (giữ Vemoki tokens / D6–D8) | PD |
| i18n portal | Pilot VI; EN marketing đã O13 — portal EN = sau | — |

Nguồn antd (2026-10-18, **public docs**, WebFetch/search): [Introduction](https://ant.design/docs/spec/introduce); Pro `access`/routes ([cheatsheet](https://github.com/ant-design/ant-design-pro/blob/master/docs/cheatsheet.en-US.md)). Không chạy scaffold local trong research này.

---

## 4. Audit hiện trạng source (quan sát @ `400ad87a…`)

### 4.1 Surfaces web

| Surface | Path | Evidence | Vai trò thực tế |
| --- | --- | --- | --- |
| Admin workspace | `apps/web/app/admin/page.tsx` + `admin-form.tsx` | Auth `requireSessionOrAuth('/admin')` + capability; form ~2390L; jobs `setup \| guests \| gate \| support` (`admin-form.tsx:98-105`, nav `1288+`) | Tenant/event ops gom một trang |
| Import / brand / notifications / staff | `import-panel.tsx`, `config-brand-panel.tsx`, `notifications-panel.tsx`, `tenant-staff.tsx` | Panel con gắn job | Async import, brand draft/publish, email/push templates, invite/revoke |
| Platform console | `apps/web/app/platform/platform-console.tsx` (~659L) | Create tenant, status/limits/health, support grant | Platform Operator |
| Gate web | `apps/web/app/gate/*` | Session / reserve / confirm BFF | Scanner/Supervisor dự phòng |
| Nav chrome | `apps/web/src/nav/capabilities.ts:10-15,151-217` | Admin nếu permission ∈ `event.create\|event.list\|members.manage\|tenant.profile`; Gate nếu `gate.confirm`; Platform nếu `platformMe.operator` | Deny-by-default UI |

### 4.2 Job map admin hiện tại → module PRD

| Job UI | Section headings (source) | Module PRD chính |
| --- | --- | --- |
| Chuẩn bị | «Chuẩn bị · sự kiện», «Metadata & vòng đời», «Loại vé & nguồn mã», ConfigBrandPanel | M03, M04, M05 |
| Khách & mã | ImportPanel, «Duyệt yêu cầu đổi mã», NotificationsPanel | M06, M07, M09 |
| Cổng | «Cổng · báo cáo sự kiện» (O12 fail-closed report), deep-link pending/email | M10, M11 (dashboard) |
| Hỗ trợ | TenantStaffPanel, «CS — …», export | M02, M11 |

### 4.3 API Nest (staff/platform — không liệt kê attendee đầy đủ)

| Controller file | Endpoint nhóm (quan sát `@Controller` / decorators) | Portal consumer |
| --- | --- | --- |
| `apps/api/src/events.ts` | CRUD/list/clone/archive/cancel/impact-preview; ticket-types; sources | Setup |
| `apps/api/src/config.ts` | config-versions, publish, rollback, assets | Brand/content |
| `apps/api/src/inventory.ts` | imports, quota | Guests |
| `apps/api/src/approval.ts` | redemptions list/approve/deny | Guests |
| `apps/api/src/cs.ts` | tickets search/detail/resend | Support |
| `apps/api/src/exports.ts` | exports create/status/download | Support |
| `apps/api/src/reporting.ts` | `GET …/report` | Gate job / Dashboard |
| `apps/api/src/notifications.ts` | list/preview/publish/retry | Guests |
| `apps/api/src/gate.ts` | sessions, reservations, confirm, undo, revoke, offline-sync | Gate surface |
| `apps/api/src/platform.ts` | `platform/me`, tenants CRUD/status/limits, invites, support-grants, account-deletion | Platform + team |

### 4.4 BFF web (`apps/web/app/api/bff/…`)

Nhóm chính đã có route (quan sát cây thư mục):

- **Admin:** `events`, `ticket-types`, `sources`, `imports` (+ upload/preview/commit/errors), `quota`, `report`, `redemptions/approve|deny` (**chỉ POST**), `tickets` (+ resend), `exports` (+ download), `config-versions`, `publish`, `rollback`, `assets`, `notifications`, `notification-templates`, `reminders`, `invitations`
- **Platform:** `platform/me`, `platform/tenants` (+ status/limits/health), `platform/support-grants`
- **Membership:** `tenants/…/invites`, `members`, `me/membership-invites/accept`
- **Gate:** `gate/sessions`, `reservations`, `confirm`
- **Discovery:** `me/tenants`, `me/events`

**Pending list — phân biệt Nest vs BFF (quan sát source):**

| Lớp | List pending redemptions | Approve / deny |
| --- | --- | --- |
| Nest API | **Có** `GET tenants/:tenantId/events/:eventId/redemptions` — `apps/api/src/approval.ts:199` | **Có** POST approve/deny — `:230`, `:254` |
| Web BFF | **Chưa có** `GET /api/bff/admin/redemptions` (thư mục chỉ `approve/`, `deny/`) | **Có** POST BFF |
| Admin UI | Nhập `requestId` thủ công — `admin-form.tsx` section «Duyệt yêu cầu đổi mã» (~1863+) | Gọi BFF approve/deny |

**O12 report / CS (source wins):** web consumer đã có trong tree — `apps/web/src/admin/report.ts` parse `pendingApprovalCount`, `checkInSuccessCount`, `asOf`, …; admin Gate panel render KPI; CS search/resend qua BFF `admin/tickets*`. Không mô tả như “wave O12 còn thiếu” vì lịch sử board/research cũ.

**Kết luận audit:** Backend + BFF **đã cover** phần lớn capability PRD; gap portal = **host/IA antd** + **BFF GET pending list** (Nest đã có) + polish UX — không thiếu toàn bộ nghiệp vụ hay O12 consumer.

### 4.5 Roles (source)

`MembershipRole`: `Owner | Manager | CS | Supervisor | Scanner` — `apps/web/src/platform/contracts.ts:37-42` (khớp packages/contracts). Platform Operator tách qua `platform/me.operator` (không phải membership tenant).

---

## 5. Personas × tổ chức × sự kiện × nền tảng

| Persona | Phạm vi | JTBD portal | Surface đề xuất |
| --- | --- | --- | --- |
| **Platform Operator** | Nền tảng | Tạo/suspend tenant, limits/flags, support grant có audit | `portal` · khu Platform (hoặc ops sau) |
| **Tenant Owner** | Tổ chức | Onboarding org, members/RBAC, brand mặc định, đa event | `portal` · Org settings + portfolio events |
| **Event Manager** | Sự kiện | Lifecycle, quota, import, approvals, publish, export | `portal` · Event workspace |
| **CS** | Sự kiện (PII tối thiểu) | Tìm vé/yêu cầu, resend, timeline — không sửa quota | `portal` · Support |
| **Supervisor** | Sự kiện + cổng | Theo dõi check-in/reject, undo có lý do, audit | `portal` report + Gate (theo G1) |
| **Scanner** | Cổng | Quét nhanh — tối thiểu admin | Ưu tiên **iOS Gate**; web Gate tối giản |
| **Attendee** | — | Không dùng portal | `app.vemoki.com` |

**Tổ chức vs sự kiện vs nền tảng (mô hình thông tin đề xuất):**

```text
Platform  → tenants, limits, support grants, health
Tenant    → members, org brand defaults, event list
Event     → setup / guests / gate metrics / support (job hiện tại)
```

Học từ Eventbrite Workspaces (Events · Orders · Marketing · Reports · Finance · Org Settings) — chỉ **mượn pattern tách workspace**, reject Finance/Marketing Boost ([Eventbrite blog 2022](https://www.eventbrite.com/blog/eventbrite-workspaces-navigation/), truy cập 2026-10-18).

---

## 6. Định nghĩa «Professional portal» (cụ thể cho Vemoki)

Portal được coi là **professional** khi đồng thời:

1. **Job-first IA:** vào đúng việc trong ≤3 click từ login (Setup / Guests / Day-of / Support / Org / Platform) — không một scroll form kỹ thuật.
2. **Context luôn rõ:** tenant + event + role + trạng thái publish/redeem/check-in (readiness) trên shell.
3. **Fail-closed & honest ops:** số liệu `shown | unknown | rejected` + `asOf` (O12); không “xanh giả” khi offline/stale.
4. **RBAC visible + enforced:** ẩn UI + API từ chối; Scanner không thấy export/CS đầy đủ.
5. **Async jobs hạng nhất:** import/export/notification có trạng thái, idempotency, tải lỗi theo quyền (PRD M06/M11).
6. **Audit/support path:** mọi approve/deny/resend/undo/suspend có lý do + actor; support grant có hạn.
7. **Design system ổn định:** antd layout/table/form/empty/result — dense data, a11y focus/contrast (PRD §9).
8. **Tách khỏi guest chrome:** không lẫn CTA đổi mã / marketing Vemoki trên shell staff.

**Không** yêu cầu để gọi là professional (defer / ngoài MVP): revenue BI, CRM, SSO doanh nghiệp, billing tự động, custom domain email, RFID/badge print.

---

## 7. Benchmark cổng quản trị (primary sources, 2026-10-18)

Không tạo account / trial. **Mọi URL dưới = public docs hoặc marketing** — không phải thực nghiệm trong dashboard đã đăng nhập.

| Sản phẩm | URL đã đọc | Loại evidence | Pattern học cho portal Vemoki | Reject / ngoài phạm vi |
| --- | --- | --- | --- | --- |
| **Eventbrite** | [Workspaces navigation](https://www.eventbrite.com/blog/eventbrite-workspaces-navigation/) (**WebFetch** 2026-10-18, nội dung blog 2022); [Org settings](https://www.eventbrite.com/help/en-us/articles/103302/how-to-manage-your-organization-settings/); [Permissions glossary](https://www.eventbrite.com/help/en-us/articles/362073/permissions-definitions/) (search snippet + URL verified) | Public blog/Help | Left-nav workspaces theo job; Org Settings tách Team; quyền granular | Orders refund, Finance payouts, Marketing Boost, seat maps |
| **Ticket Tailor** | [Team access](https://help.tickettailor.com/en/articles/1550092-can-i-add-other-users-to-my-account); [Check-in app users](https://help.tickettailor.com/en/articles/1966803-how-to-download-and-invite-your-team-to-the-check-in-app); [Check-in data](https://help.tickettailor.com/en/articles/5028380-how-to-see-your-check-in-data) (Help ghi updated July 30, 2026) | Public Help (search + URL) | Tách **dashboard team** vs **check-in app users**; cảnh báo offline double-scan; Checked-in ≠ Attended | In-person paid orders, membership redeem |
| **Cvent** | [User roles](https://support.cvent.com/s/communityarticle/How-do-I-configure-permissions-for-a-user); [OnArrival staff](https://support.cvent.com/s/communityarticle/Creating-Onsite-Staff-Logins-for-OnArrival); [Access Portal](https://www.cvent.com/en/event-marketing-management/cvent-access-portal) | Public support/marketing (search + URL) | Role wizard; **onsite staff login tách**; portal stakeholder read-only | Full enterprise suite, RFID, badge, payments |
| **Ant Design / Pro** | [antd introduce](https://ant.design/docs/spec/introduce) (**WebFetch**); [Pro repo](https://github.com/ant-design/ant-design-pro); Pro cheatsheet trên GitHub | Public docs/repo | ProLayout, table/list/form, route `access` ẩn menu | Không copy demo Analytics/CRM pages |

**Insight áp dụng (suy luận BA):**

1. Industry tách **org settings / event ops / onsite check-in credentials** — Vemoki đã có mầm (TenantStaff vs Gate session) nhưng UI còn dính một trang.
2. Professional = **nav ổn định + quyền + job states**, không phải thêm module bán hàng.
3. Onsite staff thường **hẹp permission** (Cvent OnArrival / Ticket Tailor check-in users) — củng cố G1: cân nhắc không gắn full portal cookie lên thiết bị cổng.

---

## 8. Ma trận capability

Chú thích cột **Trạng thái**:

- **Hiện có** — API + UI tối thiểu đã có trong source  
- **Nâng UX** — đủ API, cần portal IA/antd  
- **API gap** — UI/PRD cần contract bổ sung (đã biết hoặc suy luận)  
- **New proposal** — chưa có / ngoài baseline; **cần user duyệt**  
- **Defer** — cố ý sau MVP / O10 non-goals  

| Vùng | Capability | Trạng thái | Evidence / ghi chú | Ưu tiên đề xuất |
| --- | --- | --- | --- | --- |
| Onboarding | Tạo tenant (Operator) + Owner invite | Hiện có | `platform-console` createTenant; `POST platform/tenants`; invites BFF | P0 UX copy + wizard |
| Onboarding | First-event checklist (publish ≠ mở redeem ≠ mở Gate) | Nâng UX | Admin readiness helpers `apps/web/src/admin/readiness.ts`; align Story readiness D11 | P0 |
| Onboarding | Self-serve signup org từ marketing | New proposal | O13 form «Đăng ký quan tâm» ≠ auto-provision | P2 (duyệt) |
| Event lifecycle | Create/list/patch/clone/archive/cancel + impact-preview | Hiện có | `events.ts` + BFF `admin/events*` | P0 shell |
| Event lifecycle | Config draft/preview/publish/rollback + assets | Hiện có | `config.ts` + ConfigBrandPanel | P0 |
| Guests / codes | CSV import async preview/commit/errors | Hiện có | ImportPanel + inventory imports | P0 job UX |
| Guests / codes | Invitations dispatch preview | Hiện có | BFF `admin/invitations*` | P1 |
| Approvals | Approve / deny + lý do | Hiện có | Nest POST + BFF POST `admin/redemptions/approve\|deny`; UI cần `requestId` | P0 |
| Approvals | **List** hàng đợi pending | **API gap BFF** (Nest GET đã có) | Nest `GET …/redemptions` (`approval.ts:199`); **không** có BFF GET; UI không list | P0 (BFF + table UI) |
| Quota | Read quota + enforce trên issue | Hiện có | inventory quota; report quota fields | P0 (dictionary O12) |
| Import/export async | Export job + signed download | Hiện có | exports API/BFF; lịch sử MinIO 503 = ops gap | P1 reliability UX |
| Comms | Notification templates preview/publish/retry; reminders | Hiện có | NotificationsPanel + notifications API | P1 |
| Team / RBAC | Invite/revoke members + event assignment roles | Hiện có | TenantStaffPanel; membership roles | P0 IA Org |
| Team / RBAC | Fine-grained custom roles UI | Defer / New | Eventbrite glossary rộng hơn MVP role-map | Defer |
| Audit / support | CS search/resend; support grant platform | Hiện có | `cs.ts` + BFF `admin/tickets*`; platform support-grants — **source hiện tại** | P0/P1 polish portal |
| Audit / support | Timeline thống nhất request→ticket→email→check-in | Nâng UX (± API) | PRD M11; CS đã tra cứu/resend — timeline giàu hơn = polish | P1 |
| Reports | Event report quota + pending + check-in + `asOf` (O12) | **Hiện có** (source) | `reporting.ts` + `apps/web/src/admin/report.ts` + admin Gate panel; dictionary O12 — **không** coi consumer còn thiếu | P0 migrate sang portal antd |
| Reports | Multi-event Owner portfolio BI | Defer | O12: chỉ event-scoped MVP | Defer |
| Settings / security | Suspend tenant blocks admin mutations | Hiện có | admin suspend banner copy `admin-form.tsx:~1276` | P0 |
| Settings / security | MFA admin, session revoke UX | API/policy gap | PRD M02 MFA; OIDC sẵn — UX portal cần PD | P1 |
| Settings / security | SSO / billing / custom-domain | Defer | PRD «sau MVP»; task cấm tự mở | Defer |
| Gate | Web + offline sync API | Hiện có | gate.ts; D7 | ADR G1 (host placement) |
| Platform | Limits/flags/health | Hiện có | platform console | P1 polish + ADR G2 |
| Host tách portal | `portal.vemoki.com` + antd | **Product confirmed** | User yêu cầu; ADR = wiring/cutover/stack (§3) | P0 implement sau ADR song song |
| Payment / seat / Wallet / Android | — | Defer | O10 | Defer |

---

## 9. Pain points (ưu tiên)

| # | Pain | Ai | Evidence | Loại xử lý |
| - | ---- | -- | -------- | ---------- |
| P1 | Một trang admin mật độ cao / lộ chi tiết kỹ thuật | Manager, CS | `admin-form.tsx` jobs vẫn một bundle; D11 §2.2; screenshot lịch sử D8 | Nâng UX (P0) |
| P2 | Staff & attendee cùng origin — cookie/chrome lẫn | Owner, Operator, bảo mật | O13 `app` host; product đã chọn `portal` | Implement host (ADR G3) |
| P3 | Pending duyệt: có count trên report nhưng **không list BFF** — phải dán UUID | Manager | Nest GET có; BFF GET thiếu; UI `requestId` tay | BFF GET + ProTable (P0) |
| P4 | Scanner/Supervisor dễ lẫn full admin trên thiết bị cổng | Scanner | Benchmark TT/Cvent (public docs) tách onsite login | ADR G1 |
| P5 | Platform console UX “ops nội bộ” (IDs, raw limits) | Operator | `platform-console.tsx` copy kỹ thuật | Nâng UX |
| P6 | Onboarding org thiếu guided empty states | Owner mới | Suy luận từ thiếu wizard; API create/invite đã có | Nâng UX |
| P7 | Export/async lỗi hạ tầng (MinIO…) hiện như failure tối nghĩa | Manager | D11/D4 historical gaps | Reliability + UX trạng thái |

---

## 10. JTBD ưu tiên

Mỗi job: **Khi** … **muốn** … **để** …

| ID | Persona | JTBD | Horizon |
| --- | --- | --- | --- |
| J1 | Owner | Khi nhận tenant ACTIVE, muốn hoàn thành invite + event DRAFT đầu trong một checklist | P0 |
| J2 | Manager | Khi chuẩn bị sự kiện, muốn làm Setup (meta → types/sources → brand → publish) theo bước, không mất context | P0 |
| J3 | Manager | Khi có CSV mã/khách, muốn theo dõi job import (preview/commit/errors) và biết quota impact trước commit | P0 |
| J4 | Manager | Khi có pending duyệt, muốn **hàng đợi list** → approve/deny có lý do + deep-link từ report (không dán UUID) | P0 |
| J5 | Manager/Supervisor | Khi event live, muốn xem KPI O12 (`asOf`, check-in, pending, email lỗi) trên shell portal antd | P0 migrate (consumer **đã có** trên `/admin`) |
| J6 | CS | Khi khách thiếu email, muốn search ticket và resend có cooldown/audit, không đụng quota | P0 (CS **đã có** — polish portal) |
| J7 | Owner | Khi thêm nhân sự, muốn gán role Owner/Manager/CS/Supervisor/Scanner theo event | P0 |
| J8 | Operator | Khi onboard khách hàng, muốn tạo tenant + limits + theo dõi health/suspend có reason | P1 |
| J9 | Mọi staff | Khi mở `portal.vemoki.com`, muốn shell antd ổn định, menu theo quyền, không thấy redeem guest | P0 (song song ADR wiring) |

---

## 11. Roadmap (product portal+antd confirmed; ADR ∥ delivery)

> Product direction **đã** confirmed. ADR options (§3.2–3.3) và P0 coding **không** serialize BA→architect→PD — team chạy **song song** khi capacity/WIP cho phép. Không spawn từ file này.

### Wave 0 — ADR / cutover options (architect ∥ PD ∥ security) — **không** hỏi lại “có portal không”

1. Chốt §3.2 G1–G5 (Gate host, platform co-host, cookie, redirect staff).  
2. Chốt stack: `apps/portal` mới vs route group `apps/web` + antd.  
3. Chốt phạm vi P0 delivery: **shell + IA migrate** vs strangler mount panel.  
4. Non-goals O10 giữ nguyên (không mở SSO/billing/custom-domain).

**AC Wave 0:** ADR/handoff có OIDC redirect list, cookie matrix, `PUBLIC_WEB_ORIGIN` per host — **không** yêu cầu user “duyệt có muốn portal”.

### Wave 1 — P0 Professional shell (song song PD wireframe khi ADR đủ stub)

| Story gợi ý | Ownership | AC ngắn |
| --- | --- | --- |
| S1 Portal shell antd + nav theo capability | web (+ coordinator host khi được phép) | Menu khớp `deriveNavCapabilities`; 403/empty theo role; headless UAT login→event list |
| S2 Event workspace 4 job → routes riêng | web | Deep-link `?job=&section=` tương thích O12; không regress BFF |
| S2b Pending list BFF GET + UI bảng | web + backend/BFF | Nest GET đã có → expose BFF; hết bắt buộc dán UUID |
| S3 Org members IA | web | Invite/revoke/list; Scanner không thấy CS/export |
| S4 Report cards fail-closed + deep-link trên portal | web | Giữ O12 dictionary/fields **đã có** trên `/admin`; không invent metric |
| S5 Platform khu vực trên portal | web | Giữ audience platform riêng; support grant bắt buộc reason/TTL |

**Metrics đo được (không invent tracker mới):**

| Metric | Cách đo sau ship | Baseline |
| --- | --- | --- |
| Time-to-first-event (Owner) | UAT headless script bước J1 (đồng hồ tường) | Chưa đo — chỉ so sánh trước/sau trên cùng script |
| Click-to-approve từ report | UAT: report → **list** pending → approve | Hiện: count + dán UUID tay |
| Capability mismatch | Test: role Scanner không gọi được export BFF (đã có hướng deny API) + UI ẩn | Giữ regression |
| Report honesty | UI không render số khi `unknown/rejected` | O12 contract (đã có parser) |

### Wave 2 — P1 Ops polish

- Timeline CS thống nhất; notification/reminder UX; export error recovery copy; MFA/session UX; Operator health polish; invitations dispatch UX.  
- Gate host theo quyết định G1 (nếu tách device profile).

### Wave 3 — P2 / cần duyệt riêng

- Self-serve org từ form quan tâm (ops + product).  
- EN portal; custom roles; portfolio multi-event Owner.  
- **Không** tự mở: SSO, billing, custom-domain, payment, Android, Wallet, seat.

---

## 12. Acceptance criteria mẫu (P0 stories)

### AC-S1 — Shell portal

- **Given** user Manager `staffEligible`, **When** mở `portal` (hoặc path P0 tạm), **Then** thấy nav Sự kiện / (Gate nếu có quyền) / Tài khoản — **không** CTA Đổi mã trên shell chính.  
- **Given** user chỉ Scanner (`gate.confirm`, không admin perms), **When** mở portal admin routes, **Then** bị từ chối hoặc chỉ Gate tối giản theo G1.  
- Evidence: headless UAT + unit nav capabilities (đã có hướng `apps/web/tests` nav/platform-shape).

### AC-S2 — Job routes

- **Given** Manager trên event, **When** deep-link tới section duyệt / CS email từ report, **Then** đúng panel (tương thích `goToAdminSection` hiện tại `admin-form.tsx:249+`).  
- **Given** mutation timeout, **When** UI nhận unclear, **Then** không claim thành công (giữ pattern Idempotency/unclear hiện có).

### AC-S4 — Report

- **Given** O12 dictionary, **When** render check-in KPI, **Then** = lượt Gate confirm thành công; có `asOf` hoặc trạng thái unknown — không poll marketing “realtime”.

---

## 13. Phụ thuộc & gọi team (song song)

| Vai trò | Việc | Phụ thuộc thật |
| --- | --- | --- |
| **User** | (đã) Confirm portal+antd; chọn ADR options G1–G5 / cutover khi architect trình | Không blocker research |
| **Architect** | ADR: DNS/TLS, OIDC redirect, cookie, BFF `PUBLIC_WEB_ORIGIN`, `apps/portal` vs `apps/web` | **∥** PD / planner |
| **product-design** | IA sitemap portal antd, empty/skeleton, Gate placement (theo G1 draft) | **∥** architect — không chờ BA tuần tự |
| **web** | Shell/routes antd; BFF GET pending khi contract sẵn | Stub PD + ADR đủ để branch |
| **backend** | Gap chính: **GET pending list** BFF (Nest đã có); timeline CS giàu nếu cần | Không “report O12 còn thiếu” |
| **ios** | Không bắt buộc portal web; không phá Gate app | — |
| **reviewer-dod / security** | Exact-SHA khi có PR host/auth | Sau coding |
| **Epic planner** | Tách Story/Task; wave bề rộng tối đa | Không spawn từ BA |

**Coordinator:** không merge/deploy DNS từ research; giữ WIP — ưu tiên review nếu hàng đợi đầy.

---

## 14. In / Out of scope

### In (product confirmed → implement theo ADR)

- Portal staff `portal.vemoki.com` + antd IA.  
- Migrate/restructure UX cho capability **đã có** (gồm O12 report + CS trên source hiện tại).  
- BFF GET pending redemptions (Nest đã có).  
- ADR ranh giới Gate & Platform (G1–G5).

### Out (giữ)

- Android native; payment/refund/transfer; seat; Wallet (O10).  
- SSO doanh nghiệp; billing tự động; custom-domain/email sender riêng (PRD sau MVP).  
- Marketing copy trên `vemoki.com` (O13 — epic riêng).  
- Thay đổi invariant RLS/quota/check-in.  
- Guest OTP/magic link như invariant MVP (UX-11: Keycloak verified email; OTP = sau MVP).  
- Invent analytics product mới (pixel, funnel SaaS).

### New / mở rộng cần duyệt riêng (ngoài portal+antd đã confirm)

1. ~~Host `portal.vemoki.com` + antd~~ — **đã là yêu cầu sản phẩm** (không hỏi lại).  
2. Tách package `apps/portal` (vs skin `apps/web`) — **ADR option**, không đổi product intent.  
3. Self-serve tenant provisioning từ lead form.  
4. Tách hoàn toàn credential onsite (kiểu Ticket Tailor check-in users) nếu khác StaffSession hiện tại.  
5. Custom role builder vượt role-map MVP.

---

## 15. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
| --- | --- | --- |
| Cookie/OIDC lệch → attendee/session dính staff | Cao | Architect ADR + security review bắt buộc trước deploy host |
| Big-bang rewrite `admin-form` | Cao | Strangler: shell mới + mount panel theo job; không dừng BFF |
| Phạm vi trôi sang “Cvent suite” | Trung bình | Ma trận §8 + non-goals; reject Finance/CRM |
| Gate trên portal → thiết bị cổng quá quyền | Trung bình | Chốt G1; mặc định Scanner → app native |
| Coi research = đã ship professional | Thấp | Status: product confirmed ≠ acceptance/pilot ready |
| Serialize BA→architect→PD làm chậm | Trung bình | Wave song song; chỉ hard-dep artifact thật |

---

## 16. Câu hỏi ADR còn mở (không hỏi lại product portal)

1. ~~Có tách `portal` hay giữ admin trên `app`?~~ — **Đã confirmed: tách `portal.vemoki.com` + antd.**  
2. Web Gate: portal / app / tách? (**G1**)  
3. Platform console: cùng portal hay host nội bộ? (**G2**)  
4. P0 cutover: antd trên deploy tạm cùng origin trước, hay DNS `portal` ngay khi coding?  
5. Có muốn “onsite-only login” hẹp hơn membership Scanner hiện tại không? (**new proposal** — ngoài MVP trừ khi duyệt)

---

## 17. Kết luận điều hành

1. **Product confirmed:** `portal.vemoki.com` + **antd**; xương Nest/BFF/ops (gồm O12 report + CS trên source) đã có — gap chính **host/IA**, **BFF GET pending list**, ADR Gate/platform/cookie.  
2. **Architecture impact: Có** trên wiring — không phải trên việc “có làm portal hay không”.  
3. Roadmap: **ADR ∥ PD ∥ P0 shell** (không serialize BA→architect→PD) → P1 polish → P2 chỉ mục cần duyệt riêng (§14).

---

## 18. Phụ lục — chỉ mục evidence nhanh

| Chủ đề | Path:line / URL |
| --- | --- |
| Admin jobs | `apps/web/app/admin/admin-form.tsx:98-105` |
| Admin nav jobs UI | `apps/web/app/admin/admin-form.tsx:1288+` |
| Setup heading | `apps/web/app/admin/admin-form.tsx:1310` |
| Nav permissions | `apps/web/src/nav/capabilities.ts:10-15,169-185` |
| Roles | `apps/web/src/platform/contracts.ts:37-42` |
| Platform API | `apps/api/src/platform.ts` (controller ~378–507) |
| O13 host | `docs/DECISION-LOG.md` O13 |
| O12 dashboard (dictionary) | `docs/plans/DASHBOARD-MARKET-SYNTHESIS.md` |
| O12 web consumer (source) | `apps/web/src/admin/report.ts` (`asOf`, `checkInSuccessCount`, …) |
| Pending Nest GET | `apps/api/src/approval.ts:199` |
| Pending BFF (chỉ POST) | `apps/web/app/api/bff/admin/redemptions/{approve,deny}/` |
| UX-11 Keycloak verified email | `docs/DECISION-LOG.md` / PRODUCTION-READINESS-UX UX-11 |
| Eventbrite workspaces | https://www.eventbrite.com/blog/eventbrite-workspaces-navigation/ (public blog; WebFetch) |
| Ticket Tailor check-in data | https://help.tickettailor.com/en/articles/5028380-how-to-see-your-check-in-data (public Help) |
| Cvent OnArrival staff | https://support.cvent.com/s/communityarticle/Creating-Onsite-Staff-Logins-for-OnArrival (public support) |
| Ant Design intro | https://ant.design/docs/spec/introduce (public docs; WebFetch) |
| Ant Design Pro | https://github.com/ant-design/ant-design-pro (public repo) |

---

*Revalidation BA 2026-10-18. Không commit/push. `worker_done` qua Orca với `--report-path` trỏ file này.*
