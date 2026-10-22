# FE Product Design — Đánh giá design system & đồng bộ UI (Epic #715 follow-up)

| Trường | Giá trị |
| --- | --- |
| Ngày | 2026-10-22 |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../agents/roles/product-design.md) |
| Task | `task_5fe2ea0b6acb` |
| Epic | [#715](https://github.com/hangndat/ticket-solution/issues/715) (follow-up) |
| Cost tier | `standard` |
| Architecture impact | **Không** (docs-only; không đổi contract BE/OIDC) |
| Visual budget | **Không** — dùng token Live Pulse v2 đã freeze (`brand/vemoki/tokens.json`) |
| Phạm vi audit | `apps/web`, `apps/portal`, `apps/mobile` (read-only) |
| Mockup SoT | `docs/plans/mobile-production-refactor/web-prototype.html` + `WEB-HANDOFF.md` (user duyệt 20/10/2026) |
| Ảnh kiểm kê | [`docs/reviews/assets/FE-PD-DESIGN-SYSTEM-2026-10-22/`](./assets/FE-PD-DESIGN-SYSTEM-2026-10-22/) — Playwright headless **1280×800** + **390×844** (`node scripts/web-uat.mjs screenshot` + Chrome headless mobile) trên prod guest |
| Bối cảnh user | Sau refactor web, nhiều chỗ desktop/mobile «không hợp lý» so mockup đã duyệt; cần **một** hướng design system cho Next.js |

---

## Tóm tắt điều hành

1. **Ba surface, ba cách tô UI:** `apps/web` (~3.4k dòng `globals.css`, class rải rác), `apps/portal` (Ant Design 6 + ProComponents, theme **chưa** khớp Live Pulse v2), `apps/mobile` (theme TS gọn, **khớp** `tokens.json`).
2. **Portal đang lệch brand:** `apps/portal/src/theme/vemoki.ts` vẫn palette cũ (nâu `#9b3a18`, paper `#f7f6f1`) — không phải ink/paper/signal/focus trong `brand/vemoki/tokens.json`.
3. **Khuyến nghị một hướng:** package monorepo **`@ticket/ui`** (tokens + semantics + primitives) với **Radix UI primitives** (headless, WAI-ARIA) và **CSS variables** (không bắt buộc Tailwind); **portal giữ Ant Design** nhưng **theme sinh từ cùng token package**; consumer web migrate **theo slice** từ mockup/HTML đã duyệt, không big-bang Ant lên `app.vemoki.com`.

---

## 1. Kiểm kê thực trạng UI

### 1.1 Stack pin (đọc `package.json`, 2026-10-22)

| App | React | Next / runtime | UI stack |
| --- | --- | --- | --- |
| `apps/web` | **19.3.1** | **Next 16.4.2** | Không component lib; `app/globals.css` + TSX class string |
| `apps/portal` | **19.3.1** | **Next 16.4.2** | **antd 6.6.6**, `@ant-design/nextjs-registry` 1.3.0, `@ant-design/pro-components` 3.1.15-7 |
| `apps/mobile` | **19.3.0** | Expo **58** / RN **0.88** | `@expo/ui` + `src/theme/*` map `brand/vemoki/tokens.json` |

Monorepo: **pnpm**, **không** Tailwind / **không** `@ticket/ui` hiện tại.

### 1.2 Token & typography

| Hạng mục | `brand/vemoki/tokens.json` (SoT) | `apps/web` | `apps/portal` | `apps/mobile` |
| --- | --- | --- | --- | --- |
| ink / paper / signal / focus | `#0B1220` / `#F4F6F8` / `#E11D48` / `#2563EB` | `:root` trong `globals.css` L5–28 — **khớp** | `VEMOKI_COLORS` trong `vemoki.ts` — **lệch** (palette pre–v2) | `src/theme/tokens.ts` — **khớp** + derived |
| Display / body | Sora / Be Vietnam Pro | `next/font` trên layout | Be Vietnam Pro + IBM Plex fallback trong antd `fontFamily` | `fonts.ts` / branding |
| Spacing scale | Không trong JSON (web scale trong CSS) | `--space-1`…`--space-8` (4–72px) | antd `token` mặc định + `borderRadius: 6` | RN spacing riêng |
| Radius | — | `--radius-sm/md/lg` (2/8/14px) | antd **6px** global | component-level |
| Atmosphere | Live Pulse gradient | body radial + linear gradient | layout trắng / paper antd | RN surfaces |

### 1.3 Component & pattern — chỗ **không** đồng bộ

| Pattern | Web (`apps/web`) | Portal (`apps/portal`) | Mobile | Ghi chú / evidence |
| --- | --- | --- | --- | --- |
| **Button** | `.btn-primary`, `.btn-secondary`, `.button`, `.button-link`, `.mkt-btn-primary`, `.home-cta .button`, `.gate-page .button-secondary`… | `Button` antd + Pro `Button` | Pressable / Expo UI | ≥6 “họ” nút trên web; hover/focus khác nhau theo page |
| **Input / form** | Native `<input>` + class page-specific; redeem/gate/admin khác nhau | `Input`, `Form`, Pro `ProForm` | TextInput RN | Validation copy VI không chuẩn hóa; admin web monolith 2k+ dòng form |
| **Table** | HTML `<table>` + `.home-catalog` cards | `ProTable` / antd `Table` | List / card | Staff admin: web custom vs portal Pro — **hai UX** |
| **Modal / drawer** | `<dialog>` / custom ít | `Modal`, `Drawer` antd | Sheet / modal RN | Web guest hầu như không dùng modal chuẩn |
| **Toast / message** | Inline notice / `SurfaceState` | `App.useApp()` message/notification | Expo alerts | Không shared API |
| **Empty / loading / error** | `SurfaceState` (`surface-state.tsx`) + nhiều class `.state-*` / copy «Đang tải…» rải rác | `Empty`, `Spin`, `Result` | Theme + screen copy | Web có primitive tốt (role/aria-live) nhưng **chưa** dùng everywhere |
| **Typography** | `.eyebrow`, hero display, marketing `.mkt-*` | antd `Typography` | `typography.ts` | Marketing (`/marketing`, `vemoki.com`) ≠ product chrome |
| **Icon** | SVG inline / text | `@ant-design/icons` | `expo-symbols` | Không catalog icon chung |
| **Nav** | `.top-nav`, `.nav-links` — guest vs staff path khác | ProLayout sidebar | Expo Router tabs | Mockup: role nav + mobile menu — web prod **lệch IA** ([FE-REFACTOR-GAP-UAT](./FE-REFACTOR-GAP-UAT-2026-10-21.md)) |
| **A11y focus** | `focus-visible` 3px `--focus` global | antd focus ring | RN accessibility | Web tốt ở global; antd override cần kiểm contrast theme mới |
| **i18n VI** | Copy hardcode VI | `vi_VN` locale antd | VI strings | Portal đủ locale; web không i18n framework |

### 1.4 Ảnh chụp production (guest / công khai)

Viewport desktop **1280×800**, mobile **390×844**. Prod `https://app.vemoki.com`, `https://portal.vemoki.com`, `https://vemoki.com`.

| ID | Mô tả | Desktop | Mobile |
| --- | --- | --- | --- |
| W1 | App home `/` (catalog + marketing hero trộn) | [web-app-home-desktop-1280x800.png](./assets/FE-PD-DESIGN-SYSTEM-2026-10-22/web-app-home-desktop-1280x800.png) | [web-app-home-mobile-390x844.png](./assets/FE-PD-DESIGN-SYSTEM-2026-10-22/web-app-home-mobile-390x844.png) |
| W2 | Redeem `/redeem` (form kỹ thuật vs mock auth gate) | [web-app-redeem-desktop-1280x800.png](./assets/FE-PD-DESIGN-SYSTEM-2026-10-22/web-app-redeem-desktop-1280x800.png) | [web-app-redeem-mobile-390x844.png](./assets/FE-PD-DESIGN-SYSTEM-2026-10-22/web-app-redeem-mobile-390x844.png) |
| W3 | Marketing sales `/marketing` trên app host | [web-app-marketing-desktop-1280x800.png](./assets/FE-PD-DESIGN-SYSTEM-2026-10-22/web-app-marketing-desktop-1280x800.png) | — |
| W4 | Gate `/gate` (redirect auth khi guest) | [web-app-gate-desktop-1280x800.png](./assets/FE-PD-DESIGN-SYSTEM-2026-10-22/web-app-gate-desktop-1280x800.png) | — |
| M1 | Marketing host `vemoki.com` | [web-vemoki-marketing-desktop-1280x800.png](./assets/FE-PD-DESIGN-SYSTEM-2026-10-22/web-vemoki-marketing-desktop-1280x800.png) | — |
| P1 | Portal shell (guest / pre-auth) | [portal-home-desktop-1280x800.png](./assets/FE-PD-DESIGN-SYSTEM-2026-10-22/portal-home-desktop-1280x800.png) | [portal-home-mobile-390x844.png](./assets/FE-PD-DESIGN-SYSTEM-2026-10-22/portal-home-mobile-390x844.png) |
| P2 | Portal `/login` | [portal-login-desktop-1280x800.png](./assets/FE-PD-DESIGN-SYSTEM-2026-10-22/portal-login-desktop-1280x800.png) | — |

**Đối chiếu mockup (đã audit slice A):** xem ảnh cặp app/mock trong [`FE-REFACTOR-GAP-UAT-2026-10-21`](./FE-REFACTOR-GAP-UAT-2026-10-21.md) (`assets/fe-refactor-gap-2026-10-21/`). Lệch **P0/P1**: IA catalog, event detail, redeem flow, auth stub.

### 1.5 `apps/web` — độ phân mảnh CSS

- `app/globals.css`: **3447** dòng, **~554** rule class — single file cho product + gate + redeem + marketing + admin legacy.
- Primitive React ít: `src/ui/surface-state.tsx`, catalog components trong `event-media.tsx`, v.v.; phần lớn UI = **class trong page** (`admin-form.tsx` ~2390 dòng).
- **Không** Storybook / visual regression trong repo.

### 1.6 `apps/mobile`

- Theme tập trung `src/theme/` — **mẫu tốt** cho shared tokens.
- Không dùng Ant/MUI; parity với web là **semantic** (ink/paper/signal), không pixel-identical web.

---

## 2. Đánh giá phương án đồng bộ (Next.js 16 / React 19)

Tiêu chí: **a11y WAI-ARIA**, **Live Pulse v2 tokens**, **bundle / SSR / RSC Next 16**, **i18n VI**, **hiệu năng**, **chi phí migrate từ `globals.css`**, **tái dùng web ↔ portal**, **bám mockup HTML**, **cấp phép**.

| Phương án | Phiên bản / tương thích repo | A11y | Theming Live Pulse | Next 16 RSC/SSR | i18n VI | Migrate `globals.css` | Web ↔ portal reuse | Mockup HTML | License | Nhận xét ngắn |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Ant Design (đồng bộ portal)** | antd **6.6.6**, peers React ≥18 — khớp 19.3.1; `@ant-design/nextjs-registry` **1.3.0** | Tốt nếu dùng đúng component; cần `App` wrapper | `ConfigProvider` + `token` — **cần sửa** `vemoki.ts` từ SoT | SSR qua `AntdRegistry`; RSC: client components cho tương tác | `vi_VN` built-in | **Cao** — thay ~3.4k CSS + markup mockup | **Cao** với portal | **Thấp** — mockup custom, không phải ant look | MIT | Hợp **staff**; **không** hợp consumer catalog đã duyệt |
| **shadcn-ui + Radix + Tailwind** | shadcn v4+ / Radix — React 19 OK; **repo chưa có Tailwind** | Rất tốt (Radix) | Tailwind theme từ CSS vars / `tokens.json` | RSC-friendly; cần `"use client"` cho Radix | Copy VI thủ công | **Cao** + thêm toolchain Tailwind v4 | Thấp–trung bình (portal vẫn antd) | **Cao** nếu map class mockup → utilities | MIT | Đúng hướng **consumer** nhưng **đổi stack styling** toàn web |
| **Mantine** | v7+ React 19 (kiểm tra từng minor khi pin) | Tốt | `MantineProvider` theme object | App Router hỗ trợ; CSS-in-JS cost | Có VI community | Cao | Thấp | Trung bình | MIT | Thêm **hệ thứ 3** cạnh antd portal |
| **MUI** | MUI 6+ / React 19 | Tốt | `createTheme` | Emotion + RSC caveats | `viVN` | Cao | Thấp | Thấp–TB | MIT | Bundle nặng; overlap antd portal |
| **Chakra** | v3 — verify React 19 | Tốt | tokens | SSR setup | VI partial | Cao | Thấp | TB | MIT | Không lợi thế so Mantine/MUI |
| **Radix Themes** | `@radix-ui/themes` — React 19 | Tốt | CSS variables | Client-heavy | Manual | Trung bình–cao | Thấp | TB–cao | MIT | Ít component “data” (table) — portal vẫn antd |
| **Park UI / Ark** | Ark UI (Zag) — React | Tốt headless | Custom | Tương thích | Manual | Trung bình | Thấp | Cao (copy patterns) | MIT | Ecosystem nhỏ hơn Radix; docs ít hơn antd |
| **`@ticket/ui` nội bộ** (tokens + primitives, CSS vars, **Radix headless tùy chọn**) | Pin theo monorepo | **Chủ động** — bắt buộc pattern `SurfaceState` | **Trực tiếp** từ `tokens.json` | Zero CSS-in-JS mặc định — **RSC-first** | Copy VI product | **Thấp–TB theo slice** — tách dần `globals.css` | **Cao** (token + semantics); portal = **antd theme generator** | **Rất cao** — port mockup → components | N/A | **Khớp** quyết định visual-identity-v2; mobile đã có precedent |

**Ghi chú phiên bản antd (portal hiện tại):** `@ant-design/pro-components` **3.1.15-7** đi với antd 6 (khác feasibility doc 2026-10-18 ghi Pro 2.x + antd 5). Giữ pin exact trong `apps/portal/package.json`.

---

## 3. Khuyến nghị (một phương án)

### 3.1 Chọn: `packages/ui` (`@ticket/ui`) — Live Pulse tokens + primitives, portal antd **theme từ cùng SoT**

**Không** rollout Ant Design lên toàn `apps/web` consumer. **Không** big-bang Tailwind + shadcn chỉ để “có framework”.

**Kiến trúc đề xuất:**

```text
brand/vemoki/tokens.json
        ↓ build step (JSON → CSS vars + TS + antd ThemeConfig)
packages/ui/
  tokens.css | tokens.ts
  components/  Button, TextField, Link, Stack, SurfaceState, …
  patterns/    SiteHeader, CatalogCard, … (theo mockup)
        ↓                    ↓
   apps/web (import)    apps/portal (vemokiTheme = import antdTheme from @ticket/ui/antd)
        ↓
   apps/mobile (giữ src/theme; import tokens.ts từ package — optional dedupe)
```

- **Radix** (`@radix-ui/react-*`) chỉ cho primitives cần behavior (Dialog, Select, Tabs) — **không** bắt buộc full shadcn.
- **Storybook** (optional slice 1): `packages/ui` — visual regression **chỉ** primitives + 3–5 priority screens ([visual-identity-v2](../design/visual-identity-v2/visual-notes.md)).

### 3.2 Cách gắn Live Pulse v2

1. Single generator: `brand/vemoki/tokens.json` → `--ink`, `--paper`, … + spacing/radius **đã chốt trong mockup** (không invent màu).
2. Web: import `@ticket/ui/tokens.css` trong `app/layout.tsx`; **giảm** `globals.css` theo slice (page-scoped CSS chỉ layout đặc thù).
3. Portal: **xóa** hardcode `VEMOKI_COLORS` cũ; `ConfigProvider theme={livePulseAntdTheme}`.
4. Quy tắc component: **variant** `primary | secondary | ghost | destructive`; **size** `sm | md` (min-height 44px touch); **state** loading/disabled/error qua props → class BEM hoặc data-attr; document trong `packages/ui/README.md`.

### 3.3 Lộ trình migrate theo slice (ownership)

| Slice | Owner | Việc | Ước lượng | Rủi ro |
| --- | --- | --- | --- | --- |
| **0 — Token pipeline** | Coordinator + web | `packages/ui` scaffold; fix portal `vemoki.ts`; CI diff token | **2–3 ngày** | Portal Pro layout regress màu |
| **1 — Primitives** | web | Button, Input, Link, FieldError, SurfaceState → package; Storybook 5 stories | **4–6 ngày** | Trùng class cũ — cần grep migration |
| **2 — Site chrome** | web | Header/nav guest theo mockup + mobile menu | **5–8 ngày** | IA vs marketing hero trên `/` |
| **3 — Guest catalog + event** | web | Home grid, card, detail 2 cột ([WEB-HANDOFF](../plans/mobile-production-refactor/WEB-HANDOFF.md)) | **8–12 ngày** | Phụ thuộc API catalog |
| **4 — Redeem + wallet + account** | web | Auth gate, list ví route mới, account 2 cột | **8–10 ngày** | Route `/wallet` chưa có |
| **5 — Gate web** | web | Staff gate form states (tách khỏi admin CSS) | **5–7 ngày** | Perf/session (đã có Epic riêng) |
| **6 — Admin monolith** | web **hoặc** deprecate | **Không** refactor admin web CSS lớn — **ưu tiên portal** cho staff ([PORTAL-ANTD-UX](../design/PORTAL-ANTD-UX.md)) | **ngoài scope** consumer DS | Hai admin song song |
| **P — Portal theme only** | portal | Chỉ theme + Empty/Spin copy VI; không đổi IA Pro | **1–2 ngày** sau slice 0 | antd 6 + Pro edge cases |

**Tổng consumer web (slice 1–5):** ~**6–8 tuần** 1 FE (standard), song song portal theme slice 0+P.

### 3.4 Những việc **không** nên làm

- Big-bang thay `globals.css` một lần.
- Gắn Ant Design lên home/redeem/marketing để “đồng bộ portal” — phá mockup đã duyệt.
- Thêm Tailwind + shadcn **chỉ** vì trend, khi mockup và team đang CSS-token-first.
- Invent palette / Inter / purple AI-default (visual-identity-v2 anti-patterns).
- Storybook toàn app trước khi có `packages/ui` primitives.
- Đồng bộ pixel-perfect web ↔ iOS (chỉ semantic tokens + flow).

### 3.5 Rủi ro

| Rủi ro | Mức | Giảm thiểu |
| --- | --- | --- |
| Hai admin (web monolith vs portal) | Cao | Roadmap: staff features **portal-first**; freeze admin CSS web |
| Mockup SoT chưa track trên `main` | Cao | Commit `web-prototype.html` + `WEB-HANDOFF.md` ([FE-REFACTOR-MOCKUP-INVENTORY](./FE-REFACTOR-MOCKUP-INVENTORY-2026-10-21.md)) |
| `globals.css` regression | Trung bình | Slice + visual diff Storybook/chromatic (optional) |
| antd 6 + Pro bump | Trung bình | Pin exact; test portal shell sau theme gen |
| User vẫn thấy “không hợp lý” nếu chỉ đổi màu | Cao | Slice 2–4 **IA/layout** theo mockup, không chỉ token |

---

## 4. Handoff ngắn cho FE worker (checklist)

**Trước code UI Epic #715:**

- [ ] Đọc mockup `web-prototype.html` + `WEB-HANDOFF.md` cho màn trong slice.
- [ ] Dùng **màu/type** từ `brand/vemoki/tokens.json` only — không sửa JSON palette.
- [ ] Slice 0: tạo `packages/ui`, export `tokens.css` / `tokens.ts` / `antdTheme`; sửa `apps/portal/src/theme/vemoki.ts` import từ package.
- [ ] Mọi empty/loading/error dùng `SurfaceState` hoặc successor trong `@ticket/ui` (role, `aria-live`, min-height 44px).
- [ ] Button: một API `variant` + `size` — không thêm class `.mkt-btn-*` / `.home-cta .button` mới.
- [ ] Focus: giữ `focus-visible` 3px `--focus`.
- [ ] Guest redeem: **không** lộ UUID/đường dẫn dev trên UI ([FE-REFACTOR-GAP-UAT](./FE-REFACTOR-GAP-UAT-2026-10-21.md)).
- [ ] Sau mỗi slice: Playwright 1280×800 + 390×844 + link ảnh trong `docs/reviews/`.
- [ ] **Không** scope creep admin web CSS — staff CRUD → portal.

**Priority screens (visual-identity-v2):** Marketing hero (O13 host), Home catalog, Đổi mã, Ví, Chi tiết vé — implement theo thứ tự slice 2→4.

---

## 5. Tham chiếu

- Gap UAT slice A: [`FE-REFACTOR-GAP-UAT-2026-10-21.md`](./FE-REFACTOR-GAP-UAT-2026-10-21.md)
- Mockup inventory: [`FE-REFACTOR-MOCKUP-INVENTORY-2026-10-21.md`](./FE-REFACTOR-MOCKUP-INVENTORY-2026-10-21.md)
- Prod UAT: [`UAT-PROD-WEB-2026-10-21.md`](./UAT-PROD-WEB-2026-10-21.md)
- Portal UX: [`docs/design/PORTAL-ANTD-UX.md`](../design/PORTAL-ANTD-UX.md)
- Feasibility antd: [`docs/plans/PORTAL-WEB-FEASIBILITY.md`](../plans/PORTAL-WEB-FEASIBILITY.md)
- Live Pulse freeze: [`docs/design/visual-identity-v2/`](../design/visual-identity-v2/)

**Verdict PD:** **Unblock coding** với hướng `@ticket/ui` + migrate slice; **block** big-bang Ant/shadcn trên consumer web cho đến khi coordinator chốt Epic #715 tasks.
