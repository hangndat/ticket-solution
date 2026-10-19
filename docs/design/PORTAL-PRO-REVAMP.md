# Portal Pro Revamp — Handoff UX/UI (Ant Design ProComponents)

| Trường | Giá trị |
| --- | --- |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../agents/roles/product-design.md) |
| Persona | Liv |
| Output | File này — `docs/design/PORTAL-PRO-REVAMP.md` |
| Ngày | 2026-10-20 |
| Architecture impact | **Có** — chỉ shell/layout/component; **không** đổi route, BFF, OpenAPI |
| Ownership triển khai | `web` → **`apps/portal`** |
| Neo nghiệp vụ | [`PORTAL-IMPLEMENTATION-HANDOFF.md`](./PORTAL-IMPLEMENTATION-HANDOFF.md), [`o02-permission-nav/contract.md`](./o02-permission-nav/contract.md) |
| Supersede (UI kit) | Mục **`ANTD-CORE-FIRST`** trong handoff cũ → **ProComponents chọn lọc** (file này); các ràng buộc host/OIDC/Gate/Platform **giữ nguyên** |

**Mục đích:** Worker `web` revamp giao diện portal sang **ngôn ngữ Ant Design Pro** (ProLayout, PageContainer, ProTable, ProForm, StatisticCard) trên **Next.js App Router**, không cần hỏi lại IA.

---

## Ràng buộc đã chốt (không mở lại)

| Chủ đề | Quy định |
| --- | --- |
| Runtime | Next.js App Router, OIDC staff, BFF `/api/bff`, auth `/api/auth` — **giữ** |
| Cấm | Umi, `@ant-design/pro-cli`, sửa `apps/web`, hạ `antd` 5, ProComponents 2.8.x (peer antd 4/5) |
| Package | `@ant-design/pro-components` bản **peer `antd` ^6** (hiện **3.1.15-7** pre-release); portal pin `antd` **6.6.6** |
| Gate | Quét vẫn **`app.vemoki.com`** — portal **không** camera/scan (`GATE-STAY-APP`) |
| Locale | **Tiếng Việt mặc định**; **giữ** key i18n hiện có (`usePortalLocale`, `MessageKey`) — không invent copy key mới trừ khi tách label Pro bắt buộc |
| Menu nhóm | **Tổ chức này** · **{tên sự kiện}** (vận hành / `run`) · **Thiết lập sự kiện** (`setup`) · **Nền tảng** (Operator) |
| Dữ liệu | **Không** mock API; reuse `portalGet` / `portalMutate` / panel hiện có |
| Contract | **Không** đổi hợp đồng API/BFF |

---

## 0. Visual budget (portal staff)

**Visual budget: Có (giới hạn)** — Portal không nằm priority Live Pulse v2 (xem [`visual-identity-v2/visual-notes.md`](./visual-identity-v2/visual-notes.md)); revamp **bám token staff** qua `ConfigProvider`, không redesign marketing.

| Hạng mục | Nội dung |
| --- | --- |
| Tokens | Map từ [`brand/vemoki/tokens.json`](../../brand/vemoki/tokens.json) v2 Live Pulse: ink `#0B1220`, paper `#F4F6F8`, signal `#E11D48`, focus `#2563EB` → `colorText`, `colorBgLayout`, `colorPrimary`, `colorInfo` / `controlOutline` |
| Typography | Body **Be Vietnam Pro** (đã dùng portal); display shell có thể **Sora** cho wordmark — **không** Inter/Roboto hero |
| Pro chrome | Ưu tiên **token antd + ProLayout preset `layout: 'mix'` hoặc `side'`** — tránh skin Pro mặc định xám tím |
| Anti-patterns | Purple AI-default; card cluster hero; lộ UUID/raw BFF trên title; flat-only nền staff |
| Motion | `prefers-reduced-motion` → tắt animation ProLayout; giữ transition ngắn drawer |
| Priority surfaces (đợt revamp) | (1) Shell ProLayout (2) Event overview (3) Gate/report (4) Guests hub (5) Setup/config block |
| Freeze | Implementer **không** invent palette/font ngoài tokens; thiếu map Pro token → escalate coordinator |

---

## 1. Đánh giá UX/UI hiện tại (baseline `apps/portal`)

Quan sát source (antd **6.6.6**, shell tự viết `portal-shell.tsx` + `capabilities.ts`, menu `type: 'group'` đã ship).

### 1.1 Điểm đã ổn (giữ hành vi)

