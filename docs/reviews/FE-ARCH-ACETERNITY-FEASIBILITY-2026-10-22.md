# FE Architect — Khả thi Aceternity UI cho `apps/web` (Epic #715)

| Trường | Giá trị |
| --- | --- |
| Ngày | 2026-10-22 |
| Role | `architect` — [`docs/agents/roles/architect.md`](../agents/roles/architect.md) |
| Task | `task_fc9e8f764965` |
| Epic | [#715](https://github.com/hangndat/ticket-solution/issues/715) (design system v2 follow-up) |
| Cost tier | `standard` |
| Architecture impact | **Có** — framework UI / styling cho consumer `apps/web` |
| Source SHA (worktree) | `ad369787fb0712a0679651a7f6d50b7fc191b627` (`hangndat/fe-arch-aceternity`) |
| Quyết định user (22/10/2026) | Consumer web: **Aceternity UI** (copy-paste, Tailwind + Motion); **portal giữ Ant Design**, không đổi stack |
| Đối chiếu PD | [`FE-PD-DESIGN-SYSTEM-2026-10-22`](../../fe-pd-design-system/docs/reviews/FE-PD-DESIGN-SYSTEM-2026-10-22.md) đề xuất `@ticket/ui` + Radix — **nghiên cứu lại** theo hướng user chọn |
| Mockup / handoff | `docs/plans/mobile-production-refactor/web-prototype.html`, `WEB-HANDOFF.md` |
| Token SoT | `brand/vemoki/tokens.json` (Live Pulse v2) |
| Phạm vi task | **Docs-only** — không sửa `apps/*`, không commit |

---

## Tóm tắt điều hành

**Kết luận: GO có điều kiện** — đưa Aceternity UI vào `apps/web` **khả thi** nếu coi đây là **nguồn component copy-paste + Tailwind utilities**, không phải dependency runtime; **cô lập Tailwind v4 + PostCSS chỉ trong `apps/web`**; **không** chia sẻ toolchain với `apps/portal` (antd). Điều kiện bắt buộc: (1) migrate **theo slice** từ mockup đã duyệt, giữ `globals.css` legacy trong `@layer` / CSS modules cho đến khi thay thế; (2) **tắt hoặc không bật Preflight** Tailwind trên surface đã có reset Vemoki (~3.4k dòng) để tránh regress typography/list; (3) **LazyMotion + `MotionConfig`** (`reducedMotion: "user"`, `nonce` khi siết CSP); (4) chấp nhận **`style-src 'unsafe-inline'`** trong giai đoạn CSP (Motion + `style={rootVars}` trên `<html>` + antd portal parity) — siết nonce script/style là **wave riêng** sau wiring `proxy.ts` + layout (#653); (5) **không** tạo `packages/ui` bắt buộc ngay — có thể `apps/web/src/components/aceternity/` + `cn()` local; package shared chỉ khi ≥2 consumer cần cùng primitive. **Portal: NO CHANGE** (antd 6.6.6, CSP riêng process).

---

## 1. Tailwind (v4) cùng `globals.css` & monorepo

### 1.1 Hiện trạng (SHA trên)

| Hạng mục | Evidence |
| --- | --- |
| Tailwind / Motion trong repo | **Không** — `grep package.json` toàn monorepo: không `tailwindcss`, không `motion` |
| `apps/web` styling | `app/globals.css` **3447** dòng; `:root` map ink/paper/signal/focus khớp `tokens.json`; CSS modules (vd. `redeem-surface.module.css`) |
| Next / React | `next@16.4.2`, `react@19.3.1` (`apps/web/package.json`) |
| Monorepo | `pnpm-workspace.yaml`: `apps/*`, `packages/*`; **không** có `packages/ui` |
| Portal | `antd@6.6.6`, **không** Tailwind — giữ nguyên |

### 1.2 Tailwind CSS v4 + Next.js 16 (tài liệu chính thức)

| Nguồn | Ngày tra | Nội dung áp dụng |
| --- | --- | --- |
| [Install Tailwind with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs) | 2026-10-22 | `@tailwindcss/postcss` + `postcss.config.mjs`; `@import "tailwindcss";` trong `globals.css` |
| [Preflight](https://tailwindcss.com/docs/preflight) | 2026-10-22 | Preflight reset margin, heading unstyled, list unstyled — **xung đột** với nav/typography/list đã định nghĩa trong `globals.css` |
| Aceternity [llms-full.txt](https://ui.aceternity.com/llms-full.txt) | generated **2026-10-21** | Stack: Next.js, React, **Tailwind CSS**, **Motion**; copy-paste / shadcn CLI; không runtime package Aceternity |

**Khuyến nghị kỹ thuật (migrate dần):**

```css
/* apps/web/app/globals.css — thứ tự đề xuất (draft) */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
/* KHÔNG import preflight trên product surface đã có reset Vemoki */
@import "tailwindcss/utilities.css" layer(utilities);
/* Legacy Live Pulse: giữ file hiện tại trong @layer components { … } hoặc tách file import sau */
```

- Map token: `@theme { --color-ink: #0B1220; … }` từ `brand/vemoki/tokens.json` — **không invent palette**.
- **Prefix** `prefix(tw)` (Tailwind v4) nếu cần tránh collision class `.container`, `.button` legacy.
- **Chỉ** khai báo `tailwindcss`, `@tailwindcss/postcss` trong `apps/web/package.json` — **không** root workspace, **không** `apps/portal`.
- **Turbo**: thêm task `build`/`dev` web phụ thuộc PostCSS; không đổi pipeline portal/api.

### 1.3 `packages/ui` (tsup / exports / RSC) — nếu sau này cần

Hiện **chưa có** package. PD doc đề xuất `@ticket/ui`; với Aceternity, **ưu tiên sở hữu code trong `apps/web`** (đúng mô hình copy-paste).

| Rủi ro | Mitigation |
| --- | --- |
| Server Component import module `'use client'` → SSR crash | Quy ước: **mọi** file Aceternity/Motion = `'use client'`; barrel `index.ts` **không** re-export client từ server; page RSC chỉ `import { Hero } from './hero-client'` (client boundary file riêng) |
| tsup dual package | Nếu tạo `packages/ui`: `exports` tách `"./client"` vs `"./tokens"` (chỉ CSS vars/types, không React); build `tsc` như `@ticket/contracts` cho phần token-only |
| shadcn monorepo | [shadcn Next monorepo](https://ui.shadcn.com/docs/installation/next) (2026-10-22): component trong `apps/web` hoặc `@workspace/ui` — **chỉ** khi web + app khác dùng chung; portal **không** tham gia |

**Đối chiếu PD:** thay Radix-first primitives bằng **Aceternity + (tùy chọn) shadcn registry** cho consumer; vẫn có thể package **`@ticket/tokens`** mỏng (JSON → CSS vars) **không** Tailwind — portal antd theme generator đọc sau, **out of scope** consumer Aceternity.

---

## 2. CSP (`proxy.ts`, #653, Motion, Tailwind, `next/font`)

### 2.1 Hiện trạng CSP web

- `apps/web/next.config.ts` → `contentSecurityPolicy()`; áp qua `apps/web/proxy.ts` (`withRuntimeCsp`).
- Prod: `script-src 'self' 'unsafe-inline'`; `style-src 'self' 'unsafe-inline'`; **không** `nonce-` / `strict-dynamic` (`tests/csp-nonce-feasibility.test.ts`, Issue **#653** — defer có chủ đích, xem `MPR-PR655-REVIEW-2026-10-21.md`).
- Portal: CSP tương tự + comment antd css-in-js (`apps/portal/next.config.ts`).

### 2.2 Phát sinh inline khi thêm Aceternity / Motion / Tailwind

| Nguồn | Loại | `style-src` / `script-src` |
| --- | --- | --- |
| **Tailwind v4 JIT** | File CSS build (`/_next/static/css/…`) | `'self'` — OK |
| **`next/font/local`** | Class CSS variables trên `<html>` (`layout.tsx` L76–78) | OK (stylesheet) |
| **`style={rootVars}`** trên `<html>` (`layout.tsx` L80) | **Thuộc tính `style` inline** | Cần **`'unsafe-inline'`** trong `style-src` (nonce **không** áp attribute style — [MDN style-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/style-src)) |
| **Motion** animate | Thuộc tính `style` động trên DOM | Cùng — **`'unsafe-inline'`** cho `style-src` |
| **Motion** `<style>` inject (PopChild, v.v.) | Thẻ `<style>` | `MotionConfig` **`nonce`** khớp CSP khi bỏ broad inline cho **thẻ** style — [motion.dev MotionConfig](https://motion.dev/docs/react-motion-config) (tra 2026-10-22); merged PR motion **11.0.9+** |
| **Next 16 hydration** | Inline script | Vẫn cần `'unsafe-inline'` script hoặc nonce wiring toàn layout (#653) |

**Kết luận CSP:** Mục tiêu **bỏ `unsafe-inline` script** vẫn là **program riêng** (proxy generate nonce → `headers()` / middleware → layout `nonce` prop). Với Aceternity/Motion, **`style-src` không thể “nonce-only” thuần** mà vẫn giữ animation + tenant `rootVars` — tối thiểu giữ **`'unsafe-inline'`** cho `style-src` (giống portal antd) **hoặc** refactor branding sang class/CSS vars chỉ trên stylesheet (giảm attribute inline, không xóa hết Motion). **Không** spike commit vào `apps/web`; policy hiện tại **đủ** cho pilot Aceternity nếu không siết CSP.

### 2.3 `proxy.ts` và nonce (thiết kế wave sau)

1. `proxy.ts`: `crypto.randomUUID()` → header `x-nonce` nội bộ + `Content-Security-Policy` động.
2. Root layout (server): `headers().get('x-nonce')` — **cân nhắc** comment `layout.tsx` O13 (tránh `headers()` buộc dynamic toàn app); có thể nonce chỉ marketing/product tách layout.
3. bọc `MotionConfig` + `ThemeProvider` client với `nonce`.
4. Cập nhật `csp-nonce-feasibility.test.ts` khi bật.

---

## 3. Bundle, hiệu năng, RSC, `prefers-reduced-motion`

### 3.1 Spike bundle (local, không commit)

Thư mục: `/tmp/aceternity-feasibility-spike-1792637553` (2026-10-22). Tool: `esbuild@0.25.10` bundle minify, `react`/`react-dom` external.

| Cấu hình | Kích thước JS (min, React external) |
| --- | --- |
| `motion/react` **LazyMotion** + `domAnimation` | **77 018 B (~75 KiB)** |
| `motion/react` **motion** full | **124 065 B (~121 KiB)** |
| `tailwindcss@4.1.14` CLI min (theme + utilities, token mẫu) | **4 098 B CSS** (chưa cộng utilities theo page) |
| `clsx` + `tailwind-merge` (cùng bundle spike) | << Motion (included in rows above) |

**Khuyến nghị:** `LazyMotion` + `domAnimation` trên catalog/event; tránh import barrel `motion` full trên RSC layout. Ước lượng **+75–120 KiB gzip ~25–40 KiB** client trên route có animation — chấp nhận được cho hero/catalog nếu **code-split** theo route (`next/dynamic`).

### 3.2 LCP / INP (mobile)

| Rủi ro | Mitigation |
| --- | --- |
| LCP (hero, font) | Giữ `next/font/local` + `display: swap`; animation **không** che LCP text (animate opacity sau paint; tránh layout thrash) |
| INP | Giảm listener pointer trên list dài; catalog grid đã CSS-heavy — ưu tiên CSS `transform`/`opacity` qua Motion |
| Hydration | Aceternity = client islands; **không** wrap toàn page `motion` — giữ RSC cho data/catalog shell |
| `prefers-reduced-motion` | `MotionConfig reducedMotion="user"`; mirror pattern `globals.css` (≥5 block) + `redeem-surface.module.css` L210–214; **bắt buộc** trong component Aceternity port |

### 3.3 Đo production (follow-up implementation)

- Playwright + `web-vitals` injection trên `scripts/web-uat.mjs` hoặc Lighthouse CI — baseline **trước** Aceternity trên `/` catalog (mobile 390×844).
- So sánh JS chunk `_next/static/chunks/` sau `next build` (route `/` only).

---

## 4. Next 16 / React 19, phiên bản, supply chain, license

### 4.1 Tương thích

| Package | Phiên bản spike / pin đề xuất | Ghi chú |
| --- | --- | --- |
| `motion` | `12.x` (spike `12.23.24`) | Aceternity docs: “Motion (formerly Framer Motion)” — import `motion/react` |
| `tailwindcss` + `@tailwindcss/postcss` | `4.1.x` (spike `4.1.14`) | Khớp hướng dẫn Next official |
| `clsx`, `tailwind-merge` | `2.x` / `3.x` | Chuẩn Aceternity/shadcn `cn()` |
| React / Next | **19.3.1** / **16.4.2** | Khớp repo; Aceternity marketing ghi Next 15+ — verify từng component khi paste |

### 4.2 Supply chain

- **Aceternity UI**: không dependency npm — code **vendor vào git** sau copy; review từng file (eval, external URL).
- **Runtime deps mới**: `motion`, `tailwindcss`, `clsx`, `tailwind-merge` — 4 package, audit `pnpm audit`, pin exact trong `apps/web`.
- **Bảo trì**: Aceternity cập nhật thường xuyên; team sở hữu diff. Pro blocks = snapshot tại thời điểm mua.

### 4.3 License (tra cứu 2026-10-22)

| Tier | Quyền | Cấm |
| --- | --- | --- |
| **Free** ([llms-full.txt](https://ui.aceternity.com/llms-full.txt), [licence](https://ui.aceternity.com/licence)) | Unlimited personal/commercial; sửa source | Resell/redistribute as competing library/template |
| **Pro / All-Access** ([pricing](https://ui.aceternity.com/pricing)) | $169/1y, $199 lifetime, team $1590 — blocks/templates | Redistribution source; marketplace resale |

Vemoki commercial OK với free components; Pro cần purchase nếu dùng premium blocks — **legal** lưu receipt + không commit credentials registry.

---

## 5. Test / UAT / visual regression

| Công cụ hiện có | Cách dùng cho Aceternity |
| --- | --- |
| `scripts/web-uat.mjs` + Playwright **1.56.1** | Baseline PNG `1280×800` / `390×844` vào `docs/reviews/assets/<slug>/` — pattern PD doc |
| `apps/web/tests/*.test.ts` | Giữ CSP feasibility; thêm test **không** import client từ server (lint rule / `tsc` path) |
| axe-core (devDep web) | a11y trên slice mới — focus order, contrast token Live Pulse |
| Storybook | **Chưa có** — không bắt buộc wave 1; có thể slice 2 |

**Visual regression đề xuất:** thư mục `docs/reviews/assets/FE-ACETERNITY-<date>/`; diff pixel (Playwright `toHaveScreenshot` hoặc external reg-cli); **không** chặn CI wave 1 — manual gate trước merge catalog.

---

## 6. Portal — đảm bảo không đổi

| Kiểm tra | Kết quả |
| --- | --- |
| Thêm Tailwind root / shared `packages/ui` with Tailwind | **Cấm** trong wave Aceternity consumer |
| `apps/portal/package.json` | Chỉ antd stack — **không đổi** |
| CSP portal | Process riêng — không gộp policy web |
| Token theme antd (`vemoki.ts` lệch v2) | **Ngoài scope** task này (PD đã ghi); không blocker Aceternity web |

---

## 7. Phương án so sánh & đối chiếu PD

| Phương án | Fit mockup consumer | Portal | CSP / RSC | Chi phí migrate |
| --- | --- | --- | --- | --- |
| **A. Giữ status quo** (`globals.css` only) | TB — gap mockup còn | Không đổi | Dễ nhất | Thấp — **không** đạt mục tiêu user |
| **B. PD: `@ticket/ui` + Radix, CSS vars** | Cao | Token share, antd giữ | RSC-first, ít Motion | TB–cao |
| **C. User: Aceternity + Tailwind v4 (đề xuất)** | **Cao** (animated marketing/catalog) | **Tách biệt** | Motion + style inline; Tailwind CSS file | Cao nhưng **theo slice** |
| **D. Ant Design lên web** | Thấp | Đồng bộ staff | nặng bundle consumer | Cao — **loại** |

**Chọn C** với điều kiện mục tóm tắt; **kế thừa B** phần token SoT (`tokens.json`) và pattern `SurfaceState` / a11y, **không** bắt Radix trước Aceternity.

---

## 8. ADR draft (chưa tạo file `docs/ops/` — chờ coordinator cấp ID)

```markdown
# ADR-XX (draft): Consumer web UI — Aceternity copy-paste + Tailwind v4 scoped

**Trạng thái:** Đề xuất  
**Ngày:** 2026-10-22  
**Liên quan:** Epic #715, Issue #653 (CSP), ADR-20 (portal tách process)

## Quyết định

- `apps/web` adopt **Aceternity UI** (free copy-paste; Pro nếu mua) với **Tailwind CSS v4** chỉ trong app web.
- `apps/portal` **giữ Ant Design 6** — không Tailwind, không Aceternity.
- Component Aceternity sống trong repo (`apps/web/src/components/…`), `'use client'` boundary nghiêm.
- Motion: **LazyMotion** + `MotionConfig` (reduced motion + nonce khi CSP siết).

## Hệ quả

- (+) Tốc độ UI consumer, khớp mockup animated, ít dependency “framework”.
- (+) Portal không bị ảnh hưởng build/CSS.
- (−) Hai hệ styling (web Tailwind vs portal antd).
- (−) `globals.css` legacy song song đến hết migrate slice.
- (−) CSP `style-src unsafe-inline` tiếp tục trong giai đoạn 1.

## Phương án thay thế

- `@ticket/ui` + Radix (PD 2026-10-22) — từ chối làm **primary** theo user 22/10; có thể dùng shadcn **cùng** Aceternity registry.
- Ant Design trên consumer — từ chối.

## Rollback

- Revert slice PR (xóa component Aceternity + deps `motion`/Tailwind nếu slice cuối).
- Giữ `globals.css` làm SoT styling cho đến khi migrate xong — không xóa legacy trước parity UAT.
```

---

## 9. Danh sách spike đã chạy

| ID | Mô tả | Lệnh / path | Kết quả số đo |
| --- | --- | --- | --- |
| S1 | Bundle Motion Lazy vs full | `/tmp/aceternity-feasibility-spike-1792637553/bundle-spike.mjs` | **77 018 B** vs **124 065 B** min (React external) |
| S2 | Tailwind v4 CSS footprint tối thiểu | `tailwindcss -i input.css -o out-tailwind.css --minify` | **4 098 B** CSS (theme + utilities, chưa page classes) |
| S3 | Preflight + legacy reset | Cùng spike, import tailwind sau reset `*`/`body` | Build OK; **khuyến nghị tắt preflight** thay vì chồng |
| S4 | Đọc CSP/code | `apps/web/proxy.ts`, `next.config.ts`, `layout.tsx` | Xác nhận `unsafe-inline` prod + inline `style` branding |

**Chưa chạy (implementation task):** `next build` diff chunk catalog; Lighthouse mobile trước/sau; E2E screenshot diff post-component.

---

## 10. Handoff coordinator / planner

| Story đề xuất | Owner | Dependency |
| --- | --- | --- |
| Tailwind v4 toolchain **chỉ** `apps/web` + `@theme` từ `tokens.json` | Web | — |
| Slice 1: catalog card/hero Aceternity (1 route) | Web | Tailwind toolchain |
| `MotionConfig` provider client + reduced motion | Web | Slice 1 |
| ESLint boundary server/client cho `components/aceternity` | Web / coordinator CI | — |
| CSP nonce wave (#653 follow-up) | Web + security review | Không blocker pilot Aceternity |
| Visual baseline Playwright | Web | Slice 1 merge |
| Portal antd theme từ tokens | Portal (optional) | **Không** phụ thuộc Aceternity |

**Xác minh cần thu trước “acceptance complete”:** UAT mockup parity (FE-REFACTOR-GAP), axe trên slice, bundle budget agreed (vd. +40 KiB gzip route `/`), CI `pnpm --filter @ticket/web check` xanh.

---

## 11. Kết luận architect

| Verdict | **Đủ để triển khai trong scope** — **GO có điều kiện** |
| --- | --- |
| Blocker | Không có blocker kiến trúc **nếu** tuân cô lập portal + preflight + LazyMotion + migrate slice |
| Cần làm rõ (user/coordinator) | Dùng **Pro** blocks nào; có tạo `packages/ui` hay chỉ `apps/web/src/components` |
| Pilot ready | **Không** — cần implementation + UAT + CI |

---

## Tài liệu tham chiếu (phiên bản / ngày)

- Aceternity UI: https://ui.aceternity.com/llms-full.txt (2026-10-21 generated), https://ui.aceternity.com/licence, https://ui.aceternity.com/pricing (2026-10-22)
- Tailwind CSS v4 Next + Preflight: tailwindcss.com (2026-10-22)
- shadcn/ui Next: ui.shadcn.com/docs/installation/next (2026-10-22)
- Motion `MotionConfig` nonce: motion.dev/docs/react-motion-config (2026-10-22)
- Repo: `apps/web/next.config.ts`, `apps/web/proxy.ts`, `apps/web/app/layout.tsx`, `apps/web/tests/csp-nonce-feasibility.test.ts`, `brand/vemoki/tokens.json`
