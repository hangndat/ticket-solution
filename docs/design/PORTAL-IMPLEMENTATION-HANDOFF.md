# Portal — Handoff triển khai UI (`product-design`)

> **Supersession 24/10/2026:** [O23](../DECISION-LOG.md) thay `GATE-STAY-APP`: không còn Web Gate scan/link để admission. Các bảng dưới đây ghi lại handoff P0+P1 ngày 18/10; khi triển khai Gate dùng quyết định mới, Portal chỉ đọc báo cáo theo `report.read`.

| Trường | Giá trị |
| --- | --- |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../agents/roles/product-design.md) |
| Output duy nhất | File này — `docs/design/PORTAL-IMPLEMENTATION-HANDOFF.md` |
| Ngày | 2026-10-18 |
| Primary đã duyệt | [`docs/plans/PORTAL-ROADMAP.md`](../plans/PORTAL-ROADMAP.md) — gói **P0+P1** (user duyệt 18/10/2026) |
| Architecture impact | **Không** — UI theo gói host/`apps/portal` đã duyệt; auth boundaries theo architect ADR |
| Ownership UI | `web` → **`apps/portal`** (AntD); không trộn BE/iOS; không prototype code trong Task này |
| Base / research | `origin/main` `c7e344847b1acf1688302fef513b277fc8f18973`; research local trong checkout portal-coordination |
| OUT | P2 multi-event BI · SSO enterprise · payment · Android · Wallet · DNS/deploy/cutover production · mock prod |

**Mục đích:** đủ để worker `web` implement shell + màn hình portal mà **không đoán** route, state, permission, copy VI, hoặc API. Neo contract gap: [`PORTAL-BACKEND-GAPS.md`](../plans/PORTAL-BACKEND-GAPS.md). Discovery UX trước: [`PORTAL-ANTD-UX.md`](./PORTAL-ANTD-UX.md) — **supersede** các option lệch primary (xem §1).

**Sync triển khai (2026-10-19):** Production `portal.vemoki.com` khớp §3.3–§3.6 (sider nhóm + home/auth). WIP nhánh `hangndat/d1-portal-nav-groups`, base `52bc54e3fdcb` — **chưa merge `main`**. UAT/DoD: [PORTAL-PROD-UAT-NAV-2026-10-19.md](../reviews/PORTAL-PROD-UAT-NAV-2026-10-19.md), [PORTAL-LOCAL-UAT-NAV-2026-10-19.md](../reviews/PORTAL-LOCAL-UAT-NAV-2026-10-19.md), [PORTAL-NAV-SPINNER-WIP-DOD-2026-10-19.md](../reviews/PORTAL-NAV-SPINNER-WIP-DOD-2026-10-19.md).

---

## 1. Reconcile PD discovery → primary đã duyệt

Discovery PD (`PORTAL-ANTD-UX.md`) còn option. **Sau duyệt roadmap, chỉ dùng tên tường minh dưới đây** — không copy mã G1/P1/N1 nội bộ file cũ vào ADR/Task Spec.

| Tên primary (bắt buộc) | Nghĩa | Option PD cũ | Hành động handoff |
| --- | --- | --- | --- |
| **`GATE-STAY-APP`** | Web Gate scan giữ `app.vemoki.com/gate`; iOS Gate giữ nguyên; portal chỉ báo cáo khi `report.read` + deep-link «Mở cổng quét» | PD G1 | **Giữ.** Portal **không** mount camera/scan. |
| **`PORTAL-SEPARATE-APP`** | Next app **`apps/portal`** trong monorepo | PD khuyến nghị **N1** host-aware trong `apps/web` | **Đổi.** Implement trong `apps/portal`. Pattern logic/state từ `apps/web/app/admin/**` = **reuse source**, không skin host-aware. |
| **`PLATFORM-PORTAL-ZONE`** | Platform Operator tại **`portal.vemoki.com/platform`**, wave **P1.1**; client/audience/session/nav **riêng** Operator | PD khuyến nghị **P1** «giữ `/platform` trên `app.`» | **Đổi.** Không giữ Platform trên `app.` làm đích. Tenant Owner **không** thấy nav Platform. |
| **`ANTD-CORE-FIRST`** | AntD thuần: Layout/Menu/Table/Form/Drawer/Modal/Steps/Upload; **không** ProComponents mặc định | PD đề xuất ProTable/ProForm chọn lọc | **Không** thêm `@ant-design/pro-components` trừ Task riêng sau compatibility spike. |

