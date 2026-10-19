# Portal P2 — IA / UX handoff (Ant Design)

| Trường | Giá trị |
| --- | --- |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../agents/roles/product-design.md) |
| Tracking | Issue **#500** · Story **#493** · Epic **#491** · Run `run_d04055a8969b` |
| Ownership | **Chỉ** `docs/design/PORTAL-P2-UX.md` — không sửa `apps/**` |
| Ngày | 2026-10-19 |
| Baseline shell | [`PORTAL-ANTD-UX.md`](./PORTAL-ANTD-UX.md) (P0/P1 IA) · tokens [`brand/vemoki/tokens.json`](../../brand/vemoki/tokens.json) v2 Live Pulse |
| Product research | [`PORTAL-PRODUCT-RESEARCH.md`](../plans/PORTAL-PRODUCT-RESEARCH.md) §11 Wave 3 |
| BA (merged) | [`PORTAL-P2-BA.md`](../plans/PORTAL-P2-BA.md) (#499) — JTBD/AC; path UI & PENDING policy theo PD+ADR khi lệch (xem §8.5) |
| ADR (merged) | [`PORTAL-P2-ADR.md`](../architecture/PORTAL-P2-ADR.md) — merge ~`28314293` / `origin/main` · Decision Log **O17** |
| Decisions | O12/O14 multi-event **OUT** → **O17** reopen portfolio (không revenue BI) |
| Architecture impact | **Có** — portfolio contract, i18n locale pack, role presets (`P2-ROLES-PRESET`), PENDING self-serve (`P2-ONBOARD-PENDING`) |
| Visual budget | **Có** (portal P2 surfaces trên shell AntD đã chốt) |
| Trạng thái | **PD handoff khớp ADR** — sẵn sàng reval DoD; **không** claim pilot / cutover / deploy |

**IN:** IA + wireframe text + state/a11y/AC cho năm candidate P2 trên `portal.vemoki.com` (Ant Design).  
**OUT:** coding `apps/**`; mock auth/UAT; EAS; cutover prod (chỉ Issue **#502**); Android / payment / SSO enterprise / billing / custom-domain (O10); **permission checkbox matrix** (ADR loại); **auto-ACTIVE** self-serve (ADR loại).

**Reconcile:** BA #499 + ADR #501 đã merge trên `main`. PD khóa IA/path/UI policy theo ADR khi xung đột BA (slug analytics, onboarding ACTIVE, custom-role composer) — chi tiết §8.5.

---

## 0. Brand / visual budget

Gói art direction **trong** handoff này. Implementer không invent visual ngoài khối; thiếu token → escalate coordinator.

| Hạng mục | Nội dung |
| --- | --- |
| Tokens | Nguồn: `brand/vemoki/tokens.json` v2 — `ink` `#0B1220`, `paper` `#F4F6F8`, `signal` `#E11D48`, `focus` `#2563EB`. Map AntD: `colorText`←ink, `colorBgLayout`/`colorBgContainer`←paper, `colorPrimary`←signal, `colorInfo`/focus ring←focus. **Không** AntD blue mặc định làm primary. |
| Typography | Display **Sora** · Body **Be Vietnam Pro**. **Cấm** Inter / Roboto / Arial / system-only hero trên màn marketing-onboarding; portal chrome AntD dùng stack brand qua `ConfigProvider` / CSS variables — không fallback Inter. |
| Surfaces | Portal = light only. Atmosphere: paper nền + subtle ink/10 separators; org Analytics dùng Statistic/Row thoáng, **không** flat white-only card cluster. Self-serve onboarding (nếu public): gradient/texture nhẹ từ Live Pulse — không purple AI-default. |
| Anti-patterns | (1) Purple-on-white / indigo glow. (2) Card cluster hero / badge overlay. (3) Warm-cream + terracotta “AI brochure”. (4) Pill spam / stat strip cạnh KPI fail-closed. (5) Invent metric chart library ngoài AntD Charts **không** được BA/ADR duyệt. (6) Role builder “permission matrix 50×50” / checkbox quyền tùy ý — **non-goal P2** (`P2-ROLES-PRESET`). |
| Motion | (1) Locale switch: soft fade content 150–200ms. (2) Saved-view apply: Table row highlight pulse 1×. (3) Onboarding step advance: Steps progress. Luôn tôn `prefers-reduced-motion` → `motion: false` AntD. |
| Priority screens (3–5) | **PS1** Org multi-event Analytics · **PS2** Saved views (+ automation stub) · **PS3** Locale EN/VI · **PS4** Role presets · **PS5** Self-serve onboarding (PENDING) |
| Freeze | *Implementer không invent visual ngoài khối này; thiếu token hoặc metric ngoài dictionary O12 → escalate coordinator / BA.* |

---

## 1. User flow

### 1.1 Personas (P2)

| Persona | Việc P2 | Không làm |
| --- | --- | --- |
| Tenant **Owner** | Portfolio Analytics đa event; saved views org; chọn **role preset** khi invite; (tuỳ) khởi tạo self-serve → chờ Operator ACTIVE | Platform Operator; Gate scan; tick permission tùy ý |
| **Manager** | Saved views event-scoped; dùng Analytics nếu `report.read` + assignment | Sửa role-map / invent preset |
| **CS** | Locale EN khi cần; **không** portfolio BI nếu thiếu assignment | Custom checkbox roles; automation destructive |
| **Scanner / Supervisor** | Không mở P2 Analytics/roles (O02) | — |
| **Lead / Owner mới** (self-serve) | Đăng ký → tenant **PENDING** → chờ Operator ACTIVE → checklist first-run | Auto-ACTIVE / bypass Operator (`P2-ONBOARD-PENDING`) |

### 1.2 Flow chính theo candidate

```text
PS1 Multi-event Analytics
  Login portal → Org context → nav «Phân tích» (chỉ khi có ≥1 event assign `report.read`)
    → GET /v1/tenants/{tenantId}/reports/portfolio (ADR — không dùng tên report-summary)
    → Portfolio table: chỉ events trong `items[]` (đã filter assignment server) × KPI O12 + asOf
    → Click hàng → deep-link Event overview / gate report (event-scoped)
    → Refresh thủ công (pilot) — không poll marketing “realtime”
    → Event thiếu assignment: **không** hiện hàng (không 403 từng event; không vẽ unknown)

PS2 Saved views / automation
  List Guests|Pending|Members|Exports → Toolbar «View ▾»
    → P2a: prefs local/portal (userId+tenantId) — filter/sort/columns allowlist
    → «Lưu view» (tên + phạm vi) · «Đặt mặc định» — persist local đến khi P2b
    → P2b (sau contract): server share/automation stub
      — Drawer disabled + copy “sắp có” nếu chưa có OpenAPI saved-views

PS3 Portal EN
  Header Tài khoản ▾ → Ngôn ngữ: Tiếng Việt | English
    → Persist preference (cookie/local + optional profile field khi có API)
    → ConfigProvider locale antd vi_VN | en_US + message catalog portal

PS4 Role presets (P2-ROLES-PRESET)
  Org → Thành viên → tab «Vai trò»
    → List role-map MVP + **named server presets** (versioned role-map)
    → Tạo/gán: chọn preset từ catalog server (Select / Radio) — **không** checkbox permission
    → Gán member → PATCH role (G-M3/H-M4) · last-Owner guard
    → Deny-by-default: permission ngoài preset server = không hiện / reject API

PS5 Self-serve onboarding (P2-ONBOARD-PENDING)
  Marketing «Đăng ký quan tâm» (O13) → confirmation
    → (Khi được duyệt) signup → tenant status PENDING + Owner pending
    → UI «Đang chờ kích hoạt» — **không** mutation admin như ACTIVE
    → Sau Operator ACTIVE → portal first-run checklist:
         (1) Hồ sơ org  (2) Mời Manager (preset)  (3) Tạo event DRAFT  (4) Readiness
    → Empty org ACTIVE: Progressive Steps — không dump full admin
```

### 1.3 Nhánh lỗi / hủy / hết quyền

| Nhánh | UI |
| --- | --- |
| Không có event nào assign `report.read` | Ẩn nav Phân tích **hoặc** Empty «Chưa có sự kiện được gán quyền báo cáo»; deep-link → Result 403 |
| Event thiếu assignment | **Ẩn** khỏi bảng — không hàng, không Tooltip lỗi, không `unknown` (server đã filter `items`) |
| Fetch portfolio lỗi / partial parse một hàng | Hàng (nếu có id trong response lỗi) = `unknown`/`—` + Tooltip **lỗi tải**; Alert trang — **không** bịa 0; **không** nhầm với “ẩn vì thiếu assignment” |
| Saved view filter field đã deprecate | Banner stale + «Đặt lại view» |
| Locale pack thiếu key | Fallback VI + log missing (dev); không hiện raw key cho staff |
| Preset ngoài catalog / last Owner | Modal lỗi ổn định + không silent strip |
| Self-serve PENDING / từ chối | Result «Đang chờ kích hoạt» + contact — **không** fake ACTIVE |
| Membership revoked giữa session | Soft landing O02 |

### 1.4 Touch map

| Việc | `portal.` | `app.` | Marketing | iOS |
| --- | --- | --- | --- | --- |
| Multi-event Analytics | **Primary** | Không | — | Không |
| Saved views staff lists | Primary | Legacy admin dual-run | — | — |
| EN locale portal | Primary | Attendee i18n riêng (không gộp) | VI+EN O13 | — |
| Role presets | Primary (`/members`) | Legacy staff panel | — | — |
| Self-serve lead | PENDING wait → first-run **sau** Operator ACTIVE | — | Form quan tâm | — |

---

## 2. Information architecture (delta trên P0/P1)

Baseline routes: [`PORTAL-ANTD-UX.md`](./PORTAL-ANTD-UX.md) §5. P2 **thêm** (id-params):

```text
portal.vemoki.com
  /t/[tenantId]/analytics              → PS1 multi-event portfolio (NEW) · path PD chốt
  /t/[tenantId]/members                 → + tab Vai trò (PS4 presets)
  /t/[tenantId]/members/roles[/new|:id] → preset detail / assign (optional nested; không permission matrix)
  /t/[tenantId]/e/[eventId]/guests     → + Saved views toolbar (PS2)
  /t/[tenantId]/e/[eventId]/…          → cùng pattern toolbar trên list có filter
  /onboarding[/… ]                       → PS5 PENDING wait + first-run sau ACTIVE
```

**Path chốt:** `/t/[tenantId]/analytics`. BA AC-A1 gợi ý `/org/{slug}/analytics` — **chỉ gợi ý**; implementer **không** dùng slug BA làm nguồn route.

**Menu org-level (permission-aware):**

| Item | Điều kiện hiện |
| --- | --- |
| Tổng quan | membership |
| Sự kiện | `event.list` / discovery |
| **Phân tích** | **P2** — actor có ≥1 event với `report.read` + assignment (`P2-AUTHZ-ASSIGNMENT`); không tin role name client |
| Thành viên | `members.manage` |
| (Event subtree) | như P0/P1 |

Breadcrumb: `Tổ chức / {tenant} / Phân tích` · `… / Thành viên / Vai trò / {presetName}`.

---

## 3. Wireframe text (priority screens)

### 3.1 PS1 — Org multi-event Analytics

**Contract (ADR `P2-PORTFOLIO-REOPEN` / §4.3):**  
`GET /v1/tenants/{tenantId}/reports/portfolio?cursor=&limit=` — tái dùng dictionary O12; **cấm** tên consumer `report-summary` / G-D1 legacy slug. Giữ event-scoped `GET …/events/{e}/report` cho deep-link.

```text
PageHeader: Phân tích · Tag asOf «Server ghi nhận {asOf}» · Button «Làm mới»
Alert (nếu partial fetch): «Một số sự kiện chưa tải được — không dùng số 0 giả.»
  (Chỉ khi response/parse lỗi — không dùng Alert này cho event bị ẩn vì thiếu assignment)

Filters (optional P2.1): trạng thái nội dung · cửa sổ thời gian (chỉ field API có)
Table (cursor) — chỉ `items[]` từ portfolio:
  | Sự kiện | Trạng thái | Check-in (O12) | Pending | Email cần CS | Quota còn | Cập nhật |
  click row → /t/…/e/[eventId] (overview) hoặc …/gate nếu chỉ cần report

Empty (items=[], membership OK): «Chưa có sự kiện được gán quyền báo cáo» (+ CTA events nếu event.list)
Denied (thiếu membership / không đủ quyền org): Result 403
```

**Phân biệt hàng:**

| Tình huống | UI |
| --- | --- |
| Không có trong `items` (thiếu `report.read` assignment) | Không render hàng — **không** `unknown`, không Tooltip lỗi |
| Có trong `items` nhưng field lỗi / timeout partial | Hàng `—` / `unknown` + Tooltip «Không tải được» + Alert trang |
| Có data O12 | Số counts; **không** bịa 0 khi unknown |

**Dictionary bắt buộc (O12 — không invent BI):** check-in = Gate confirm APPLIED; email KPI = cần CS; watermark + refresh thủ công pilot. **Không** revenue/UTM/seat/Wallet.

### 3.2 PS2 — Saved views

```text
[List toolbar]
  View ▾  [Mặc định · Đang duyệt · …]   [Lưu view…]   [⋯ Quản lý]
Chip filters hiện tại (source / state / …) — chỉ key trong allowlist server

P2a (P2-VIEWS-PHASED — mặc định P2):
  Persist local/portal prefs (userId+tenantId); không Nest bắt buộc
  Modal Lưu view: Tên * · Phạm vi: Sự kiện này | Tổ chức · Đặt làm mặc định □

P2b (chỉ khi có contract saved-views):
  Server share / automation stub
  Drawer «Quy tắc» list disabled hoặc empty + link ADR
  Không gửi email khách từ automation MVP; chỉ tín hiệu nội bộ nếu contract có
```

### 3.3 PS3 — Locale EN

```text
Header · Tài khoản ▾
  ├ Ngôn ngữ
  │    ● Tiếng Việt
  │    ○ English
  └ Đăng xuất

Sau đổi: toàn chrome AntD + portal strings theo locale; giữ tenant/event name gốc.
Deep-link/email staff: không đổi host; copy email template = worker/BE riêng (ngoài PD UI).
```

### 3.4 PS4 — Role presets (`P2-ROLES-PRESET`)

```text
Thành viên · Tabs: Người dùng | Lời mời | Vai trò

Vai trò:
  Table: Tên · Loại (Hệ thống|Preset) · Số người · schema_version · Cập nhật
  CTA: Gán / chọn preset (nếu policy cho phép) — không «Tạo quyền tùy ý»

Editor / assign (P2):
  Form: chọn **named server preset** (Select) + mô tả read-only từ server
  Alert: «Quyền do máy chủ định nghĩa theo preset; không chỉnh từng quyền trên portal.»
  Footer: Hủy · Lưu · (Danger) gỡ gán nếu không còn member

Gán: trong Người dùng · Select vai trò (system + preset id)
```

**Non-goal P2:** UI checkbox / matrix permission tùy ý (ADR phương án B loại). Composer tick catalog BA AC-D1 = **ngoài P2** trừ khi coordinator mở lại scope + ADR mới.

**MVP floor:** UI rõ cho role-map cố định (Owner/Manager/CS/Supervisor/Scanner) + preset picker khi BE ship `role_presets` — đủ PS4 P2.

### 3.5 PS5 — Self-serve onboarding (`P2-ONBOARD-PENDING`)

```text
PENDING (sau signup / trước Operator ACTIVE):
  Result «Đăng ký đã gửi — đang chờ kích hoạt»
  Không expose admin mutation; không first-run Steps ACTIVE

First-run (Owner, org đã ACTIVE bởi Operator):
  Steps ngang: Tổ chức → Đội ngũ → Sự kiện đầu → Sẵn sàng
  Step 1: tên hiển thị / timezone mặc định (field API có)
  Step 2: mời 1 Manager (email + preset) — reuse invite members
  Step 3: CTA «Tạo sự kiện» → wizard P0 Steps
  Step 4: readiness checklist + deep-link setup
```

**Thắng BA nếu xung đột:** BA AC-E1 / J-P2-6 gợi ý ACTIVE ngay + checklist — **không** là nguồn UI onboarding P2. PD + ADR: tenant `PENDING`; ACTIVE chỉ Operator. Coordinator cắt scope mới được đổi.

---

## 4. Trạng thái giao diện

Áp dụng matrix P0 ([`PORTAL-ANTD-UX.md`](./PORTAL-ANTD-UX.md) §9) + bổ sung P2:

| State | Khi nào | UI / copy gợi ý |
| --- | --- | --- |
| `loading` | Fetch portfolio / views / presets | Spin · `aria-busy` |
| `empty` | `items=[]` (không event được gán) / 0 saved view | Empty + CTA có điều kiện quyền — **không** diễn giải là lỗi mạng |
| `ready` | Có dữ liệu | Table/Form |
| `error` | 4xx/5xx rõ toàn trang / request fail | Alert + Thử lại |
| `unknown` | Timeout / partial parse **trên hàng đã có trong response** | «Chưa rõ» + Kiểm tra lại — **không** tick xanh / không ép 0; **không** dùng cho event bị ẩn assignment |
| `hidden-unassigned` | Event thiếu `report.read` assignment | Không hàng UI (server omit) — phân biệt với `unknown`/`error` |
| `permission-denied` | 403 Analytics (không membership / không đủ quyền mở trang) | Result 403 |
| `stale` | View filter field đổi · locale pack lệch version | Banner + Tải lại / Đặt lại view |
| `partial` | **P2** một phần hàng portfolio **fetch** lỗi | Hàng `—` + Tooltip lỗi tải; Alert trang |
| `async-running` | Lưu view / gán preset / invite onboarding | Disable double-submit · Progress |
| `pending-activation` | **P2** self-serve chờ Operator ACTIVE | Result chờ — không fake ACTIVE |
| `suspended` | tenant SUSPENDED | Banner fail-closed (giữ) |

---

## 5. Accessibility (WCAG 2.2 AA mục tiêu)

| Hạng mục | Yêu cầu P2 |
| --- | --- |
| Contrast | ink/paper/signal/focus trên Statistic/Table; signal không dùng làm text nhỏ trên paper nếu fail AA |
| Keyboard | Menu Phân tích, View ▾, Preset Select, Steps onboarding — focus visible |
| Hit target | ≥44px toolbar View / locale trên tablet |
| Labels | Mọi Filter/Select có `<label>` / `aria-label`; lỗi `role="alert"` |
| Live regions | Portfolio refresh xong · job preset save fail — polite/assertive đúng mức |
| i18n a11y | `lang` trên `<html>` đổi theo locale; AntD locale pack khớp |
| Motion | `prefers-reduced-motion` |
| Manual vs auto | axe trên `/analytics`, `/members` roles, locale switch = automated; dictionary O12 honesty + last-Owner + hidden-vs-error = manual/UAT |

---

## 6. Tiêu chí nghiệm thu UI (quan sát được)

### AC-PS1 Multi-event Analytics

- **Given** Owner có `report.read` (+ assignment) trên ≥1 event, **When** mở `/t/{tenantId}/analytics`, **Then** gọi `GET …/reports/portfolio` và thấy bảng chỉ events trong `items` với KPI dictionary O12 và `asOf` (hoặc unknown trên hàng lỗi fetch) — không revenue; **không** gọi/đặt tên `report-summary`.
- **Given** thiếu membership / không đủ quyền mở trang, **When** deep-link Analytics, **Then** Result 403 và không lộ data.
- **Given** event B không assign `report.read`, **When** tải portfolio, **Then** B **không** xuất hiện trong bảng (không hàng `unknown`, không 403 từng event).
- **Given** một item trong response lỗi parse/timeout, **When** các item khác OK, **Then** hàng lỗi = unknown/`—` + Tooltip lỗi tải — phân biệt empty/hidden.
- Evidence: headless `scripts/web-uat.sh` (khi có UI) + fixture perm matrix.

### AC-PS2 Saved views

- **Given** Manager trên Guests (P2a), **When** lưu view với filter allowlist, **Then** reload trang áp lại đúng filter từ local/portal prefs.
- **Given** field filter bị gỡ khỏi API, **When** mở view cũ, **Then** banner stale — không crash.
- **Given** chưa có contract P2b, **When** mở automation Drawer, **Then** disabled / “sắp có” — không gửi email attendee.
- Automation rules: **không** gửi email attendee trong MVP P2 trừ BA/ADR mở **và** có contract.

### AC-PS3 EN locale

- **Given** user chọn English, **When** mở Org overview + Analytics chrome, **Then** AntD + portal strings EN; `document.documentElement.lang=en`.
- **Given** VI, **When** switch lại, **Then** không mất org/event context.

### AC-PS4 Role presets

- **Given** Owner, **When** gán member một **named server preset** trong catalog, **Then** invite/assign thành công theo API; UI không có checkbox permission tùy ý.
- **Given** cố gửi permission array tùy ý (tamper), **When** submit, **Then** API/UI deny — không tin client (`P2-ROLES-PRESET`).
- **Given** last Owner, **When** demote/xóa, **Then** lỗi ổn định (H-M4).
- Floor: hiển thị role-map hệ thống rõ + preset picker khi có BE — không ship permission matrix P2.

### AC-PS5 Self-serve onboarding

- **Given** lead hoàn thành signup được duyệt, **When** tenant còn `PENDING`, **Then** UI `pending-activation` — không mutation admin như ACTIVE (`P2-ONBOARD-PENDING`).
- **Given** Operator đã ACTIVE org, **When** Owner vào portal lần đầu, **Then** checklist Steps hoàn thành được không paste UUID.
- **Given** BA AC-E1 mô tả ACTIVE ngay, **When** implement UI P2, **Then** vẫn theo PENDING+Operator — BA không phải nguồn UI đến khi coordinator cắt scope.

Map UAT: web Playwright/`scripts/web-uat.sh` only — **không** computer-use chuột desktop; **không** mock auth.

---

## 7. Hướng dẫn triển khai

| Mục | Hướng dẫn |
| --- | --- |
| Ownership UI | `web` (`apps/portal` theo ADR-20 / P2 packaging) — **không** ios/BE trừ contract |
| Không sửa trong Task PD này | `apps/**` |
| Stack | Ant Design thuần (+ ProTable chọn lọc nếu W1 đã dùng) · `@ant-design/nextjs-registry` |
| Tokens | §0 + `brand/vemoki/tokens.json` |
| Nav / authz | O02 allowlist only; **không** map từ tên role; portfolio filter theo assignment server |
| Routes | `tenantId`/`eventId` — path Analytics PD: `/t/[tenantId]/analytics` |
| Contract phụ thuộc | **`GET /v1/tenants/{tenantId}/reports/portfolio`** (ADR §4.3; O17) — consumer **cấm** `report-summary` / G-D1 legacy name · giữ `GET …/events/{e}/report` · saved-views: P2a local; P2b chỉ sau OpenAPI · i18n message catalog · **role presets** (không checkbox) · self-serve registration → PENDING + Operator ACTIVE |
| Decision Log | **O17** reopen multi-event portfolio; dictionary O12 giữ; revenue BI vẫn OUT |
| Thứ tự implement gợi ý | (1) PS3 locale nếu chỉ chrome — rẻ · (2) PS1 sau portfolio endpoint · (3) PS2 P2a local · (4) PS4 preset picker sau BE role_presets · (5) PS5 PENDING UI + first-run sau ACTIVE |
| Good enough MVP | Analytics counts-only + EN chrome + system role-map + preset picker; permission matrix & automation server = ngoài P2 / P2b |
| Cutover prod | **Không** — chỉ #502 |
| Parity P0/P1 | P2 **không** thay thế yêu cầu CS/export/members trước cutover portal ([`PORTAL-ANTD-UX.md`](./PORTAL-ANTD-UX.md) §12) |

### 7.1 Phụ thuộc song song

| Artifact | Issue | PD dùng thế nào |
| --- | --- | --- |
| `docs/plans/PORTAL-P2-BA.md` | #499 (merged) | JTBD/priority; **lệch path/onboarding/roles → PD+ADR thắng** (§8.5) |
| `docs/architecture/PORTAL-P2-ADR.md` | #501 (merged ~`28314293`) | Contract portfolio, authz, presets, PENDING, views phased — **nguồn khóa P2** |
| Decision Log **O17** | — | Reopen OUT O12/O14 multi-event trong khung portfolio |
| Deploy | #502 | Ngoài scope |

### 7.2 DoD role PD (Task #500)

| # | Mục | Artifact |
| --- | --- | --- |
| 0 | Visual budget | §0 |
| 1 | User flow | §1 |
| 2 | State UI | §4 |
| 3 | A11y | §5 |
| 4 | UI AC | §6 |
| 5 | Handoff implement | §2–§3, §7 |
| — | ADR lock | §8 |

---

## 8. Quyết định đã chốt (khớp ADR — không còn mở P2)

| Mã ADR | Chốt cho PD / implementer |
| --- | --- |
| `P2-AUTHZ-ASSIGNMENT` | Portfolio authz = `report.read` theo **event assignment**. Event không assign → **ẩn** khỏi `items` (không 403 từng hàng; UI không vẽ unknown như lỗi). |
| `P2-PORTFOLIO-REOPEN` + `P2-EVENTREPORT-REUSE` | Endpoint = `GET /v1/tenants/{tenantId}/reports/portfolio`; KPI = dictionary O12; không invent BI; không tên `report-summary`. |
| `P2-VIEWS-PHASED` | **P2a** local/portal prefs; **P2b** server share/automation chỉ khi có contract + BA ưu tiên. |
| `P2-ROLES-PRESET` | Custom roles P2 = **named server presets** (versioned role-map). **Không** checkbox permission tùy ý. |
| `P2-ONBOARD-PENDING` | Self-serve tạo tenant **PENDING**; ACTIVE chỉ Operator — **không** auto-ACTIVE. |
| `P2-LOCALE-ADDITIVE` | Portal EN additive; default VI (O04). |

### 8.5 Reconcile BA (`PORTAL-P2-BA.md`)

| Chủ đề | BA | PD chốt (thắng khi xung đột) |
| --- | --- | --- |
| Analytics path | AC-A1 gợi ý `/org/{slug}/analytics` | **`/t/[tenantId]/analytics`** — slug BA chỉ gợi ý |
| Multi-event contract | `report-summary` đề xuất | **`GET …/reports/portfolio`** theo ADR |
| Event thiếu perm | `rejected`/`hidden` theo ADR | **Hidden** (omit `items`) — không hàng lỗi |
| Custom roles | AC-D1 checkbox catalog | **Preset picker only** P2; checkbox = non-goal đến khi coordinator mở lại |
| Onboarding | AC-E1 / J-P2-6 ACTIVE + checklist | **PENDING + Operator ACTIVE**; first-run Steps chỉ sau ACTIVE — BA không nguồn UI đến khi coordinator cắt scope |

Còn lại ngoài P2 docs: cutover #502; mở coding BE/web theo wave coordinator (không hỏi lại host portal+antd).

---

## 9. Tóm tắt executive

P2 portal trên shell AntD P0/P1 thêm năm surface: **portfolio Analytics** (`GET …/reports/portfolio`, O12 + O17), **saved views P2a local**, **EN locale**, **role presets** (không permission matrix), **self-serve PENDING→Operator ACTIVE**. Visual Live Pulse v2, deny-by-default, phân biệt hàng lỗi fetch vs event ẩn assignment. Architecture khóa theo ADR merge; coding chỉ sau Task web/BE riêng. Cutover production vẫn Issue **#502**; artifact này là handoff PD only.