- Nhóm sider O02 khớp handoff; deny-by-default từ server permissions.
- `SurfaceState` + pattern access (`useEventAccess` / `useTenantAccess`) nhất quán loading/denied.
- Breadcrumb + tenant/event switcher header; Gate deep-link CTA, không mount scan.
- Home/onboarding auth redirect Keycloak (không spinner vô hạn).

### 1.2 Vấn đề UX cần revamp

| Vấn đề | Biểu hiện hiện tại | Hướng Pro |
| --- | --- | --- |
| **Thiếu page chrome** | Mỗi page chỉ `Typography.Title level={3}` + `Space vertical` — không subtitle, không `extra` action chuẩn, breadcrumb không có **leaf** màn hiện tại | `PageContainer` + `title` / `subTitle` / `extra` / `footer` |
| **Form dày, lộn xộn** | Setup: inline name + vertical clone + alert `contentStatus=…` thô; platform: nhiều `Input` raw trong tab | `ProForm` / `ProForm.Group` / `StepsForm`; ẩn trạng thái kỹ thuật vào `ProDescriptions` hoặc collapse |
| **Bảng “thường”** | `Table` không toolbar: events, platform tenants/audit — filter thủ công, load more bằng `Button` riêng | `ProTable` `request` + `pagination` + `search` + `toolBarRender` (giữ cursor API hiện có) |
| **Overview chưa dashboard** | Event home: nhiều `Card` + `Descriptions` + `List` readiness — khó quét metric | `StatisticCard.Group` / `ProCard` tabs cho readiness + report snapshot |
| **Hub Guests rối** | Tab + filter nguồn/loại vé **trên** tab; label EN lẫn (`Import & invitations`, `Export`); hash `#pending` | `PageContainer` + `ProCard` `tabs`; filter trong tab Import; **chỉ** `t(key)` |
| **Alert/info trùng** | Nhiều `Alert type="info"` giải thích nghiệp vụ lặp nav | Chuyển sang `subTitle` PageContainer hoặc `ProCard` `tooltip` một lần |
| **Shell không Pro** | `Layout` + `Menu` inline tự ghép; selected key = full pathname (fragile sub-routes) | `ProLayout` `menuItemRender` + `location` từ `usePathname`; **logic menu** vẫn từ `buildOrgMenuItems` / `buildEventMenuItems` |
| **Platform zone** | Tabs chứa form + table không hierarchy | `PageContainer` + `ProTable` / `ModalForm` revoke |

### 1.3 Không đổi (scope ngoài revamp visual)

- Route map, permission keys, BFF URL helpers (`bff-urls.ts`).
- Panel logic (`src/ops/panels/*`) — **bọc** Pro, không rewrite nghiệp vụ.
- `apps/web` admin parity source — chỉ tham chiếu port đã xong.

---

## 2. Sitemap (giữ route — không đổi IA)

```text
portal.vemoki.com
  /                                 Home redirect / empty org (shell optional)
  /auth/*                           OIDC landing (không ProLayout)
  /onboarding                       Staff onboarding entry
  /onboarding/[tenantId]            Tenant activation wait
  /account/security                 Phiên / bảo mật
  /platform                         Platform Operator zone (nav Nền tảng)
  /t/[tenantId]                     Tổng quan tổ chức
  /t/[tenantId]/events              Danh sách sự kiện
  /t/[tenantId]/events/new          Wizard tạo sự kiện
  /t/[tenantId]/members             Thành viên
  /t/[tenantId]/settings            Cấu hình org
  /t/[tenantId]/analytics           Phân tích (P2, nếu perm)
  /t/[tenantId]/e/[eventId]         Tổng quan sự kiện
  /t/[tenantId]/e/[eventId]/setup   Chuẩn bị / metadata
  /t/[tenantId]/e/[eventId]/types   Loại vé
  /t/[tenantId]/e/[eventId]/sources Nguồn mã
  /t/[tenantId]/e/[eventId]/quota   Hạn mức
  /t/[tenantId]/e/[eventId]/config  Brand / publish
  /t/[tenantId]/e/[eventId]/guests  Khách & mã (import/pending/notify/export)
  /t/[tenantId]/e/[eventId]/gate    Báo cáo cổng (report.read)
  /t/[tenantId]/e/[eventId]/audit   Nhật ký mã
  /t/[tenantId]/e/[eventId]/support CS
```

**Menu sider ↔ route:** giữ bảng §3.3 [`PORTAL-IMPLEMENTATION-HANDOFF.md`](./PORTAL-IMPLEMENTATION-HANDOFF.md); implementer map `href` → `path` ProLayout.

---

## 3. Mapping màn → ProComponents

Quy ước: **Page** = default export `app/**/page.tsx`; bọc nội dung bằng wrapper `PortalPage` (implementer tạo) = `PageContainer` + state guard.