**Giữ từ discovery PD (vẫn đúng):** route `tenantId`/`eventId` (không slug resolver); menu deny-by-default O02; brand tokens Vemoki; state matrix empty/loading/error/unknown/denied/stale; VI locale; Gate report ≠ `gate.confirm`; Keycloak IdP ≠ share BFF cookie.

---

## 2. User flows (persona)

### 2.1 Personas trên portal

| Persona | Việc chính | Không làm trên portal |
| --- | --- | --- |
| Owner / Manager | Org overview, events, members, setup/publish, guests, report (nếu perm) | Marketing GTM; scan cổng |
| Event ops | Types/sources/quota, import, duyệt, brand/config | Platform provisioning |
| CS | Tra cứu vé, timeline, resend (cooldown) | Support-grant xuyên tenant |
| Supervisor | Deep-link Gate trên `app.` khi có `gate.*` / `ticket.revoke` | **Không** Cổng report / Nhật ký audit trên portal — `role-map.ts` Supervisor **không** có `report.read`; không suy quyền từ tên role |
| Scanner | — | **Không** shell portal; chỉ Gate `app.` / iOS khi `gate.confirm`; **không** `report.read` / audit |
| Platform Operator | `/platform/*` (P1.1): tenant list/provision/status/limits/grant | Tenant staff menu |

### 2.2 Flow chính

```text
Login staff (Keycloak OIDC, client portal) → cookie BFF host-only portal.
  → Chọn Tổ chức (nhãn name/slug; route /t/[tenantId])
  → Org overview | Events | Members | (Platform chỉ Operator)
  → Chọn/tạo Sự kiện → /t/[tenantId]/e/[eventId]/…
       Tổng quan → Chuẩn bị → Khách & mã → Cổng(report) → Hỗ trợ
  → Async: Import/Export/Publish → Progress/Drawer job · unknown ≠ success
  → Logout: phạm vi portal (khác Operator; khác IdP toàn bộ — theo ADR)
```

Nhánh: hết quyền → `Result` 403; timeout → `unknown`+retry; tenant `SUSPENDED` → banner fail-closed; revoke membership → refresh discovery + soft-landing.

### 2.3 Touch map (sau dual-run / trước cutover production — cutover = Task ủy quyền riêng)

| Việc | `vemoki.com` | `app.` | `portal.` | iOS |
| --- | --- | --- | --- | --- |
| Marketing | Primary | — | — | — |
| Attendee redeem/ví | — | Primary | — | Có |
| Staff admin (parity §10) | — | Legacy `/admin` dual-run | **Primary** | — |
| Gate scan | — | **`GATE-STAY-APP`** | Không | Primary |
| Event report | — | — | Khi `report.read` | — |
| Platform ops | — | Legacy dual-run | **`/platform` P1.1** | — |

---

## 3. Shell, routes, menu permission

### 3.1 Host & packaging

| Mục | Quy định |
| --- | --- |
| Host | `portal.vemoki.com` |
| App | `apps/portal` (`PORTAL-SEPARATE-APP`) |
| UI | `antd` + `@ant-design/nextjs-registry` + `ConfigProvider` VI + theme token §8 |
| Cookie | Host-only trên `portal.` — **không** `Domain=.vemoki.com` |
| Attendee bundle | Không tải antd từ `apps/web` guest |

### 3.2 Route map (id-params — **không** slug resolver)

```text
portal.vemoki.com
  /auth/*                         Login / callback / logout (theo ADR)
  /                               Redirect tenant đầu tiên (tenantId) hoặc empty org
  /t/[tenantId]                   Org overview
  /t/[tenantId]/events            Event list
  /t/[tenantId]/events/new          Wizard tạo sự kiện (Steps)
  /t/[tenantId]/members           Thành viên & lời mời
  /t/[tenantId]/settings          Cấu hình tổ chức / brand (nếu perm)
  /t/[tenantId]/e/[eventId]       Event overview + readiness
  /t/[tenantId]/e/[eventId]/setup
  /t/[tenantId]/e/[eventId]/types     (section hoặc sub; cùng wave setup)
  /t/[tenantId]/e/[eventId]/sources
  /t/[tenantId]/e/[eventId]/quota
  /t/[tenantId]/e/[eventId]/config
  /t/[tenantId]/e/[eventId]/guests
  /t/[tenantId]/e/[eventId]/import
  /t/[tenantId]/e/[eventId]/approvals
  /t/[tenantId]/e/[eventId]/notifications
  /t/[tenantId]/e/[eventId]/gate      Report only — mount nav iff report.read
  /t/[tenantId]/e/[eventId]/support   CS
  /t/[tenantId]/e/[eventId]/export
  /t/[tenantId]/e/[eventId]/audit     P1.1 — H-A1; nav iff report.read + assignment (ADR-20 §7.1)
  /platform/*                     PLATFORM-PORTAL-ZONE (Operator only)
  /account/security               Phiên / logout semantics (P0 nền; P1 mở rộng MFA UI nếu API)
```

