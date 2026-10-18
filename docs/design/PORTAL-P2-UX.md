# Portal P2 — IA / UX handoff (Ant Design)

| Trường | Giá trị |
| --- | --- |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../agents/roles/product-design.md) |
| Tracking | Issue **#500** · Story **#493** · Epic **#491** · Run `run_d04055a8969b` |
| Ownership | **Chỉ** `docs/design/PORTAL-P2-UX.md` — không sửa `apps/**` |
| Ngày | 2026-10-19 |
| Baseline shell | [`PORTAL-ANTD-UX.md`](./PORTAL-ANTD-UX.md) (P0/P1 IA) · tokens [`brand/vemoki/tokens.json`](../../brand/vemoki/tokens.json) v2 Live Pulse |
| Product research | [`PORTAL-PRODUCT-RESEARCH.md`](../plans/PORTAL-PRODUCT-RESEARCH.md) §11 Wave 3 |
| BE gaps | [`PORTAL-BACKEND-GAPS.md`](../plans/PORTAL-BACKEND-GAPS.md) **G-D1** · members **G-M\*** |
| Decisions | O12/O14 multi-event **trước đây OUT** — Epic #491 **mở lại discovery** (không tự coding) |
| Architecture impact | **Có** — multi-event summary contract, i18n locale pack, custom role model, self-serve provisioning path |
| Visual budget | **Có** (portal P2 surfaces trên shell AntD đã chốt) |
| Trạng thái | **PD handoff** — song song BA #499 / Architect #501; **không** claim pilot / cutover / deploy |