| Route / màn | Pro component chính | Ghi chú triển khai |
| --- | --- | --- |
| **Shell** (`portal-shell.tsx`) | **`ProLayout`** (`layout`, `siderWidth` 240, `breakpoint: lg`) | `headerContentRender`: tenant/event `ProFormSelect` hoặc giữ `Select` antd; `menuDataRender` build từ `siderItems` hiện tại; `avatarProps` / actions: account dropdown; **không** dùng `umi` history — `menuItemRender` → `<Link href>` |
| `/t/[tenantId]` | **`PageContainer`** + **`StatisticCard.Group`** + **`ProList`** hoặc `ProCard` events gần đây | Subtitle: slug org; extra: link events/new nếu `event.create` |
| `/t/[tenantId]/events` | **`PageContainer`** + **`ProTable<EventDetail>`** | Cột: name (link), slug, contentStatus, businessStatus, visibility; `toolBarRender`: nút tạo; pagination: map `nextCursor` hiện có vào `ProTable` manual `onChange` |
| `/t/[tenantId]/events/new` | **`PageContainer`** + **`StepsForm`** hoặc `ProForm` steps | Giữ bước/API wizard hiện có |
| `/t/[tenantId]/members` | **`PageContainer`** + **`ProTable`** + **`ModalForm`** invite | Reuse logic members hiện có |
| `/t/[tenantId]/settings` | **`PageContainer`** + **`ProForm`** layout vertical / **`ProDescriptions`** read-only | Brand org |
| `/t/[tenantId]/analytics` | **`PageContainer`** + **`ProCard`** + chart placeholder antd | P2 — giữ scope API |
| `/t/[tenantId]/e/[eventId]` | **`PageContainer`** + **`StatisticCard.Group`** (quota, pending, check-in) + **`ProCard`** readiness checklist + **`ProDescriptions`** metadata | `extra`: Publish primary (giữ `Modal.confirm`); Gate CTA giữ `GateStayAppNotice` |
| `…/setup` | **`PageContainer`** + 2× **`ProCard`**: Metadata (`ProForm`), Clone (`ProForm`), Danger zone | Bỏ alert status thô; dùng `ProDescriptions` collapsible «Kỹ thuật» |
| `…/types`, `…/sources`, `…/quota` | **`PageContainer`** + **`ProTable`** + **`ModalForm`** / drawer edit | CRUD list chuẩn Pro |
| `…/config` | **`PageContainer`** + **`ProForm`** sections + publish actions | Config versions — `ProFormDependency` nếu cần |
| `…/guests` | **`PageContainer`** + **`ProCard` `tabs`** | Mỗi tab: panel hiện tại; Import tab: `ProForm` inline source/type |
| `…/gate` | **`PageContainer`** + **`StatisticCard`** + **`ProTable`** report rows | Không scan UI |
| `…/audit` | **`PageContainer`** + **`ProTable`** | Filter ProTable |
| `…/support` | **`PageContainer`** + **`ProForm`** lookup + **`ProDescriptions`** timeline | CS |
| `/platform` | **`PageContainer`** (title Platform) + **`ProCard` tabs** + **`ProTable`** tenants/audit + **`ModalForm`** revoke | Operator logout giữ |
| `/onboarding`, `/onboarding/[tenantId]` | **`PageContainer`** `ghost` + **`ProSteps`** / **`Result`** | Không full ProLayout nếu chưa staff chrome |
| `/`, `/account/security` | **`PageContainer`** hoặc minimal layout | Auth entry giữ redirect |

### 3.1 Gói dependency (task coding riêng)

```json
"@ant-design/pro-components": "3.1.15-7"
```

- Import lẻ: `@ant-design/pro-components` (ProLayout, PageContainer, ProTable, ProForm, StatisticCard).
- **`ProConfigProvider`** bọc trong `app/layout.tsx` cùng `AntdRegistry` — locale `vi_VN`, sync `usePortalLocale`.
- **Không** `@ant-design/pro-cli`, **không** scaffold Umi.

### 3.2 Tách file gợi ý (web worker)

| File mới / đổi | Trách nhiệm |
| --- | --- |
| `src/components/portal-pro-layout.tsx` | ProLayout + menu groups |
| `src/components/portal-page.tsx` | `PageContainer` + loading/denied wrapper |
| `src/components/portal-pro-table.tsx` | Helper map `portalGet` cursor → ProTable `request` |
| `portal-shell.tsx` | Mỏng — delegate sang `portal-pro-layout` hoặc thay thế dần |

---