- **Nhãn** breadcrumb/switcher: `name` (+ `slug` nếu discovery có).
- **Path luôn** `tenantId` / `eventId` (UUID). Không `/t/[tenantSlug]/e/[eventSlug]` mặc định.
- UUID kỹ thuật: Drawer «Chi tiết kỹ thuật» — không bắt paste UUID khi đã có context.
- Pretty slug admin = chỉ khi BE có contract resolve riêng (hiện **không** có trong gaps → **không** implement).

### 3.3 Menu permission (O02) — nhóm sider

Nguồn: [`o02-permission-nav/contract.md`](./o02-permission-nav/contract.md). Client **chỉ** đọc allowlist server; ẩn item thiếu perm (không disabled giả quyền). `portal-shell.tsx` render Ant Design `Menu` theo **ba nhóm** (keys i18n `nav.group.org` / tên event / `nav.group.eventSetup`); logic item: `apps/portal/src/nav/capabilities.ts` (`EventMenuGroup`: `run` | `setup`).

| Nhóm sider | Menu | Route | Hiện khi |
| --- | --- | --- | --- |
| **Tổ chức này** | Tổng quan tổ chức | `/t/[tenantId]` | `tenantPermissions` giao admin rule ≠ ∅ hoặc analytics |
| | Sự kiện | `…/events` | `event.list` |
| | Phân tích (P2) | `…/analytics` | ≥1 assigned event `report.read` (tenant) |
| | Thành viên | `…/members` | `members.manage` |
| | Cấu hình org | `…/settings` | `tenant.profile` (hoặc perm brand tương đương server) |
| **{eventName}** (`run`) | Tổng quan | `…/e/[eventId]` | Event trong MeEvents hoặc list được phép |
| | Cổng | `…/gate` | **`report.read` trên server** — không suy từ `gate.confirm` / Scanner |
| | Nhật ký | `…/audit` | `report.read` hoặc `inventory.import` (H-A1 / ADR-20 §7.1 khi bật) |
| | Hỗ trợ | `…/support` | `cs.lookup` (resend riêng `cs.resend`) |
| | Export | `…/export` | `export.*` (route riêng; có thể không trong sider tùy wave) |
| **Thiết lập sự kiện** (`setup`) | Chuẩn bị | `…/setup` (+ types/sources/quota/config sub-routes) | Setup/config/publish perms sự kiện |
| | Khách & mã | `…/guests` / import / approvals / notifs | import / approve / notify perms tương ứng |
| Platform (Operator) | Platform | `/platform` | Operator audience — **không** tenant role; nav riêng zone |

Deep-link thiếu quyền → `Result` 403 VI + CTA về overview được phép. Soft-redirect O02 giữ.

### 3.4 Breadcrumb

`Tổ chức / {tenantName} / Sự kiện / {eventName} / {Màn}` — Ant Design `Breadcrumb`; href vẫn mang id.

### 3.5 Shell wireframe

```text
┌ Header: [Vemoki] Portal │ Org ▾ │ Event ▾ │ Tài khoản ▾ ┐
├ Sider (perm) ─┬ Content: Breadcrumb · PageHeader · Alert ┤
│ ▾ Tổ chức này │ Table | Form | Steps | Descriptions       │
│   overview…   │ Drawer detail · Modal confirm · Progress  │
│ ▾ {Event name}│                                         │
│   overview,   │                                         │
│   gate, audit │                                         │
│ ▾ Thiết lập   │                                         │
│   setup, types│                                         │
└───────────────┴───────────────────────────────────────────┘
```

Tablet: sider collapsible; hit target ≥ 44px; Table horizontal scroll; Drawer full-width trên breakpoint nhỏ.

### 3.6 Home, onboarding và auth entry (đã ship prod 2026-10-19)

