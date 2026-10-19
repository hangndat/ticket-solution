# Portal admin Ant Design — UX / IA / roadmap đề xuất

| Trường | Giá trị |
| --- | --- |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../agents/roles/product-design.md) |
| Tracking | Run `run_df32d5572a2d` · Task discovery/design (không Issue board gắn cứng trong Task Spec) |
| Ownership | **Chỉ file này** — không sửa `apps/**`, `infra/**`, không cài package |
| Ngày | 2026-10-18 |
| Source HEAD lúc bắt đầu Task | `400ad87a1401972476c79f17c4fd726ca7538063` |
| Trạng thái | **Design / roadmap** — user **đã yêu cầu** `portal.vemoki.com` + Ant Design; còn chốt Gate/Platform boundary + ADR cutover (architect/web). **Không** claim pilot/production ready |
| Architecture impact | **Có** — host boundaries (`portal.`), Next App Router + Ant Design registry, cookie/OIDC redirect; cần thẩm định `architect` / `web` trước coding |

**Phạm vi Task:** discovery + design + roadmap UI portal staff. **OUT:** code tính năng, tạo prototype/Figma trong Task này, deploy/DNS, commit/push/PR, mở Android / payment / refund / transfer / seat / Wallet / **SSO IdP ngoài Keycloak** / billing / custom-domain.

**Đã confirmed (không hỏi lại):** host staff = `portal.vemoki.com`; UI kit = `antd`. **Không** đề xuất giữ admin trên `app.` như phương án thay thế.

**Baseline liên quan (không thay file này):** [`D11-PRODUCTION-UX-UI.md`](./D11-PRODUCTION-UX-UI.md) (job IA admin), [`o02-permission-nav/contract.md`](./o02-permission-nav/contract.md), [`o13-marketing-app-subdomain.md`](../architecture/o13-marketing-app-subdomain.md), API gaps BE [`PORTAL-BACKEND-GAPS.md`](../plans/PORTAL-BACKEND-GAPS.md).

**Sync triển khai (2026-10-19):** Production `portal.vemoki.com` đã chạy **sider nhóm** (org · tên sự kiện · thiết lập) và luồng `/` chưa đăng nhập → Keycloak (không kẹt spinner vô hạn). Code trên nhánh `hangndat/d1-portal-nav-groups`, base review `52bc54e3fdcb` — **WIP chưa merge `main`**. Evidence: [PORTAL-PROD-UAT-NAV-2026-10-19.md](../reviews/PORTAL-PROD-UAT-NAV-2026-10-19.md), [PORTAL-LOCAL-UAT-NAV-2026-10-19.md](../reviews/PORTAL-LOCAL-UAT-NAV-2026-10-19.md), DoD [PORTAL-NAV-SPINNER-WIP-DOD-2026-10-19.md](../reviews/PORTAL-NAV-SPINNER-WIP-DOD-2026-10-19.md). Implementation: `apps/portal/src/nav/capabilities.ts`, `apps/portal/src/components/portal-shell.tsx`.

---

## 0. Mục tiêu & ranh giới

Thiết kế **portal chuyên nghiệp** cho nhân sự tổ chức (Owner / Manager / CS / Event ops) trên host **`portal.vemoki.com`** (đã yêu cầu), giao diện **Ant Design (`antd`)** (đã yêu cầu), brand Vemoki — tách guest/attendee trên `app.vemoki.com` và marketing trên `vemoki.com`.

| IN | OUT |
| --- | --- |
| Host triad (đã yêu cầu) + Gate/Platform **boundary options** (cần chốt) | Mặc định chuyển Gate scan / Platform ops sang portal; hỏi lại «giữ admin trên app?» |
| IA, menu, routes (id-params), wireframe text, state matrix, **parity cutover** | Implement `apps/web` / package install / prototype trong Task này |
| AntD thuần vs ProComponents (không bắt buộc Umi/Pro scaffold) | Ant Design Pro template nguyên khối |
| Map màn hình existing → proposal + API gap neo BE | Screenshot giả làm proof runtime; bịa slug-resolve API |
| 3 màn ưu tiên design-review sau duyệt coding | Claim «portal đủ» khi còn thiếu CS/export/staff parity |

---

## 1. Evidence & hạn chế nghiên cứu

### 1.1 Nguồn chính thức (truy cập 2026-10-18)