## 4. Trạng thái giao diện (giữ matrix handoff)

Reuse [`PORTAL-IMPLEMENTATION-HANDOFF.md` §4](./PORTAL-IMPLEMENTATION-HANDOFF.md): `loading` | `empty` | `ready` | `error` | `unknown` | `permission-denied` | `stale` | `async-*` | `suspended`.

**Pro mapping:**

| State | UI Pro |
| --- | --- |
| loading | `PageContainer` `loading` hoặc `ProTable` `loading` |
| empty | `ProTable` `locale.emptyText` + `Empty` CTA trong `PageContainer` |
| permission-denied | `PageContainer` → `Result` 403 (giữ copy `t(key)`) |
| unknown | `Result` warning + «Kiểm tra lại» |
| async job | `ProCard` + `Progress` trong drawer |

---

## 5. Accessibility (WCAG 2.2 AA — scope portal)

- ProLayout: skip link giữ `#portal-main`; focus order header → sider → content.
- ProTable: cột action có `aria-label`; sort/filter keyboard.
- ProForm: lỗi field `help` + `validateStatus`; không chỉ màu đỏ.
- StatisticCard: text không chỉ dựa màu — có label rõ.
- Kiểm tra: axe trên shell + 1 ProTable + 1 ProForm sau merge.

---

## 6. Thứ tự triển khai (ưu tiên)

| Wave | Phạm vi | Done khi |
| --- | --- | --- |
| **W0** | Cài ProComponents 3.x + `ProConfigProvider` + theme token | `pnpm build` portal pass |
| **W1 — Shell** | `ProLayout` thay Layout/Sider/Menu; giữ switcher + capabilities | Menu 4 nhóm + perm unchanged; UAT nav prod parity |
| **W2 — Event overview** | `PageContainer` + StatisticCard + readiness ProCard | Publish flow unchanged; metric readable |
| **W3 — Gate + report** | Page gate + StatisticCard | `report.read` only; deep-link app gate |
| **W4 — Guests hub** | PageContainer + tabs; i18n hết EN hardcode | Panels reuse; hash tab optional giữ |
| **W5 — Setup/config/types/sources/quota** | ProForm + ProTable | Không đổi API |
| **W6 — Org lists** | events, members, settings | ProTable cursor |
| **W7 — Platform zone** | ProTable + ModalForm revoke | Operator only |
| **W8 — Onboarding** | ProSteps/Result | OIDC entry unchanged |

Song song có thể: W2 sau W1; **không** W5 trước W1.

---

## 7. Tiêu chí nghiệm thu (UI — quan sát được)

1. **Shell:** Đăng nhập staff → sider hiển thị 4 nhóm (khi perm); đổi tenant/event không mất nhóm; collapse mobile `lg`.
2. **Page chrome:** Màn event overview có `PageContainer` với title = tên sự kiện, `extra` chứa Publish + link setup/config.
3. **ProTable:** Danh sách sự kiện có toolbar tạo mới (nếu perm) và empty state CTA.
4. **Guests:** Không còn string EN cứng «Import & invitations» / «Export» trên tab — chỉ `t(key)`.
5. **Gate:** Trang gate không có UI camera; có metric + link app gate khi `gate.confirm`.
6. **Regression:** `pnpm --filter @ticket/portal test` + `typecheck` pass; không đổi path BFF.
7. **Locale:** Mặc định VI; đổi EN account menu vẫn đổi label Pro.

---

## 8. Phụ thuộc & rủi ro

| Rủi ro | Mitigation |
| --- | --- |
| Pro 3.x pre-release | Pin exact version; spike trước W0; không hạ antd |
| ProLayout vs Next App Router | Controlled `openKeys` / `selectedKeys` từ `pathname`; không `react-router` |
| Bundle size | Import named; lazy `ProTable` nặng trên platform |
| Handoff cũ `ANTD-CORE-FIRST` | Epic revamp Pro **ghi đè** chỉ mục UI kit; host/Gate/Platform **không** đổi |

---

## 9. Tài liệu tham chiếu implementer

- Menu logic: `apps/portal/src/nav/capabilities.ts`
- Shell hiện tại: `apps/portal/src/components/portal-shell.tsx`
- State: `apps/portal/src/components/surface-state.tsx`
- [ProComponents antd 6](https://procomponents.ant.design/) — **không** dùng docs Umi
- [antd Next registry](https://ant.design/docs/react/use-with-next)

**Freeze PD:** Implementer triển khai theo mapping §3 và thứ tự §6; không đổi API; không invent route/slug resolver; thiếu pattern Pro cho màn trong bảng → escalate coordinator.