| Hành vi | Quy định |
| --- | --- |
| `/` chưa đăng nhập | Không kẹt `LoadingSurface` / spinner vô hạn; sau discovery → **`window.location.replace`** sang login Keycloak (`/api/auth/login`) khi chưa có session staff |
| Identity gate | Trang home/onboarding chờ `identity.status !== 'loading'` trước redirect; effect deps ổn định |
| Shell context | `loadShellContext` dedupe inflight; timeout BFF/OIDC (8–20s) → error/unauth, fail-closed |
| Đã đăng nhập | Redirect tenant đầu tiên (`tenantId`) hoặc onboarding theo staff eligibility |

Chi tiết review: [PORTAL-NAV-SPINNER-WIP-DOD-2026-10-19.md](../reviews/PORTAL-NAV-SPINNER-WIP-DOD-2026-10-19.md). **Không** claim merge `main`.

---

## 4. State matrix (mọi màn)

Mở rộng `SurfaceState` (`empty|loading|error|unknown`) + antd `Empty`/`Spin`/`Result`/`Alert`/`Progress`:

| State | Khi nào | UI / copy VI |
| --- | --- | --- |
| `loading` | Fetch | Spin · «Đang tải…» · `aria-busy` |
| `empty` | List 0 | Empty + CTA nếu có quyền tạo |
| `ready` | Có dữ liệu | Table/Form bình thường |
| `error` | 4xx/5xx rõ | Alert + «Thử lại» |
| `unknown` | Timeout / body không parse | «Chưa rõ kết quả» + Kiểm tra lại — **không** tick xanh |
| `permission-denied` | 403 / thiếu capability | `Result` 403 · ẩn mutation |
| `stale` | Version/config lệch | Banner «Dữ liệu đã đổi» + Tải lại |
| `offline` | `navigator.onLine === false` | Alert offline |
| `async-running` | Job import/export/publish | Progress · disable double-submit |
| `async-failed` | Job FAILED | Error + retry nếu idempotent an toàn |
| `suspended` | Tenant SUSPENDED | Banner fail-closed |

**Form:** lỗi field (`validateStatus` + `help`); `aria-describedby`; bảo vệ thay đổi chưa lưu (prompt trước navigate). **Destructive:** `Modal.confirm` + impact/reason; gõ tên/slug khi impact cao. **Bulk:** chỉ khi API bulk tồn tại — không N lần ẩn single.

---

## 5. Brand tokens → AntD + a11y

Nguồn: `brand/vemoki/tokens.json`.

| Vemoki | AntD token |
| --- | --- |
| ink `#22241f` | `colorText` |
| paper `#f7f6f1` | `colorBgLayout` / `colorBgContainer` (đo contrast AA) |
| signal `#9b3a18` | `colorPrimary` |
| focus `#235fd0` | `colorInfo` + focus ring / `controlOutline` |

- Locale: `vi_VN` (`ConfigProvider`).
- Light only MVP; `motion: false` khi `prefers-reduced-motion`.
- Font: stack brand web hiện có — **không** Inter mặc định.
- A11y mục tiêu WCAG 2.2 AA trong scope: contrast, focus keyboard Menu/Table/Drawer/Modal, label + lỗi announce, skip link, hit ≥ 44px tablet.
- Đo: axe + Playwright headless sau có UI — không claim toàn app từ một lần axe.

---

## 6. Screen-by-screen (reuse · API · wave · AntD · states)

**Ký hiệu API:** `READY` = Nest/OpenAPI đủ dùng UI · `WIRE` = API có, thiếu BFF/UI · `GAP` = [`PORTAL-BACKEND-GAPS`](../plans/PORTAL-BACKEND-GAPS.md) G-\*/H-\* · `NEW` = business mới cần contract · `OUT` = ngoài gói.

**Reuse source (logic/DTO/copy):** `apps/web/app/admin/*` — port sang `apps/portal` + AntD; **không** copy nguyên page monolithic.

### 6.1 P0.1 — Nền tảng portal

| Màn | Route | AntD | States bắt buộc | Source reuse | API |
| --- | --- | --- | --- | --- | --- |
| Login / callback / logout | `/auth/*` | Result, Spin | loading, error, unknown | `apps/web` OIDC/BFF patterns | Architect client portal; cookie host-only |
| App shell | layout | Layout, Menu, Breadcrumb, Dropdown | denied soft-landing | O02 chrome | `GET /me/tenants`, `GET /me/events` READY |
| Org / Event switcher | header | Select/Dropdown | empty (0 tenant), denied | Admin tenant select | Same discovery READY |
| Org overview | `/t/[tenantId]` | PageHeader, Table, Statistic* | empty events, loading | Mới + event list | Events list READY; metric ẩn nếu thiếu API |
| Account / logout scope | `/account/security` | Descriptions, Button | ready, error | — | Logout semantics ADR; MFA UI chỉ khi API |