| URL | Nội dung dùng | Hạn chế |
| --- | --- | --- |
| [ant.design/components/overview](https://ant.design/components/overview/) | Catalog Layout/Menu/Breadcrumb/Steps/Table/Form/Drawer/Modal + mục Others: ProLayout, ProForm, ProTable, … | Không thay bằng screenshot nội bộ |
| [ant.design/docs/react/introduce](https://ant.design/docs/react/introduce) | Enterprise React UI; i18n; theme; **antd 6.x** (changelog hiện `v6.6.6` trên docs) | Phiên bản pin khi coding — Task này không cài |
| [ant.design/docs/react/customize-theme](https://ant.design/docs/react/customize-theme) | `ConfigProvider` Design Token (Seed/Map/Alias), disable motion | Map token → brand Vemoki (§8) |
| [ant.design/docs/react/use-with-next](https://ant.design/docs/react/use-with-next) | Next **App Router** + `@ant-design/nextjs-registry` (`AntdRegistry`); cảnh báo sub-components dạng `Select.Option` | **Architecture impact** — web/architect chốt registry |
| [procomponents.ant.design](https://procomponents.ant.design/) / [npm `@ant-design/pro-components`](https://www.npmjs.com/package/@ant-design/pro-components) | Gói Pro* (ProTable/ProForm/ProLayout…); npm hiện công bố `2.8.10` | Site ProComponents trả về mỏng khi fetch tự động — ưu tiên catalog trên ant.design overview + npm; **không** dùng screenshot giả |

### 1.2 Quan sát repo (source — không phải runtime proof)

| Quan sát | Nguồn | Ý nghĩa PD |
| --- | --- | --- |
| Admin = một route `/admin` + `AdminForm` ~2390 LOC, job tabs `setup\|guests\|gate\|support` | `apps/web/app/admin/*` | Đã có IA theo việc (D11) nhưng shell “page dài”, nhiều UUID/input thô |
| `apps/web` **không** phụ thuộc `antd` | `apps/web/package.json` | Stack `antd` đã yêu cầu — pin phiên bản khi coding |
| Host O13 hiện: apex marketing · `app.` product (admin/gate/platform trên product path) | `docs/architecture/o13-marketing-app-subdomain.md` | User đã yêu cầu tách admin → `portal.`; ADR cutover vẫn cần (DNS/OIDC/cookie) — **không** hỏi lại giữ admin trên `app.` |
| Permission chrome: `staffEligible` + `tenantPermissions` / event permissions | `docs/design/o02-permission-nav/contract.md` | Nav portal phải deny-by-default |
| Brand tokens: ink `#22241f`, paper `#f7f6f1`, signal `#9b3a18`, focus `#235fd0` | `brand/vemoki/tokens.json` | Map Ant Design token; tránh purple-default |
| Surface states sẵn có: empty/loading/error/unknown | `apps/web/src/ui/surface-state.tsx` | Portal bổ sung permission-denied / stale / async-job |
| Platform console tách `/platform` | `apps/web/app/platform/*` | **Không** gộp mặc định vào portal tenant |
| Gate scan web `/gate` + iOS staff | D11 + O02 | Boundary Gate cần chốt riêng (§3) |

### 1.3 Graph / MCP

`code-review-graph-ticket` sẵn trong session worker (stats OK lúc research). Semantic search theo cụm từ tự do trả 0 node — đã bổ sung bằng lean-ctx + đọc source admin/platform. Coordinator ghi CRG không khả dụng ở phía họ: limitation đó **không** chặn artifact PD này.

---

## 2. Personas & flows (portal)

### 2.1 Personas (staff — không attendee)

| Persona | Việc chính trên portal | Không làm trên portal (đề xuất) |
| --- | --- | --- |
| Tenant Owner / Manager | Org overview, tạo/sửa event, members, publish readiness | Marketing GTM, platform tenant provisioning |
| Event ops | Setup loại vé/nguồn/config, import mã, duyệt redeem | Quét cổng vật lý (ưu tiên iOS) |
| CS / Support | Tra cứu vé, resend, export | Support-grant xuyên tenant (platform) |
| Scanner | Gate scan (iOS / tuỳ host Gate) | **Không** suy quyền xem báo cáo: menu «Cổng / report» chỉ hiện khi server cấp `report.read` (O02 allowlist). `gate.confirm` ≠ `report.read` |

### 2.2 Flow chính

```text
[Đăng nhập staff qua Keycloak OIDC] → chọn Tổ chức (nhãn name/slug từ discovery; route theo tenantId)
  → Org overview (sự kiện gần đây · thành viên · trạng thái org)
  → chọn / tạo Sự kiện → Event workspace (route theo eventId)
       ├─ Tổng quan (readiness + checklist)
       ├─ Chuẩn bị (metadata · loại vé · nguồn · brand · publish)
       ├─ Khách & mã (import · duyệt · thông báo)
       ├─ Cổng (báo cáo — chỉ nếu report.read; không thay scan)
       └─ Hỗ trợ (CS · export) — parity bắt buộc trước cutover
  → Hành động phá hủy / async: Modal confirm + Progress/Drawer job
```

Nhánh lỗi: hết quyền → soft landing; API timeout → unknown/retry; version lệch → stale; tenant `SUSPENDED` → banner fail-closed (giữ hành vi hiện có).

### 2.3 Touch map (sau ADR cutover)

| Việc | Marketing `vemoki.com` | Attendee `app.` | Portal `portal.` | iOS |
| --- | --- | --- | --- | --- |
| Sales / legal | Primary | — | — | — |
| Đổi mã / vé guest | — | Primary | — | Có |
| Admin org/event (đủ parity §12) | — | Legacy `/admin` (dual-run rồi redirect) | **Primary (đã yêu cầu)** | — |
| Gate scan | — | Tuỳ §3 | Không mặc định | Primary |
| Event report | — | — | Chỉ khi `report.read` | — |
| Platform ops | — | `/platform` hiện tại | **Không mặc định** | — |

---

## 3. Host triad & boundary (Architecture impact)

### 3.1 Host (sản phẩm — đã yêu cầu)

| Host | Vai trò | Session cookie BFF |
| --- | --- | --- |
| `vemoki.com` | Marketing / sales / legal | Không mang session product (O13 B2) |
| `app.vemoki.com` | Attendee + guest event + redeem + (tuỳ) Gate scan UI | Host-only trên `app.` |
| `portal.vemoki.com` | Staff admin org/event workspace (**đã yêu cầu**) | Host-only trên `portal.` — **không** `Domain=.vemoki.com` |

Invariant giữ: cookie **host-only từng host**; BFF same-origin; RLS/tenant/quota/check-in không đổi vì UI host.

### 3.2 Keycloak IdP ≠ share BFF cookie

| Khái niệm | Ý nghĩa | Không đồng nghĩa |
| --- | --- | --- |
| **Keycloak OIDC (IdP sẵn có)** | Staff đăng nhập qua realm/client hiện có (`ticket-web` / `ticket-admin-web`…); có thể thêm redirect URI cho `portal.` | «SSO một cookie cho mọi subdomain» |
| **BFF session cookie** | Cookie access/refresh **host-only** trên đúng origin đang dùng (`app.` hoặc `portal.`) | `Domain=.vemoki.com` / chia sẻ cookie giữa attendee và portal |

Cùng IdP Keycloak **không** yêu cầu (và **không** cho phép theo invariant repo) share BFF cookie giữa `app.` và `portal.`. Mỗi host giữ session riêng sau login/callback trên origin đó.

### 3.3 So với O13 (cutover, không hỏi lại scope host)

O13 từng đặt admin trên `app.vemoki.com`. Yêu cầu hiện tại: staff admin → `portal.vemoki.com`. Việc còn lại là **ADR cutover** (DNS/nginx/OIDC redirect/`WEB_PUBLIC_ORIGIN`/dual-run) — **không** mở lại câu «có nên giữ admin trên app không?».

### 3.4 Gate boundary — options (không mặc định chuyển quyền scan)

| Option | Mô tả | Pros | Cons |
| --- | --- | --- | --- |
| **G1 — Scan giữ `app.` / iOS; portal có job báo cáo theo perm** | `/gate` scan + mobile; portal «Cổng» = Event report **chỉ nếu** `report.read` | Tách ops dense vs scan; khớp D11 | Hai host staff nếu scanner web |
| **G2 — Toàn bộ Gate (scan+report) lên portal** | Scanner web dùng `portal.` | Một staff host | Trộn camera UX với dense admin |
| **G3 — Dual tạm** | Deep-link chéo trong dual-run | Cutover mềm | CSRF/origin phức tạp |

**Khuyến nghị PD:** **G1** cho **scan**. Nav báo cáo trên portal: **chỉ** khi discovery/server cấp `report.read` — **không** suy Scanner có quyền đọc report từ `gate.confirm`.

### 3.5 Platform boundary — options

| Option | Mô tả | Khuyến nghị PD |
| --- | --- | --- |
| **P1 — Platform giữ `/platform` trên `app.` (hoặc host ops riêng sau)** | Support-grant / tenant provisioning ≠ tenant staff | **P1** — không gộp vào portal |
| **P2 — Nhúng Platform vào portal dưới nav «Hệ thống»** | Một shell | Trộn blast radius quyền |
| **P3 — `ops.vemoki.com` sau** | Tách hẳn | Trì hoãn đến khi cần |

### 3.6 Packaging Next (đề xuất cho architect/web)

| Option | Ý tưởng | Ghi chú |
| --- | --- | --- |
| **N1 — Host-aware trong `apps/web`** | Middleware: `portal.` portal routes; `app.` guest+gate | Một ownership web |
| **N2 — App/package portal riêng** | `apps/portal` | Chỉ khi cadence/bundle buộc tách |

**Khuyến nghị PD:** N1 wave đầu. Bắt buộc: `@ant-design/nextjs-registry` + `ConfigProvider` theme trên layout portal. **Không** mặc định Ant Design Pro / Umi.

---

## 4. Ant Design thuần vs ProComponents

### 4.1 So sánh

| Tiêu chí | `antd` thuần | `@ant-design/pro-components` chọn lọc | Ant Design Pro + Umi scaffold |
| --- | --- | --- | --- |
| Layout/Menu/Breadcrumb/Table/Form/Drawer/Modal/Steps | Đủ | ProLayout/ProTable/ProForm tăng tốc schema | Toàn bộ routing/layout assumption Umi |
| Khớp Next App Router hiện có | Docs chính thức hỗ trợ | Dùng được như lib React | **Xung đột** với Next ownership — không khuyến nghị |
| Bundle / learning | Nhẹ hơn | Nặng hơn; API Pro* riêng | Rất nặng |
| Brand token | `ConfigProvider` | Cùng token antd | Theme Pro mặc định dễ lệch Vemoki |

### 4.2 Quyết định đề xuất (sau duyệt coding)

1. **Nền:** `antd` + `ConfigProvider` + `AntdRegistry` (Next App Router).
2. **Chọn lọc Pro\*:** `ProTable` (list + filter), `ProForm` / `StepsForm` (wizard tạo event), có thể `ProLayout` **hoặc** tự dựng `Layout`+`Menu` antd nếu ProLayout kéo theo convention thừa.
3. **Không** adopt toàn bộ Ant Design Pro template / Umi.
4. Reuse pattern state VI từ `SurfaceState`; map sang `Empty` / `Spin` / `Result` / `Alert` antd — không mất copy fail-closed.

---

## 5. Information architecture & routes

### 5.1 Menu (permission-aware, nhóm sider)

Chrome: sider Ant Design `Menu` với **`type: 'group'`** — **không** một danh sách phẳng org + event. Header giữ org/event switcher; **nhãn** `name` (và slug nếu discovery trả về) từ `GET /me/tenants` / event list; **đường dẫn** dùng **id** (`tenantId` / `eventId`). UUID có thể mở Drawer «Chi tiết kỹ thuật» — không bắt user paste UUID khi đã chọn context.

| Nhóm sider (VI mặc định · EN khi locale EN) | Mục (route id-params) | Hiện khi | Map job / ghi chú |
| --- | --- | --- | --- |
| **Tổ chức này** / This organization | Tổng quan `/t/[tenantId]` | O02 admin chrome | — |
| | Sự kiện `…/events` | `event.list` | list trong setup |
| | Phân tích `…/analytics` | ≥1 event `report.read` (tenant) | P2 portfolio khi bật |
| | Thành viên `…/members` | `members.manage` | `tenant-staff.tsx` |
| | Cấu hình `…/settings` | `tenant.profile` | org brand/profile |
| **{tên sự kiện}** — vận hành (`group: run`) | Tổng quan `…/e/[eventId]` | event trong MeEvents | readiness strip |
| | Cổng `…/gate` | **`report.read`** — không suy Scanner / `gate.confirm` | job `gate` (report) |
| | Nhật ký & mã `…/audit` | `report.read` hoặc `inventory.import` | audit browser |
| | Hỗ trợ `…/support` | `cs.lookup` | job `support` |
| **Thiết lập sự kiện** / Event setup (`group: setup`) | Chuẩn bị `…/setup` | setup/config perms | job `setup` |
| | Loại vé `…/types` | cùng nhóm setup | |
| | Nguồn mã `…/sources` | cùng | |
| | Hạn mức `…/quota` | cùng | |
| | Cấu hình & publish `…/config` | cùng | |
| | Khách & mã `…/guests` | import / approve / notify perms | job `guests` |

Nguồn nhóm và permission: `buildOrgMenuItems` / `buildEventMenuItems` trong `apps/portal/src/nav/capabilities.ts` — grouping **không** bypass O02; chỉ sắp xếp UI.

Ẩn item thiếu permission — **không** hiện disabled giả quyền. Deep-link thiếu quyền → `Result` 403 VI + CTA về overview được phép.

### 5.2 Route map (proposal — không giả định slug-resolve API)

```text
portal.vemoki.com
  /auth                              → login staff (Keycloak OIDC)
  /                                  → redirect tenant đầu tiên (theo tenantId) hoặc empty
  /t/[tenantId]                      → Org overview
  /t/[tenantId]/events               → Event list + CTA tạo
  /t/[tenantId]/events/new           → Wizard tạo sự kiện (Steps)
  /t/[tenantId]/e/[eventId]          → Event overview + readiness
  /t/[tenantId]/e/[eventId]/setup
  /t/[tenantId]/e/[eventId]/guests
  /t/[tenantId]/e/[eventId]/gate     → chỉ mount nav nếu report.read
  /t/[tenantId]/e/[eventId]/support
  /t/[tenantId]/members
```

**Không** dùng `/…/[tenantSlug]/…/[eventSlug]` làm contract routing mặc định — tránh giả định API resolve slug→id cho admin (guest public slug ≠ staff admin path). Slug/`name` chỉ để **hiển thị**. Pretty-URL slug (nếu sau này có contract) = quyết định BE riêng; xem [`PORTAL-BACKEND-GAPS.md`](../plans/PORTAL-BACKEND-GAPS.md).

### 5.3 Breadcrumb (chuẩn)

`Tổ chức / {tenantName} / Sự kiện / {eventName} / {Job}`  
Ant Design `Breadcrumb` + link permission-aware (href vẫn mang `tenantId`/`eventId`).

---

## 6. Wireframe text (shell + màn chính)

### 6.1 Shell portal

```text
┌─ Header ─────────────────────────────────────────────────────┐
│ [Vemoki mark] Portal    Org ▾ Acme    Event ▾ Demo Night     │
│                              [Tài khoản ▾]                   │
├─ Sider ──────────┬─ Content ─────────────────────────────────┤
│ Tổng quan        │ Breadcrumb                                │
│ Sự kiện          │ PageHeader: title + primary actions       │
│ Thành viên       │ ┌ Alert offline / suspended / stale ┐     │
│ ────────         │ │ Table | Form | Steps | Descriptions │   │
│ (trong event)    │ │ Drawer chi tiết · Modal confirm     │   │
│  Tổng quan       │ └─────────────────────────────────────┘   │
│  Chuẩn bị        │                                           │
│  Khách & mã      │                                           │
│  Cổng            │                                           │
│  Hỗ trợ          │                                           │
└──────────────────┴───────────────────────────────────────────┘
```

### 6.2 Org overview

```text
PageHeader: {tenantName}
Row: Statistic (số sự kiện · thành viên) — chỉ số đã có API; thiếu → ẩn hoặc «—»
Table «Sự kiện gần đây» → click vào workspace
Empty: «Chưa có sự kiện» + CTA Tạo sự kiện (nếu event.create)
```

### 6.3 Event list + wizard

```text
List: ProTable/Table — cột tên, slug, trạng thái nội dung/business, cập nhật
CTA: Tạo sự kiện → Steps: (1) Tên+slug (2) Lịch/timezone (3) Xác nhận
Không bắt user paste tenant UUID nếu đã chọn Org context
```

### 6.4 Event overview / readiness

```text
Descriptions: tên · slug · visibility · cửa sổ redeem/check-in (nếu có)
Card «Sẵn sàng xuất bản»: checklist ReadinessKey (giữ logic deriveAdminReadiness)
Primary Publish disabled + Tooltip lý do khi chưa OK
Unknown timeout ≠ tick xanh
```

### 6.5 Khách & mã

```text
Tabs hoặc anchor: Import | Duyệt | (Thông báo nếu permission)
Import: Upload/Dragger → preview table → commit (async Progress)
Duyệt: Table pending + Drawer chi tiết + Approve/Deny Modal
```

### 6.6 Cổng (report)

```text
Chỉ render khi server cấp report.read (ẩn toàn bộ nav nếu thiếu)
Statistic / Descriptions từ event report BFF
CTA deep-link «Mở cổng quét» → app.vemoki.com/gate (nếu G1) — cho actor có quyền Gate, không gắn với report
Empty rejects / unknown report → Surface `unknown` + Thử lại
```

### 6.7 Hỗ trợ

```text
Search Input → Table kết quả → Drawer timeline + Resend (cooldown)
Export: tạo job → Progress → Download khi READY
Permission-denied: Result, không lộ PII
```

---

## 7. Screen inventory — existing vs proposal

| # | Màn / capability | Existing (apps/web) | Proposal portal | Ghi chú |
| --- | --- | --- | --- | --- |
| S1 | Admin entry + authz | `/admin` + capability gate | `/` + org picker trên `portal.` | Soft-redirect O02 giữ |
| S2 | Tenant selector | Select UUID/list MeTenants | Switcher **nhãn** name/slug; route `tenantId` | Không bịa slug URL API |
| S3 | Event list/create | Panel trong job setup | `/t/…/events` + `/new` Steps | |
| S4 | Event metadata / lifecycle | setup panel | `…/setup` Form + destructive Modal | clone/cancel/archive |
| S5 | Ticket types & sources | setup | `…/setup` section / Drawer | BE: list types/sources = G-T1 |
| S6 | Config / brand / publish | panels + readiness | `…/setup` + overview readiness | white-label không regress |
| S7 | Import codes | `import-panel` | `…/guests` Import | async; lệch job = G-I1 |
| S8 | Approve/deny redemption | guests panel | `…/guests` Table+Drawer | idempotency unclear |
| S9 | Notifications / reminders | `notifications-panel` | `…/guests` hoặc sub-route | permission filter |
| S10 | Event report | gate panel | `…/gate` **nếu `report.read`** | ≠ scan; ≠ Scanner mặc định |
| S11 | CS search / resend | support panel | `…/support` | **Parity cutover bắt buộc** |
| S12 | Export CSV | support | `…/support` job Progress | **Parity cutover bắt buộc** |
| S13 | Tenant staff/members | `tenant-staff` | `…/members` | **Parity**; list API = G-M* |
| S14 | Platform console | `/platform` | **Ngoài portal** (P1) | |
| S15 | Web Gate scan | `/gate` trên app | **Không** chuyển mặc định (G1) | |
| S16 | Org overview | thiếu / mỏng | `/t/[tenantId]` **mới** | Metric chỉ khi API có; multi-event dash = G-D1 OUT |

---

## 8. Design tokens thương hiệu → Ant Design

Map đề xuất `ConfigProvider.theme.token` (coding sau duyệt):

| Vemoki | Ant Design token gợi ý |
| --- | --- |
| `ink` `#22241f` | `colorText` |
| `paper` `#f7f6f1` | `colorBgLayout` / `colorBgContainer` (tinh chỉnh contrast AA) |
| `signal` `#9b3a18` | `colorPrimary` (không dùng blue Ant mặc định làm primary) |
| `focus` `#235fd0` | `colorInfo` + focus ring / `controlOutline` |
| Typography | Font stack brand hiện có trên web — **không** Inter mặc định AI |

`algorithm` light only cho portal MVP; `motion: false` khi `prefers-reduced-motion` (docs Customize Theme — Disable Motion).

---

## 9. State matrix (bắt buộc mọi màn portal)

Mở rộng `SurfaceState` + antd `Result`/`Empty`/`Spin`/`Alert`:

| State | Khi nào | UI / copy VI gợi ý |
| --- | --- | --- |
| `loading` | Fetch danh sách/detail | Spin + «Đang tải…» · `aria-busy` |
| `empty` | List 0 | Empty + CTA nếu có quyền |
| `ready` | Có dữ liệu | Table/Form bình thường |
| `error` | 4xx/5xx deterministic | Alert + Thử lại |
| `unknown` | Timeout / body không parse / unclear | «Chưa rõ kết quả» + Kiểm tra lại — **không** tick xanh |
| `permission-denied` | 403 / thiếu capability | Result 403 · ẩn mutation |
| `stale` | version/config lệch · form cũ | Banner «Dữ liệu đã đổi» + Tải lại |
| `offline` | `navigator.onLine` false | Alert (giữ admin offline banner) |
| `async-running` | import/export/publish poll | Progress · Drawer job · disable double-submit |
| `async-failed` | job FAILED | error + retry nếu idempotent an toàn |
| `suspended` | tenant SUSPENDED | Banner fail-closed |

### 9.1 Async jobs & bulk & destructive

| Pattern | AntD | Quy tắc |
| --- | --- | --- |
| Async job | `Progress` + `Notification`/`Message` | Poll như `poll-operation`; unknown ≠ success |
| Bulk (multi approve/deny) | Table rowSelection + Modal | Chỉ khi API bulk tồn tại — **gap** nếu chỉ single |
| Destructive (cancel/archive/delete) | `Modal.confirm` + gõ tên/slug xác nhận khi impact cao | Giữ impact-preview trước cancel nếu API có |
| Publish | Primary + Popconfirm khi checklist vừa đủ | Publish disabled khi readiness fail |

---

## 10. i18n & a11y

### 10.1 i18n

- UI portal **VI trước** (khớp board/product).
- Ant Design `ConfigProvider` `locale` — dùng pack `vi_VN` khi coding (docs i18n antd).
- Không lộ Nest/BFF/UUID trên chrome khách nội bộ staff trừ Drawer kỹ thuật.

### 10.2 A11y (WCAG 2.2 AA mục tiêu)

Checklist tối thiểu (role PD):

- Contrast token ink/paper/signal/focus đã đo lại trên theme antd
- Focus visible keyboard toàn Menu/Table/Drawer/Modal
- Hit target ≥ 44px khu vực touch (tablet ops)
- Label Form + lỗi `aria-describedby` / `role="alert"`
- Live region cho `unknown` / job hoàn tất (assertive khi fail-closed)
- `prefers-reduced-motion`
- Skip link tới content

Đo: axe/Playwright headless trên portal routes sau khi có UI — prototype HTML (nếu làm) không claim đạt chuẩn.

---

## 11. API / contract gaps (neo BE — không bịa)

Nguồn chuẩn: [`docs/plans/PORTAL-BACKEND-GAPS.md`](../plans/PORTAL-BACKEND-GAPS.md) (IDs G-\* / H-\*). PD **không** invent endpoint; UI giảm nhập tay UUID bằng **context đã chọn** + nhãn discovery, route vẫn `tenantId`/`eventId`.

| Nhu cầu UX | Hiện có / hướng UI | Gap BE (ID) / ghi chú |
| --- | --- | --- |
| Org / event switcher | `GET /me/tenants`, events list — hiện name/slug | Không cần slug-resolve API; **không** đề xuất deep-link slug admin mặc định |
| Members list / invites / role | BFF kỳ vọng list; UI Table | **G-M1…G-M4** / **H-M\*** — lệch OpenAPI |
| Import multi-step / invitations list | BFF/CTR vượt sync `POST …/imports` | **G-I1**, **G-I2** |
| List ticket-types / sources | Chỉ POST trên OpenAPI | **G-T1** |
| Pending filter nâng cao / BFF wire | API list PENDING có | **G-R1**, **G-R2** |
| Exports history | get-by-id | **G-E1** |
| Notification filter | cursor only | **G-N1** |
| Codes inventory browse | không list codes | **G-C1** — không raw code |
| Staff audit browser | write-only nhiều nơi | **G-A1** |
| Org multi-event dashboard | report một event | **G-D1** — business OUT O12/O14; overview chỉ list events |
| Bulk approve/deny | Single decide | Không fake bulk N lần ẩn; chỉ sau contract bulk (chưa có ID BE) |
| Portal OIDC redirect | Keycloak clients + host-only cookie | Architect cutover URI `portal.` — **khác** share BFF cookie |
| Permission discovery | MeTenants + MeEvents (O02) | Client chỉ đọc allowlist; `report.read` cho nav Cổng |

Tenant/auth/RLS/quota/check-in invariants **không** đổi vì redesign UI.

---

## 12. Roadmap đề xuất (sau duyệt — không code trong Task này)

**Parity cutover:** trước khi tuyên bố portal thay `/admin` hoặc redirect cutover, portal phải có **đủ** capability hiện có trên admin workbench liên quan tenant staff — gồm tối thiểu **CS lookup/resend, export, members/staff, guests/import/approve, setup/publish, report (theo `report.read`)** tương đương existing. Wave nội bộ (W1…W4) được sắp thứ tự implement; **không** gọi «portal đủ / cutover» nếu bỏ CS/export/members.

| Wave | Việc | Owner gợi ý | Phụ thuộc |
| --- | --- | --- | --- |
| W0 | ADR cutover `portal.` + Gate G1/G2/G3 + Platform P1/P2/P3 + packaging N1/N2 | architect + coordinator | Host+antd **đã** confirmed |
| W1 | Next host-aware + AntdRegistry + theme + shell Layout/Menu (id routes) | web | W0 |
| W2 | Migrate S3–S6 (events/setup/readiness) | web | W1 · O02 |
| W3 | Guests import/approve + async job chrome | web | W2 · gap G-I* nếu cần |
| W4 | **CS + export + members** (+ đóng G-M* / G-E* cần cho parity) | web (+ BE theo gap) | W2 — **bắt buộc trước cutover** |
| W5 | Dual-run redirect `/admin` → portal; deprecate admin trên app | web + coordinator | **W2+W3+W4 parity** |
| W6 | UAT headless portal + DoD exact SHA | web + reviewer-dod | W5 |

Non-goals giữ: Android, payment, refund, transfer, seat, Wallet, IdP ngoài Keycloak / billing / custom-domain — không tự mở.

---

## 13. Ba màn ưu tiên design-review (sau mở coding — không làm trong Task này)

Thứ tự **review thiết kế / implement sớm** (không phải danh sách cutover đủ). Task hiện tại **không** tạo prototype/Figma.

| # | Màn | Lý do |
| --- | --- | --- |
| **P1** | Shell portal + Org/Event switcher + permission-aware sider | Chrome, breadcrumb, deny-by-default; nav Cổng chỉ với `report.read` |
| **P2** | Event list + Steps wizard tạo sự kiện | Context `tenantId`; giảm paste UUID |
| **P3** | Event overview readiness + Publish gate | Khớp D11 AC-M1…M3; unknown/stale |

**Vẫn bắt buộc trước cutover (không «out of scope sản phẩm»):** guests đầy đủ, **CS**, **export**, **members** — chỉ xếp wave sau P1–P3 trong lộ trình nội bộ (§12). Platform vẫn ngoài portal (P1 boundary).

AC khi coding (quan sát được):

- P1: ẩn menu thiếu perm (kể cả report); Result khi deep-link denied
- P2: tạo event trong org đã chọn — không bắt paste `tenantId`
- P3: Publish disabled khi checklist thiếu; timeout = unknown

UAT sau coding: `scripts/web-uat.sh` trên host portal (khi có).

---

## 14. Handoff triển khai (khi được mở coding)

| Mục | Hướng dẫn |
| --- | --- |
| Ownership UI | `web` (`apps/web`) — không trộn ios/BE trừ contract gap |
| Stack | `antd` (+ optional `@ant-design/pro-components` chọn lọc) + `@ant-design/nextjs-registry` |
| Không | Umi / Ant Design Pro scaffold bắt buộc |
| State | Map §9; reuse copy fail-closed D11 |
| Tokens | §8 + `brand/vemoki/tokens.json` |
| Nav | O02 — server allowlist only; `report.read` ≠ `gate.confirm` |
| Routes | `tenantId` / `eventId` params — không mặc định slug URL |
| Auth | Keycloak OIDC per-host callback; **không** share BFF cookie |
| Host | ADR cutover W0 (scope host đã confirmed) |
| API gaps | Neo [`PORTAL-BACKEND-GAPS.md`](../plans/PORTAL-BACKEND-GAPS.md) |
| Cutover «đủ» | Parity **CS + export + members + guests + setup + report(perm)** — không chỉ P1–P3 |

### 14.1 DoD role PD (Task này)

| # | Mục | Artifact |
| --- | --- | --- |
| 1 | User flow | §2 |
| 2 | State UI | §9 |
| 3 | A11y | §10 |
| 4 | UI AC / ưu tiên design-review | §13 |
| 5 | Handoff implement | §11–§12, §14 |

---

## 15. Quyết định còn chờ (architect / coordinator — không hỏi lại host staff)

**Đã chốt bởi user:** `portal.vemoki.com` + Ant Design cho staff admin.

Còn chốt trước coding rộng:

1. **Gate:** G1 (khuyến nghị scan) / G2 / G3?
2. **Platform:** P1 (khuyến nghị) / P2 / P3?
3. **Packaging:** N1 host-aware vs N2 app riêng?
4. **ProComponents:** antd thuần wave 1, hay ProTable/ProForm ngay W1?
5. **Thứ tự đóng gap BE** (G-M\* / G-I\*…) theo `PORTAL-BACKEND-GAPS.md` vs UI-only trước

PD **không** chuyển quyền Gate scan / Platform mặc định. Coding portal theo Task Spec `web` sau các mục trên.

---

## 16. Tóm tắt executive

Portal staff Ant Design trên `portal.vemoki.com` là **yêu cầu đã confirmed** (không hỏi lại giữ admin trên `app.`): IA job D11 trong shell antd, route theo `tenantId`/`eventId`, nav `report.read` nghiêm ngặt, Keycloak IdP tách biệt share BFF cookie. Cutover chỉ khi parity đủ CS/export/members/guests/setup — wave nội bộ được, nhưng thiếu CS/export thì chưa «portal đủ». Còn ADR Gate/Platform/packaging + đóng gap theo `PORTAL-BACKEND-GAPS.md`; artifact chỉ discovery/design.