**IN:** IA + wireframe text + state/a11y/AC cho năm candidate P2 trên `portal.vemoki.com` (Ant Design).  
**OUT:** coding `apps/**`; mock auth/UAT; EAS; cutover prod (chỉ Issue **#502**); Android / payment / SSO enterprise / billing / custom-domain (O10).

**Song song:** BA chốt JTBD/priority → `docs/plans/PORTAL-P2-BA.md` (#499). Architect ADR → Issue #501. PD **không** chờ serial nếu artifact BA chưa có — đánh dấu chỗ cần reconcile AC số liệu.

---

## 0. Brand / visual budget

Gói art direction **trong** handoff này. Implementer không invent visual ngoài khối; thiếu token → escalate coordinator.

| Hạng mục | Nội dung |
| --- | --- |
| Tokens | Nguồn: `brand/vemoki/tokens.json` v2 — `ink` `#0B1220`, `paper` `#F4F6F8`, `signal` `#E11D48`, `focus` `#2563EB`. Map AntD: `colorText`←ink, `colorBgLayout`/`colorBgContainer`←paper, `colorPrimary`←signal, `colorInfo`/focus ring←focus. **Không** AntD blue mặc định làm primary. |
| Typography | Display **Sora** · Body **Be Vietnam Pro**. **Cấm** Inter / Roboto / Arial / system-only hero trên màn marketing-onboarding; portal chrome AntD dùng stack brand qua `ConfigProvider` / CSS variables — không fallback Inter. |
| Surfaces | Portal = light only. Atmosphere: paper nền + subtle ink/10 separators; org Analytics dùng Statistic/Row thoáng, **không** flat white-only card cluster. Self-serve onboarding (nếu public): gradient/texture nhẹ từ Live Pulse — không purple AI-default. |
| Anti-patterns | (1) Purple-on-white / indigo glow. (2) Card cluster hero / badge overlay. (3) Warm-cream + terracotta “AI brochure”. (4) Pill spam / stat strip cạnh KPI fail-closed. (5) Invent metric chart library ngoài AntD Charts **không** được BA/ADR duyệt. (6) Role builder “permission matrix 50×50” không đọc được. |
| Motion | (1) Locale switch: soft fade content 150–200ms. (2) Saved-view apply: Table row highlight pulse 1×. (3) Onboarding step advance: Steps progress. Luôn tôn `prefers-reduced-motion` → `motion: false` AntD. |
| Priority screens (3–5) | **PS1** Org multi-event Analytics · **PS2** Saved views (+ automation stub) · **PS3** Locale EN/VI · **PS4** Custom roles · **PS5** Self-serve onboarding |
| Freeze | *Implementer không invent visual ngoài khối này; thiếu token hoặc metric ngoài dictionary O12 → escalate coordinator / BA.* |

---

## 1. User flow

### 1.1 Personas (P2)

| Persona | Việc P2 | Không làm |
| --- | --- | --- |
| Tenant **Owner** | Portfolio Analytics đa event; saved views org; quản lý custom roles; (tuỳ) khởi tạo self-serve org | Platform Operator; Gate scan |
| **Manager** | Saved views event-scoped; dùng Analytics nếu `report.read` + assignment | Sửa role-map vượt quyền Owner |
| **CS** | Locale EN khi cần; **không** portfolio BI nếu thiếu perm | Custom roles; automation destructive |
| **Scanner / Supervisor** | Không mở P2 Analytics/roles (O02) | — |
| **Lead / Owner mới** (self-serve) | Wizard quan tâm → chờ ACTIVE → checklist first event | Auto-bypass Operator review nếu policy chưa chốt |

### 1.2 Flow chính theo candidate

```text
PS1 Multi-event Analytics
  Login portal → Org context → nav «Phân tích» (chỉ khi perm đủ)
    → Portfolio table (events × KPI O12 counts) + asOf watermark
    → Click hàng → deep-link Event overview / gate report (event-scoped)
    → Refresh thủ công (pilot) — không poll marketing “realtime”

PS2 Saved views / automation
  List Guests|Pending|Members|Exports → Toolbar «View ▾»
    → Chọn view đã lưu (filter/sort/columns trong allowlist)
    → «Lưu view» (tên + phạm vi org|event) · «Đặt mặc định»
    → Automation (P2b): rule stub «Khi pending > N · gửi thông báo nội bộ»
      — chỉ sau contract; UI = Drawer disabled + copy “sắp có” nếu ADR cắt phase

PS3 Portal EN
  Header Tài khoản ▾ → Ngôn ngữ: Tiếng Việt | English
    → Persist preference (cookie/local + optional profile field khi có API)
    → ConfigProvider locale antd vi_VN | en_US + message catalog portal

PS4 Custom roles
  Org → Thành viên → tab «Vai trò»
    → List role-map MVP + custom (nếu được duyệt)
    → Tạo/sửa: tên + allowlist permission **từ catalog server** (checkbox nhóm)
    → Gán member → PATCH role (G-M3/H-M4) · last-Owner guard
    → Deny-by-default: permission không trong catalog = không hiện

PS5 Self-serve onboarding
  Marketing «Đăng ký quan tâm» (O13) → confirmation
    → (Khi được duyệt) magic/invite Owner → portal first-run checklist:
         (1) Hồ sơ org  (2) Mời Manager  (3) Tạo event DRAFT  (4) Readiness
    → Empty org: Progressive Steps — không dump full admin
```

### 1.3 Nhánh lỗi / hủy / hết quyền

| Nhánh | UI |
| --- | --- |
| Thiếu `report.read` / assignment | Ẩn nav Phân tích; deep-link → Result 403 |
| Summary partial (một event fail) | Hàng event = `unknown`/`—` + Tooltip; **không** bịa 0 |
| Saved view filter field đã deprecate | Banner stale + «Đặt lại view» |
| Locale pack thiếu key | Fallback VI + log missing (dev); không hiện raw key cho staff |
| Custom role vượt catalog / last Owner | Modal lỗi ổn định + không silent strip |
| Self-serve bị từ chối / chờ duyệt | Empty «Đang chờ kích hoạt» + contact — không fake ACTIVE |
| Membership revoked giữa session | Soft landing O02 |

### 1.4 Touch map

| Việc | `portal.` | `app.` | Marketing | iOS |
| --- | --- | --- | --- | --- |
| Multi-event Analytics | **Primary** | Không | — | Không |
| Saved views staff lists | Primary | Legacy admin dual-run | — | — |
| EN locale portal | Primary | Attendee i18n riêng (không gộp) | VI+EN O13 | — |
| Custom roles | Primary (`/members`) | Legacy staff panel | — | — |
| Self-serve lead | Portal first-run **sau** ACTIVE | — | Form quan tâm | — |

---

## 2. Information architecture (delta trên P0/P1)

Baseline routes: [`PORTAL-ANTD-UX.md`](./PORTAL-ANTD-UX.md) §5. P2 **thêm** (proposal — id-params):

```text
portal.vemoki.com
  /t/[tenantId]/analytics              → PS1 multi-event portfolio (NEW)
  /t/[tenantId]/members                 → + tab Vai trò (PS4)
  /t/[tenantId]/members/roles[/new|:id] → role editor (optional nested)
  /t/[tenantId]/e/[eventId]/guests     → + Saved views toolbar (PS2)
  /t/[tenantId]/e/[eventId]/…          → cùng pattern toolbar trên list có filter
  /onboarding[/… ]                       → PS5 first-run (sau invite; không public slug giả)
```

**Menu org-level (permission-aware):**

| Item | Điều kiện hiện |
| --- | --- |
| Tổng quan | membership |
| Sự kiện | `event.list` / discovery |
| **Phân tích** | **P2** — `report.read` **và** rule assignment do ADR #501 chốt (không tin role name client) |
| Thành viên | `members.manage` |
| (Event subtree) | như P0/P1 |

Breadcrumb: `Tổ chức / {tenant} / Phân tích` · `… / Thành viên / Vai trò / {roleName}`.

---

## 3. Wireframe text (priority screens)

### 3.1 PS1 — Org multi-event Analytics

```text
PageHeader: Phân tích · Tag asOf «Server ghi nhận {asOf}» · Button «Làm mới»
Alert (nếu partial): «Một số sự kiện chưa tải được — không dùng số 0 giả.»

Filters (optional P2.1): trạng thái nội dung · cửa sổ thời gian (chỉ field API có)
Table (cursor):
  | Sự kiện | Trạng thái | Check-in (O12) | Pending | Email cần CS | Quota còn | Cập nhật |
  click row → /t/…/e/[eventId] (overview) hoặc …/gate nếu chỉ cần report

Empty: «Chưa có sự kiện» + CTA Tạo sự kiện (nếu event.create)
Denied: Result 403
```

**Dictionary bắt buộc (O12 — không invent BI):** check-in = Gate confirm APPLIED; email KPI = cần CS; watermark + refresh thủ công pilot. **Không** revenue/UTM/seat/Wallet.

### 3.2 PS2 — Saved views

```text
[List toolbar]
  View ▾  [Mặc định · Đang duyệt · …]   [Lưu view…]   [⋯ Quản lý]
Chip filters hiện tại (source / state / …) — chỉ key trong allowlist server

Modal Lưu view:
  Tên * · Phạm vi: Sự kiện này | Tổ chức · Đặt làm mặc định □
Quản lý views: Table tên / phạm vi / cập nhật · Đổi tên · Xóa (Modal confirm)

Automation (phase B — sau ADR):
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

### 3.4 PS4 — Custom roles

```text
Thành viên · Tabs: Người dùng | Lời mời | Vai trò

Vai trò:
  Table: Tên · Loại (Hệ thống|Tuỳ chỉnh) · Số người · Cập nhật
  CTA: Tạo vai trò (nếu policy cho phép)

Editor:
  Form tên + mô tả ngắn
  Collapse nhóm permission (catalog server — checkbox)
  Alert: «Chỉ bật quyền có trong danh mục; thiếu quyền = từ chối API.»
  Footer: Hủy · Lưu · (Danger) Xóa nếu không còn member

Gán: trong Người dùng · Select vai trò (system + custom)
```

**MVP floor nếu ADR cắt custom builder:** chỉ UI rõ cho **role-map cố định** (Owner/Manager/CS/Supervisor/Scanner) + copy «Vai trò tuỳ chỉnh = pha sau» — vẫn đạt PS4 “good enough” documented.

### 3.5 PS5 — Self-serve onboarding

```text
First-run (Owner, org mới ACTIVE):
  Steps ngang: Tổ chức → Đội ngũ → Sự kiện đầu → Sẵn sàng
  Step 1: tên hiển thị / timezone mặc định (field API có)
  Step 2: mời 1 Manager (email) — reuse invite members
  Step 3: CTA «Tạo sự kiện» → wizard P0 Steps
  Step 4: readiness checklist + deep-link setup

Chờ duyệt (lead chưa ACTIVE):
  Result «Đăng ký đã gửi» · không expose admin mutation
```

---

## 4. Trạng thái giao diện

Áp dụng matrix P0 ([`PORTAL-ANTD-UX.md`](./PORTAL-ANTD-UX.md) §9) + bổ sung P2:

| State | Khi nào | UI / copy gợi ý |
| --- | --- | --- |
| `loading` | Fetch portfolio / views / roles | Spin · `aria-busy` |
| `empty` | 0 event / 0 custom role / 0 saved view | Empty + CTA có điều kiện quyền |
| `ready` | Có dữ liệu | Table/Form |
| `error` | 4xx/5xx rõ | Alert + Thử lại |
| `unknown` | Timeout / partial parse | «Chưa rõ» + Kiểm tra lại — **không** tick xanh / không ép 0 |
| `permission-denied` | 403 Analytics/roles | Result 403 |
| `stale` | View filter field đổi · locale pack lệch version | Banner + Tải lại / Đặt lại view |
| `partial` | **P2** một phần hàng portfolio lỗi | Hàng `—` + Tooltip; Alert trang |
| `async-running` | Lưu view / tạo role / invite onboarding | Disable double-submit · Progress |
| `pending-activation` | **P2** self-serve chờ Operator | Result chờ — không fake ACTIVE |
| `suspended` | tenant SUSPENDED | Banner fail-closed (giữ) |

---

## 5. Accessibility (WCAG 2.2 AA mục tiêu)

| Hạng mục | Yêu cầu P2 |
| --- | --- |
| Contrast | ink/paper/signal/focus trên Statistic/Table; signal không dùng làm text nhỏ trên paper nếu fail AA |
| Keyboard | Menu Phân tích, View ▾, Role checkbox groups, Steps onboarding — focus visible |
| Hit target | ≥44px toolbar View / locale trên tablet |
| Labels | Mọi Filter/Select có `<label>` / `aria-label`; lỗi `role="alert"` |
| Live regions | Portfolio refresh xong · job role save fail — polite/assertive đúng mức |
| i18n a11y | `lang` trên `<html>` đổi theo locale; AntD locale pack khớp |
| Motion | `prefers-reduced-motion` |
| Manual vs auto | axe trên `/analytics`, `/members` roles, locale switch = automated; dictionary O12 honesty + last-Owner = manual/UAT |

---

## 6. Tiêu chí nghiệm thu UI (quan sát được)

### AC-PS1 Multi-event Analytics

- **Given** Owner có `report.read` (+ rule ADR), **When** mở `/t/{tenantId}/analytics`, **Then** thấy bảng event với KPI chỉ từ dictionary O12 và `asOf` (hoặc unknown) — không revenue.
- **Given** thiếu perm, **When** deep-link Analytics, **Then** Result 403 và không gọi BFF summary (hoặc gọi bị deny + UI không lộ data).
- **Given** một event summary lỗi, **When** các event khác OK, **Then** hàng lỗi = unknown/`—`, không điền 0 im lặng.
- Evidence: headless `scripts/web-uat.sh` (khi có UI) + fixture perm matrix.

### AC-PS2 Saved views

- **Given** Manager trên Guests, **When** lưu view với filter allowlist, **Then** reload trang áp lại đúng filter (persist theo contract).
- **Given** field filter bị gỡ khỏi API, **When** mở view cũ, **Then** banner stale — không crash.
- Automation rules: **không** gửi email attendee trong MVP P2 trừ BA/ADR mở.

### AC-PS3 EN locale

- **Given** user chọn English, **When** mở Org overview + Analytics chrome, **Then** AntD + portal strings EN; `document.documentElement.lang=en`.
- **Given** VI, **When** switch lại, **Then** không mất org/event context.

### AC-PS4 Custom roles

- **Given** Owner, **When** tạo role chỉ gồm permission catalog, **Then** gán member thành công theo API.
- **Given** cố bật perm ngoài catalog (tamper), **When** submit, **Then** API/UI deny — không tin client.
- **Given** last Owner, **When** demote/xóa, **Then** lỗi ổn định (H-M4).
- Nếu ADR cắt builder: AC thu hẹp = hiển thị role-map hệ thống rõ + empty custom có copy defer.

### AC-PS5 Self-serve onboarding

- **Given** Owner org ACTIVE lần đầu, **When** vào portal, **Then** checklist Steps J1 (research) hoàn thành được không paste UUID.
- **Given** lead chưa ACTIVE, **When** mở `/onboarding`, **Then** pending-activation — không mutation admin.

Map UAT: web Playwright/`scripts/web-uat.sh` only — **không** computer-use chuột desktop; **không** mock auth.

---

## 7. Hướng dẫn triển khai

| Mục | Hướng dẫn |
| --- | --- |
| Ownership UI | `web` (`apps/web` hoặc `apps/portal` theo ADR packaging) — **không** ios/BE trừ contract |
| Không sửa trong Task PD này | `apps/**` |
| Stack | Ant Design thuần (+ ProTable chọn lọc nếu W1 đã dùng) · `@ant-design/nextjs-registry` |
| Tokens | §0 + `brand/vemoki/tokens.json` |
| Nav / authz | O02 allowlist only; **không** map từ tên role |
| Routes | `tenantId`/`eventId` — không slug admin mặc định |
| Contract phụ thuộc | **G-D1** `GET …/events/report-summary` (đề xuất BE §6 gaps) · saved-views persistence (chưa có ID — Architect #501) · i18n message catalog · custom role storage **hoặc** cắt còn role-map · self-serve provision policy |
| Thứ tự implement gợi ý | (1) PS3 locale nếu chỉ chrome — rẻ · (2) PS1 sau G-D1 · (3) PS2 persist · (4) PS4 sau members G-M* · (5) PS5 sau ops policy |
| Good enough MVP | Analytics counts-only + EN chrome + members role-map rõ; custom builder & automation = phase B |
| Cutover prod | **Không** — chỉ #502 |
| Parity P0/P1 | P2 **không** thay thế yêu cầu CS/export/members trước cutover portal ([`PORTAL-ANTD-UX.md`](./PORTAL-ANTD-UX.md) §12) |

### 7.1 Phụ thuộc song song

| Artifact | Issue | PD dùng thế nào |
| --- | --- | --- |
| `docs/plans/PORTAL-P2-BA.md` | #499 | Reconcile priority/JTBD — nếu lệch horizon, cập nhật comment Issue #500 (không block merge PD nếu BA chậm) |
| ADR P2 | #501 | Chốt perm Analytics, saved-view storage, custom-role model, self-serve |
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

---

## 8. Quyết định còn chờ (không hỏi lại host portal+antd)

1. **Mở coding G-D1** sau BA priority — user đã mở Epic discovery; coding vẫn cần dispatch riêng.  
2. **Perm exact** cho portfolio summary (`report.read` vs `event.list`+assignment).  
3. **Saved views**: server-persist vs local-only phase 1.  
4. **Custom roles**: full builder vs role-map-only + defer.  
5. **Self-serve**: auto-provision vs Operator approve (khuyến nghị: approve — khớp «Đăng ký quan tâm» O13).

---

## 9. Tóm tắt executive

P2 portal trên shell AntD P0/P1 thêm năm surface ưu tiên: **portfolio Analytics đa event (O12 dictionary)**, **saved views**, **EN locale**, **custom roles (hoặc role-map floor)**, **self-serve first-run** — visual Live Pulse v2, deny-by-default, không invent BI/revenue. Architecture impact nằm ở contract G-D1 / role / onboarding; coding chỉ sau BA+ADR và Task web riêng. Cutover production và DNS vẫn Issue **#502**; artifact này là handoff PD only.