\*Statistic chỉ số đã có API — thiếu → ẩn hoặc «—».

### 6.2 P0.2 — Dữ liệu & chuẩn bị sự kiện

| Màn | Route | AntD | States | Source reuse | API |
| --- | --- | --- | --- | --- | --- |
| Event list | `…/events` | Table + filter server | empty, loading, error, unknown | setup list trong AdminForm | `GET …/events` cursor+limit READY — BFF phải truyền đủ cursor |
| Tạo sự kiện | `…/events/new` | Steps + Form | validation field, error | create flow admin | `POST …/events` READY |
| Event overview / readiness | `…/e/[eventId]` | Descriptions, checklist, Alert | unknown≠green, stale | `deriveAdminReadiness` | Event GET + report counts READY |
| Metadata / lifecycle | `…/setup` | Form, Modal destructive | impact preview, denied | setup panel | PATCH/archive/cancel/clone READY |
| Ticket types | `…/types` | Table, Drawer Form | empty, loading | setup | POST READY; **list = G-T1 / GAP** — UI tạo OK; browse chờ list hoặc tạm chỉ sau create |
| Sources | `…/sources` | Table, Drawer Form | empty | setup | POST READY; list **G-T1** |
| Quota | `…/quota` | Descriptions / Progress | loading, unknown | setup | `GET …/quota` READY |
| Config / brand / versions | `…/config` | Form, Upload, Tabs versions | stale, async publish | `config-brand-panel.tsx` | Config versions list/preview/publish/rollback READY |
| Publish / rollback | overview + config | Popconfirm, Modal | readiness gate, async | readiness strip | Publish ≠ mở redeem ≠ mở Gate (copy rõ) |
| Members / invites | `…/members` | Table, Drawer, Modal | empty, denied | `tenant-staff.tsx` | Invite POST + revoke member READY; **list members/invites/role = G-M1…M4 GAP** — Table cần H-M* trước parity |
| Org settings | `…/settings` | Form | suspended banner | branding tenant | GET/PUT branding READY |

### 6.3 P0.3 — Khách, vé, day-of

| Màn | Route | AntD | States | Source reuse | API |
| --- | --- | --- | --- | --- | --- |
| Guests hub | `…/guests` | Tabs | — | job `guests` | — |
| Import CSV | `…/import` | Upload/Dragger, Table preview, Progress | async-running/failed, unknown | `import-panel.tsx` | Sync `POST …/imports` READY; **job lifecycle G-I1 GAP** — UI multi-step chỉ sau H-I1 hoặc ADR cắt sync |
| Invitations list / dispatch | trong guests | Table, Modal preview | empty, denied | invitation BFF CTR | **G-I2 GAP** |
| Approvals queue | `…/approvals` | Table, Drawer, Modal approve/deny | empty, unknown, idempotent retry | guests panel | Nest `GET …/redemptions?status=PENDING` READY; **BFF list = G-R2 WIRE**; filter nâng cao G-R1 |
| Notifications / reminders | `…/notifications` | Table, Form template, Modal | ACCEPTED≠DELIVERED copy | `notifications-panel.tsx` | List cursor READY; filter state **G-N1**; retry riêng |
| Event dashboard / report deep-links | overview + gate | Statistic O12, Button | asOf watermark, manual refresh | EventReport O12 | `GET …/report` READY — không PII |
| CS lookup / timeline / resend | `…/support` | Input search, Table, Drawer, Button cooldown | denied, unknown, PII masked | support panel AdminForm | CS tickets READY |
| Cổng (report) | `…/gate` | Descriptions, Statistic, CTA | empty rejects, unknown | gate job panel | report READY; CTA → `app.…/gate` (`GATE-STAY-APP`) |

### 6.4 P0.4 — Đủ chức năng & hardening

| Màn | Route | AntD | States | Source reuse | API |
| --- | --- | --- | --- | --- | --- |
| Export job | `…/export` | Form filters, Progress, Download | async, unknown | support export | create/status/download READY; **history list G-E1** optional P1 |
| Codes inventory browse | optional sub guests | Table masked | empty, denied | — | **G-C1 / H-C1** — perm **`inventory.import`** + assignment (ADR-20 §7.1); response id/state/source/type (+ masked suffix nếu có); **không** raw/`code_hmac`; **không** `inventory.read` |
| A11y / perf / keyboard pass | toàn portal | — | focus order | — | — |
| Parity matrix đóng | §10 | — | — | — | Mọi READY+WIRE+GAP P0 đã chọn |

### 6.5 P1.1 — Vận hành nâng cao

| Màn | Route | AntD | States | Source reuse | API |
| --- | --- | --- | --- | --- | --- |
| Audit browser | `…/audit` | Table filter action/from/to | empty, denied, no PII/HMAC/raw | — | **G-A1 / H-A1** — GET mới; perm **`report.read` hiện có** + assignment (không perm mới); Platform audit = `/platform` zone riêng |
| Job history filter | import/export drawers | Table | — | — | G-E1 / G-I1 khi duyệt |
| Security settings | `/account/security` | Descriptions | — | — | Chỉ field API cho phép |
| Platform home | `/platform` | Layout riêng Operator | denied tenant user | `apps/web/app/platform/*` | Audience riêng |
| Platform tenants | `/platform/tenants` | Table | empty | platform UI | create/get READY; **list G-P1 GAP** |
| Platform status/limits/health | `/platform/tenants/[id]` | Descriptions, Form | — | platform | Một phần READY; **G-P2** |
| Support grant | `/platform/grants` | Form reason+TTL, Modal | audit mỗi read | platform | create + tickets READY; revoke theo G-P2 |

### 6.6 P1.2 — Cutover (UI only trong ownership web; DNS = coordinator ủy quyền)

| Việc UI | Hành vi |
| --- | --- |
| Dual-run banner | Legacy `/admin` còn; portal primary cho staff mới |
| Deep-link migration | Preserve org/event/intent allowlist; reject `//` / host ngoại; không token/PII trên URL |
| Redirect GET/HEAD | Destination cố định; không redirect mù mutation POST |
| Rollback UX | Tắt redirect app→portal trước khi về legacy; tránh loop |

**Không** implement production DNS/TLS trong handoff này.

### 6.7 OUT (không thiết kế màn)

Multi-event analytics (G-D1 / O12–O14 OUT) · saved views automation · EN portal · custom roles · enterprise SSO · payment/refund/transfer · seat · Wallet · Android · validate-only desk.

---

## 7. Keyboard / focus / form / responsive

| Chủ đề | Quy định |
| --- | --- |
| Keyboard | Tab order: skip link → header switcher → sider → content actions → table rows → drawer |
| Focus | Focus trap trong Modal/Drawer; trả focus trigger khi đóng; focus ring dùng `focus` token |
| Form errors | Submit → focus first invalid; `role="alert"` / `aria-live` cho lỗi form-level |
| Table | Server cursor — **không** giả `total`/page số khi API không có; filter/deep-link giữ query allowlist |
| Responsive tablet | Breakpoint AntD; sider collapse; primary actions không chỉ icon-only; Drawers full width &lt; md |
| Touch | Hit ≥ 44px Approve/Deny/Publish/Upload |

---

## 8. Grouping theo wave primary (implement order gợi ý)

Một feature coding Dispatch web tại một thời điểm (`apps/portal` cùng slice với `apps/web`). BE gap song song ownership khác.

```text
P0.1  Shell apps/portal + auth + org/event context + O02 menu + org overview
P0.2  Events list/wizard + setup/types/sources/quota/config/publish + members (khi H-M*)
P0.3  Import/guests/approvals/notifications + CS + report gate + dashboard deep-links
P0.4  Export + inventory browse (H-C1 = inventory.import masked) + a11y/perf + đóng parity matrix
P1.1  Audit (H-A1 = report.read + assignment) + Platform zone + job history filters
P1.2  Dual-run deep-link / redirect UI (deploy = Task riêng)
```

**Không** chờ toàn Story đóng để mở Task unblocked khác ownership. **Không** đợi architect nếu Task UI không phụ thuộc ADR còn mở; auth/cookie/OIDC portal = dependency thật cho P0.1 login.

---

## 9. Contract gaps ảnh hưởng UI (neo BE — không bịa)

| ID | Ảnh hưởng UI | Wave UI | Ghi chú |
| --- | --- | --- | --- |
| G-M1…M4 / H-M* | Members Table/role/invite list | P0.2 parity | Block «portal đủ» nếu thiếu |
| G-R2 | Approvals list | P0.3 | **WIRE** — ưu tiên BFF forward |
| G-I1 / H-I1 | Import Steps/Progress | P0.3 | Hoặc ADR cắt sync + document |
| G-I2 | Invitations | P0.3 | Masked list |
| G-T1 | Types/sources browse | P0.2 | Tạo vẫn được |
| G-N1 | Notif filter | P0.3/P0.4 | |
| G-E1 | Export history | P0.4/P1.1 | |
| G-C1 / H-C1 | Codes browse | P0.4/P1 | `inventory.import` + assignment; no raw/`code_hmac`; **không** `inventory.read` |
| G-A1 / H-A1 | Audit | P1.1 | `report.read` + assignment; **không** `audit.read` / role migration |
| G-P1 / G-P2 | Platform list/health | P1.1 | Operator only |
| G-D1 | Multi-event dash | **OUT** | Không thiết kế |
| Bulk approve | RowSelection bulk | — | Chỉ sau contract bulk |

Audit writers đã có nhiều nơi; **GET browser** = new endpoint — UI P1.1 không fake từ client logs.

---

## 10. Parity matrix (UI → BFF → API → role → evidence)

Trước tuyên bố «portal thay admin» / cutover: **mọi hàng P0 = Pass** với evidence headless + exact SHA. Không bỏ CS/export/members.

| # | Capability | UI portal | BFF | API Nest | Role / perm tối thiểu | Tiêu chí test thực tế | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | Login staff portal | `/auth` | Cookie host-only | OIDC | staffEligible | Login thật; Set-Cookie không Domain parent | P0.1 |
| P02 | Org switcher | Header | `/me/tenants` | READY | tenant perms | Đổi org xóa cache event; không leak | P0.1 |
| P03 | Event list cursor | Table | forward cursor | READY | `event.list` | Trang 2 ≠ duplicate; không client-filter giả | P0.2 |
| P04 | Tạo event Steps | Form | POST | READY | `event.create` | Không paste tenant UUID | P0.2 |
| P05 | Readiness + Publish | Checklist | config/publish | READY | publish perms | Timeout = unknown; disabled đúng lý do | P0.2 |
| P06 | Types/sources/quota | Table/Form | | POST+quota; list G-T1 | event admin | Tạo được; list theo gap | P0.2 |
| P07 | Config/brand/versions | Form/Upload | | READY | config | Preview; không HTML thô; rollback confirm | P0.2 |
| P08 | Members/invites | Table | list khi H-M* | GAP→READY | `members.manage` | Last-Owner; revoke fail-closed | P0.2 |
| P09 | Import codes | Upload/Progress | | sync hoặc H-I1 | `inventory.import` | Preview không reserve; commit idempotent | P0.3 |
| P10 | Approvals | Table/Drawer | **G-R2 wire** | GET pending READY | `redemption.approve` | Approve/deny + Idempotency-Key; email masked | P0.3 |
| P11 | Notifications | Table | | READY + G-N1 | notify | ACCEPTED ≠ DELIVERED copy | P0.3 |
| P12 | CS search/resend | Search/Drawer | | READY | `cs.lookup` / `cs.resend` | PII masked; cooldown; unknown recovery | P0.3 |
| P13 | Event report | Gate page | | READY | `report.read` | asOf + refresh; Scanner không thấy | P0.3 |
| P14 | Deep-link Gate scan | CTA | — | — | `gate.confirm` trên app | Mở `app./gate` đúng event; portal không camera | P0.3 |
| P15 | Export | Progress/Download | | READY | `export.*` | Job READY→download; cross-tenant 404 | P0.4 |
| P16 | Cross-tenant deny | Mọi list | | RLS | — | ID tenant B → 403/404 policy | P0.4 |
| P17 | Audit browser | Table | | H-A1 | `report.read` + assignment | Actor/action/time/result allowlist; no PII/HMAC/raw; Supervisor/CS/Scanner denied | P1.1 |
| P18 | Platform tenants | `/platform` | | H-P1 | Operator+MFA | Tenant user 403 toàn zone | P1.1 |
| P19 | Support grant | Form | | READY | Operator | Reason+TTL; audit | P1.1 |

**Pass row:** UI state đúng §4 · BFF same-origin/CSRF · API không mock · role matrix · lệnh UAT/log gắn **exact SHA**.

---

## 11. Visual acceptance — checklist screenshot headless

Chạy sau implementation: `scripts/web-uat.sh` / Playwright **headless** trên host portal (local/staging được phép). Artifact: `apps/portal/.uat-artifacts/` (hoặc path CI thống nhất). **Không** computer-use chuột desktop user.

| ID | Viewport | Persona / perm | Route | Expect chụp |
| --- | --- | --- | --- | --- |
| V01 | desktop 1280 | Owner | shell + `/t/…` | Brand mark, sider perm, org name |
| V02 | tablet 768 | Owner | cùng | Sider collapsed, hit targets |
| V03 | desktop | Owner | `/events` | Table + empty CTA |
| V04 | desktop | Manager | `/events/new` | Steps 1–3 |
| V05 | desktop | Manager | event overview | Readiness; Publish disabled tooltip |
| V06 | desktop | Manager | setup/config | Form + versions |
| V07 | desktop | ops | import | Upload + preview errors |
| V08 | desktop | approver | approvals | Table pending + Drawer |
| V09 | desktop | CS | support | Search + masked + Resend disabled cooldown |
| V10 | desktop | `report.read` | gate report | Stats + CTA Gate; **không** video |
| V11 | desktop | Scanner-only | bất kỳ admin URL | Result 403 / soft-landing — **không** sider admin |
| V12 | desktop | thiếu `report.read` | — | Nav Cổng **không** hiện |
| V13 | desktop | export perm | export | Progress → download affordance |
| V14 | desktop | members | members | Table (sau H-M*) |
| V15 | desktop | bất kỳ | forced offline / timeout | `unknown` hoặc offline Alert |
| V16 | desktop | Operator | `/platform` | Shell Operator riêng |
| V17 | desktop | Owner | `/platform` | 403 |
| V18 | desktop | Manager | audit (P1.1) | Table filters; no raw secrets |
| V19 | desktop | keyboard-only | Modal confirm | Focus trap + return focus |
| V20 | desktop | VI locale | Form invalid | Field error VI announce |

Mỗi Vxx: file PNG/WebP + ghi SHA build + role fixture dùng.

---

## 12. Hướng dẫn triển khai (ownership)

| Mục | Giá trị |
| --- | --- |
| UI ownership | `web` — **`apps/portal` only** |
| Không | Sửa `apps/mobile`; tự sửa OpenAPI/contracts/lockfile (coordinator); ProComponents mặc định; Umi/Ant Design Pro scaffold |
| Reuse | Logic/panels từ `apps/web/app/admin/{admin-form,import-panel,config-brand-panel,notifications-panel,tenant-staff}.tsx` + `src/ui/surface-state.tsx` + O02 nav — **port**, không dual-maintain host-aware |
| Platform reuse | `apps/web/app/platform/*` → `apps/portal` `/platform` (P1.1) |
| Gate | Giữ `apps/web/app/gate` — portal chỉ link |
| Tokens | §5 + `brand/vemoki/tokens.json` |
| i18n | VI trước |
| Good enough MVP wave | P0.1 shell auth ổn → P0.2 data → P0.3 day-of → P0.4 parity; P1.1 sau |
| Blocker contract | Flag coordinator khi GAP chặn AC; không mock Nest để xanh UAT |

### DoD role PD (Task này)

| # | Mục | Section |
| --- | --- | --- |
| 1 | User flow | §2 |
| 2 | States UI | §4 + §6 |
| 3 | A11y | §5 · §7 |
| 4 | UI AC / screenshots | §10 · §11 |
| 5 | Hướng dẫn implement | §1 · §3 · §8 · §12 |

---

## 13. Giới hạn & non-claims

- Handoff **design** — chưa chứng minh runtime portal, chưa pin `antd` version (spike P0.1).
- Không commit/`gh` từ worker; root coordinator commit docs wave.
- Không production DNS/deploy/cutover.
- Code complete ≠ acceptance complete ≠ pilot ready.
- CRG session: graph ready; semantic embeddings = 0 — verify source thắng khi lệch.

---

## 14. Tóm tắt executive

Portal implement trên **`apps/portal`** + AntD VI theo **`PORTAL-SEPARATE-APP` / `GATE-STAY-APP` / `PLATFORM-PORTAL-ZONE` / `ANTD-CORE-FIRST`** — đã reconcile khỏi khuyến nghị PD cũ (host-aware, Platform giữ app, Pro*). Routes chỉ `tenantId`/`eventId`; menu O02; mọi màn P0–P1 có state/AntD/reuse/API gap; parity matrix + screenshot headless V01–V20 trước cutover. Còn lại: architect ADR auth cho P0.1, BE đóng H-M*/H-I*/H-A*/H-P*, worker web coding theo wave — **không** đợi P2.
`)
