# FE Product Design — Aceternity UI làm nguồn DS v2 cho `apps/web` (Epic #715)

| Trường | Giá trị |
| --- | --- |
| Ngày | 2026-10-22 |
| Role | `product-design` |
| Task | `task_85b902475fdd` |
| Epic | [#715](https://github.com/hangndat/ticket-solution/issues/715) |
| Cost tier | `standard` |
| Architecture impact | **Có** — framework UI + Tailwind pipeline cho `apps/web`; portal **giữ** Ant Design |
| Quyết định user (22/10/2026) | Consumer web: **Aceternity UI** (copy-paste, Tailwind + Motion) làm nguồn component/inspiration; portal prod **không đổi** antd (token theme portal tùy chọn, mặc định freeze) |
| Mockup SoT | [`docs/plans/mobile-production-refactor/web-prototype.html`](../plans/mobile-production-refactor/web-prototype.html) + [`WEB-HANDOFF.md`](../plans/mobile-production-refactor/WEB-HANDOFF.md) (duyệt 20/10/2026) |
| Token SoT | [`brand/vemoki/tokens.json`](../../brand/vemoki/tokens.json) — Live Pulse v2 |
| Báo cáo trước (Radix) | [`FE-PD-DESIGN-SYSTEM-2026-10-22.md`](../../../fe-pd-design-system/docs/reviews/FE-PD-DESIGN-SYSTEM-2026-10-22.md) (worktree `fe-pd-design-system`) — **thay hướng** theo user, không xóa insight kiểm kê |
| Tra cứu tài liệu | Aceternity `llms-full.txt` **2026-10-21**; [ui.aceternity.com](https://ui.aceternity.com); [Motion accessibility](https://motion.dev/docs/react-accessibility) **2026-10-22**; [shadcn components](https://ui.shadcn.com/docs/components) **2026-10-22**; [Tailwind + Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs) **2026-10-22** |

---

## Tóm tắt điều hành

1. **Aceternity ≠ “dán hiệu ứng marketing” lên app vé:** mockup web đã duyệt là UI tiện ích (nav dính, card catalog phẳng, form redeem, vé/QR, gate staff). ~**85% khối** nên là **component nội bộ** trong `packages/ui` (Tailwind + token), chỉ **tham chiếu** Aceternity cho layout/micro-interaction đã **giảm motion**; ~**15%** copy có chọn lọc từ registry Free + **shadcn/ui** cho primitive (dialog, toast, form).
2. **Kiến trúc đề xuất:** `brand/vemoki/tokens.json` → generator CSS vars + `@theme` Tailwind v4 → `packages/ui` (ownership code vendored từ Aceternity/shadcn, **không** dependency runtime `@aceternity/*`). `apps/web` import `@ticket/ui`; **admin web freeze** slice hiện tại; **portal antd giữ nguyên**.
3. **So với `@ticket/ui` + Radix thuần:** Aceternity **nhanh hơn** cho marketing hero và block landing; **kém hơn** cho form/table/a11y mặc định — bù bằng **shadcn + Radix** trong cùng package. **Rủi ro chính:** thêm Tailwind + `motion` bundle, CSP `style-src 'unsafe-inline'` (đã có), và “motion creep” — chốt **motion budget** dưới.

---

## 1. Bản đồ mockup → khối → nguồn component

Legend: **A** = vendored Aceternity Free (chỉnh token + giảm animation); **S** = shadcn/ui (+ Radix); **N** = tự làm trong `packages/ui` (có thể lấy *pattern* từ mockup CSS, không copy hiệu ứng); **—** = không dùng Aceternity; **⛔** = cấm cho product chrome.

| # | Màn / khối (mockup `web-prototype.html`) | Hành vi mockup | Đề xuất | Ghi chú PD |
| --- | --- | --- | --- | --- |
| 1 | **Site header** `.nav` sticky 72px, logo, `.navlinks`, avatar | Role-aware links; active = underline signal | **N** `SiteHeader` | ⛔ `resizable-navbar`, `floating-navbar`, `navbar-menu` (scroll shrink / mega-menu hover) — lệch mock + motion thừa |
| 2 | **Mobile menu** `.mobile-menu` + `.menu` overlay | Full-width sheet links + Đóng | **S** `Sheet` + **N** link list | A11y: focus trap, `aria-expanded`, Esc — Radix Sheet |
| 3 | **Footer** `.footer` | Legal + text links | **N** | Không block Aceternity |
| 4 | **Catalog hero / heading** `.heading`, `.eyebrow` | Title + subtitle, không full-bleed marketing | **N** (+ optional **A** *chỉ* opacity fade từ `hero-sections-free` nếu marketing slice) | Product catalog: **không** `hero-highlight`, `background-beams` |
| 5 | **Search / filter** `.tools`, `.search`, `.chip` | Search + filter chips | **S** `Input` + **N** `FilterChip` | ⛔ `gooey-input`, `placeholders-and-vanish-input` (redeem cần ổn định, WCAG) |
| 6 | **Catalog grid** `.grid` 3→1 cột | Card sự kiện clickable whole card | **N** `CatalogEventCard` | Tham khảo *bố cục* `cards-free` / `bento-grid` **không** dùng skew/3D; ⛔ `3d-card-effect`, `wobble-card`, `focus-cards` (blur láng láng) |
| 7 | **Owned count strip** `.owned` | Nút phụ “Bạn có N vé” | **N** hoặc **S** `Button` variant `link` | Guest ẩn — WEB-HANDOFF |
| 8 | **Event detail** `.cols`, `.heroart`, `.facts`, `.sidebox` | 2 cột + CTA sidebar | **N** `EventDetailLayout` + **S** `Card` | `.art` gradient giữ trong token — không `card-spotlight` |
| 9 | **Breadcrumb** `.bread` | Text back path | **S** `Breadcrumb` hoặc **N** | |
| 10 | **Redeem / auth form** `.form`, `.narrow` | Single code field; guest → login intent | **S** `Field`, `Input`, `Label`, `Button` | **A** `signup-form` chỉ tham khảo spacing — **không** motion submit |
| 11 | **Login / auth gate** `login` page | Form email stub + quay lại redeem | **S** + **N** `AuthGateLayout` | OIDC thật ngoài scope UI |
| 12 | **Wallet** `.ticketgrid`, `.ticket` | Ticket cards + filter chip | **N** `WalletTicketCard` | ⛔ `card-stack`, carousel |
| 13 | **Ticket detail / QR** `.qr`, `.center` | QR placeholder + copy | **N** | QR render app logic |
| 14 | **Account** `.accountcols`, `.accountnav`, `.group`, `.row` | Sidebar + settings rows | **N** (+ **S** `Separator`) | ⛔ Aceternity `sidebar` (hover-expand dock) — mock là list nút đơn giản |
| 15 | **Notice / inline alert** `.notice` | Info panel border-left | **S** `Alert` | |
| 16 | **Gate staff bar** `.gatebar` | Scope event + đổi sự kiện | **N** `GateScopeBar` | Không “tabs” bottom (web) |
| 17 | **Scan** `.camera`, `.line` scan animation | QR frame + scan line | **N** | Animation: CSS only; `prefers-reduced-motion` tắt `.line` (mock đã có) |
| 18 | **Manual / history staff** | Form + table | **S** `Input`, `Table` / **N** responsive card table | Mobile: `data-label` pattern từ mockup |
| 19 | **Admin shell** `.admin`, `.sidebar`, `.stats`, `.tablewrap` | Sidebar + stats + table | **N** (freeze — ít động DS slice 0–4) | Sau slice 5+ nếu unfreeze |
| 20 | **Empty** `.empty` | Centered copy | **N** port `SurfaceState` | Giữ `role`/`aria-live` hiện có (`apps/web/src/ui/surface-state.tsx`) |
| 21 | **Loading** | “Đang tải…” | **S** `Skeleton` / `Spinner` | **A** `loader` (minimal) *tùy chọn* — ưu tiên shadcn `Spinner` |
| 22 | **Error / unknown** | Alert surfaces | **N** `SurfaceState` kind `error`/`unknown` | |
| 23 | **Toast** `.toast` | `role="status"`, auto dismiss | **S** `Sonner` hoặc `Toast` | ⛔ animation fade phức tạp — opacity only + reduced motion |
| 24 | **Dialog / modal** `.modal`, `.dialog` | Confirm / support | **S** `AlertDialog` / `Dialog` | Focus trap Radix |
| 25 | **Segmented device toggle** (chrome mockup reviewer) | Không ship prod | — | Chỉ prototype reviewer |

**Marketing host (`vemoki.com` / O13):** slice riêng — có thể dùng **A** `hero-sections-free`, `background-gradient` *rất nhẹ* + token signal; vẫn tuân visual-notes (một hero composition, không card cluster viewport). **Không** trộn shader Pro vào `app.vemoki.com` product.

---

## 2. Đánh giá component đề xuất (ma trận)

Thang: **Thấp / TB / Cao** cho rủi ro; **Free / Pro / S / N** như trên.

### 2.1 Header & navigation

| Component | Tier | a11y | Contrast Live Pulse | Mobile perf | Độ phức tạp | Phụ thuộc | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **N** `SiteHeader` | — | Cao nếu `<nav>`, skip link, focus ring `--focus` 3px | ink `#0B1220` on paper `#F4F6F8`; signal CTA AA khi dùng primary | Cao (static) | TB | Tailwind, clsx | **Chọn** |
| Aceternity `floating-navbar` | Free | TB — hide/show scroll | Thường zinc/slate mặc định — **phải retheme** | TB (scroll listeners + motion) | Cao | motion | **Không** product |
| Aceternity `resizable-navbar` | Free | TB | Retheme | TB | Cao | motion | **Không** |
| shadcn `NavigationMenu` | S | Cao | Token vars | Cao | TB | Radix | Dự phòng mega-menu (không cần mockup) |

### 2.2 Catalog & cards

| Component | a11y | Contrast | Mobile perf | Free/Pro | Verdict |
| --- | --- | --- | --- | --- | --- |
| **N** `CatalogEventCard` | Whole-card `<button>` hoặc link + visible focus | Art placeholder: white on dark art OK; text ink/muted derived | Cao | — | **Chọn** |
| Aceternity `cards-free` | TB | Retheme | TB–Cao tùy variant | Free | **Tham khảo layout** |
| `3d-card-effect`, `wobble-card`, `glare-card` | Thấp (transform hover) | Glare giảm contrast | Thấp | Free | **⛔** |
| `apple-cards-carousel` | TB carousel a11y | — | Thấp | Free | **⛔** catalog |

### 2.3 Forms & redeem

| Component | a11y | Contrast | Mobile perf | Verdict |
| --- | --- | --- | --- | --- |
| shadcn `Input` + `Label` + `Field` | Cao (native + Radix label) | Border `#d7dfe9` → map `--line` derived | Cao | **Chọn** |
| Aceternity `signup-form` | TB (dựa shadcn) | Retheme | TB | Chỉ **copy structure** |
| `gooey-input`, `placeholders-and-vanish-input` | Thấp (motion che placeholder) | TB | Thấp | **⛔** |

### 2.4 Tabs & gate

| Component | a11y | Contrast | Verdict |
| --- | --- | --- | --- |
| shadcn `Tabs` | Cao (Radix roving tabindex) | Token | **Chọn** nếu cần tab nội bộ trang |
| Aceternity `tabs` (animated background) | TB | Retheme | **Không** — layout animation mỗi đổi tab; mock web gate dùng **bar** không phải tabs |
| **N** `GateScopeBar` | `aria-live` cho trạng thái cổng | paper/signal subtle | **Chọn** staff |

### 2.5 Wallet & account

| Component | Verdict |
| --- | --- |
| **N** `WalletTicketCard` | Khớp mock `.ticket` |
| Aceternity `sidebar` | **Không** — hover expand, dark marketing shell |
| shadcn `Sidebar` | Chỉ nếu sau này admin unfreeze cần collapse — không slice 1–4 |

### 2.6 Feedback (empty / loading / error / toast / dialog)

| Component | a11y | Verdict |
| --- | --- | --- |
| **N** `SurfaceState` (migrate vào `@ticket/ui`) | `role=status|alert`, `aria-live` — đã có | **Giữ** |
| shadcn `Skeleton`, `Spinner`, `AlertDialog`, `Toast` | Radix/WAI patterns | **Chọn** |
| Aceternity `multi-step-loader`, `image-generation-loader` | Thấp (canvas) | **⛔** product |
| Aceternity `loader` (minimal) | TB | Optional marketing only |

### 2.7 a11y chéo (bắt buộc implement)

| Yêu cầu | Quy ước |
| --- | --- |
| Keyboard | Mọi interactive: tab order logic; mobile menu Sheet trap |
| Focus | `focus-visible` ring **3px** `--focus` `#2563EB` (mock + tokens) |
| ARIA | Nav `aria-current`; toast `role="status"`; error `role="alert"` |
| Reduced motion | `MotionConfig reducedMotion="user"` ([Motion docs](https://motion.dev/docs/react-accessibility), 2026-10-22); CSS `@media (prefers-reduced-motion: reduce)` như mock |
| Contrast | Text chính ink on paper ≥ **4.5:1**; signal button white on `#E11D48` — verify AA (large text OK) |
| i18n VI | Copy từ mockup/handoff; không hardcode EN trong primitives |
| Touch | `min-height` 44px (mock `.primary`, buttons) |

---

## 3. Quy ước ownership & token (Aceternity → `packages/ui`)

### 3.1 Nguyên tắc

1. **Aceternity chỉ là nguồn copy-paste** vào `packages/ui/src/...` — rename prefix `Vemoki` / `@ticket/ui`; **không** import từ CDN/registry lúc runtime.
2. **Giấy phép:** Free components — commercial use OK; **cấm** republish nguyên thư viện Aceternity như competitor ([licence](https://ui.aceternity.com/licence), ref. llms-full 2026-10-21). Pro blocks/templates **không** dùng trừ khi user mua license riêng — mặc định **Free + shadcn only**.
3. **CLI:** `npx shadcn@latest add @aceternity/<name>` chỉ dùng **lần đầu** để pull source vào monorepo; commit vào `packages/ui`, sau đó sửa tay.

### 3.2 Token → Tailwind v4 + CSS vars

```text
brand/vemoki/tokens.json
  → scripts hoặc packages/ui/tokens/build.ts
  → packages/ui/styles/tokens.css   (:root --ink, --paper, --signal, --focus + derived)
  → packages/ui/styles/theme.css    (@theme { --color-ink: var(--ink); ... })
  → apps/web/app/globals.css         (@import "@ticket/ui/tokens.css"; coexist legacy classes slice 0)
```

- **Không invent palette** — derived muted/line từ ink/paper như `globals.css` / mockup (`--muted`, `--line`).
- Typography: **Sora** display, **Be Vietnam Pro** body (`next/font` trong `apps/web`).

### 3.3 Variant / size / state

| Primitive | Variants | Sizes | States |
| --- | --- | --- | --- |
| `Button` | `primary` (signal), `secondary`, `destructive`, `ghost`, `link` | `sm`, `md` (default 44px), `lg` | hover, focus-visible, disabled, loading |
| `Input` | default, error | md (46px mock) | focus, disabled, `aria-invalid` |
| `Card` | elevated, outline | — | — |
| `SurfaceState` | empty, loading, error, unknown | — | aria-busy loading |

API: `class-variance-authority` (shadcn convention) + `cn()` (`clsx` + `tailwind-merge`).

### 3.4 Motion budget (product `app.vemoki.com`)

| Màn | Hiệu ứng cho phép | Max duration | Budget / màn |
| --- | --- | --- | --- |
| Catalog / detail / wallet | Hover opacity/color only | 150ms | ≤1 |
| Redeem success | Opacity fade-in ticket | 200ms | 1 |
| Sheet menu | Slide hoặc opacity (reduced → opacity) | 200ms | 1 |
| Scan line | CSS alternate (staff) | 1.9s loop | 1 — **tắt** khi reduced-motion |
| Marketing | Hero fade plane | 300ms | ≤2 |

**Cấm product:** `background-beams`, `background-lines`, `3d-marquee`, parallax scroll, `container-scroll-animation`, shader Pro, mousemove tilt cards, `evervault-card`, `glowing-stars-effect`.

Wrap client islands: `MotionConfig reducedMotion="user"` trong `apps/web` provider (client boundary).

### 3.5 CSP & RSC

- CSP hiện tại (`apps/web/next.config.ts`, #653): `style-src 'unsafe-inline'`, `script-src 'self' 'unsafe-inline'` prod — Tailwind build **không** cần inline script thêm; **tránh** runtime `style={{}}` từ motion trên server components.
- Pattern: **Server** layout + data; **Client** chỉ primitives có `motion` / Radix.
- `Permissions-Policy` camera=() — staff scan slice phải **document** exception khi triển khai (ngoài PD).

### 3.6 Phụ thuộc dự kiến (`packages/ui`)

| Package | Mục đích |
| --- | --- |
| `tailwindcss`, `@tailwindcss/postcss` | Styling pipeline (app + package) |
| `motion` | Chỉ client components được phép animate |
| `clsx`, `tailwind-merge` | `cn()` |
| `class-variance-authority` | Variants |
| `@radix-ui/react-*` | Dialog, tabs, slot… (qua shadcn) |
| `lucide-react` (optional) | Icon thống nhất — hoặc giữ SVG inline mockup style |

**Không** thêm: `three`, `@react-three/fiber` (trừ khi marketing 3D riêng — mặc định không).

---

## 4. So sánh phương án

| Tiêu chí | Aceternity-led + `packages/ui` + shadcn (đề xuất user) | `@ticket/ui` + Radix + CSS vars (báo cáo trước) | shadcn/ui thuần (không Aceternity) |
| --- | --- | --- | --- |
| Khớp mockup tiện ích | **Cao** nếu **tự làm** pattern; Aceternity chỉ tăng tốc marketing | **Cao** — cùng cách “compose primitives” | **Cao** |
| Tốc độ có landing đẹp | **Cao** (hero blocks Free) | Thấp — tự build | TB |
| a11y form/table/dialog | **Cao** (nhờ shadcn/Radix) | **Cao** | **Cao** |
| Bundle / mobile | **TB** — phụ thuộc số file `motion` import | **Cao** hơn (ít animation) | TB |
| Rủi ro “hiệu ứng lạ” | **Cao** nếu không gate PD | Thấp | Thấp |
| Portal reuse | Token only (antd freeze) | Token + antd theme generator | Token only |
| Chi phí migrate `globals.css` | **Cao** (Tailwind + coexist) | TB–Cao | Cao |
| License | Free tier OK; Pro optional | MIT | MIT |

**Kết luận PD:** Giữ **đích** báo cáo Radix (`packages/ui`, token SoT, slice migrate) nhưng **đổi nguồn cảm hứng/copy** sang Aceternity **có kiểm soát** + **bắt buộc** shadcn cho application primitives. Đây là **Aceternity + shadcn hybrid**, không phải “all Aceternity”.

---

## 5. Lộ trình slice & ước lượng

Giả định **1 FE worker** familiar Next 16; không gồm OIDC/BE. Admin web **freeze** đến slice 4.

| Slice | Phạm vi | Deliverable | Ước lượng (ngày làm việc) |
| --- | --- | --- | --- |
| **0 — Pipeline** | Tailwind v4 + PostCSS trong `apps/web`; `packages/ui` scaffold; token build từ `tokens.json`; `@import` coexist `globals.css`; `components.json` shadcn + registry `@aceternity`; Storybook optional | CI typecheck/lint pass; không đổi UI prod | **3–5** |
| **1 — Primitives** | Button, Input, Label, Card, Alert, Skeleton, `cn`, `SurfaceState` move; MotionConfig | Storybook hoặc 1 page dev `/design-system` internal | **4–6** |
| **2 — Chrome** | `SiteHeader`, footer, mobile Sheet menu, focus/skip link | Parity mockup nav guest/staff/admin paths | **5–7** |
| **3 — Catalog + event** | `CatalogEventCard`, grid, search, detail 2-col, owned strip | `/` + event detail vs mockup | **7–10** |
| **4 — Redeem + wallet + account** | Forms, wallet cards, QR layout, account sidebar | `/redeem`, wallet, account | **8–12** |
| **5 — Gate staff** | GateScopeBar, scan/manual/history, toast/dialog, table→card mobile | Staff routes; camera policy doc | **6–9** |

**Tổng ballpark:** **33–49** ngày làm việc (song song QA/UAT + review). Portal: **0** slice UI (giữ antd).

### 5.1 Checklist handoff FE

- [ ] Đọc `WEB-HANDOFF.md` + mở `web-prototype.html` (desktop + mobile class)
- [ ] Pin dependency: `next@16.4.2`, `react@19.3.1`, `motion` (version từ Aceternity doc khi add), Tailwind v4 theo [hướng dẫn Next](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [ ] Token build không lệch `brand/vemoki/tokens.json`
- [ ] Mọi Aceternity pull: ghi `// vendored from @aceternity/<name> YYYY-MM-DD` + diff giảm motion
- [ ] `prefers-reduced-motion` + `MotionConfig reducedMotion="user"`
- [ ] Không thêm CTA login trùng trên event card; guest ẩn wallet nav
- [ ] Redeem auth intent quay lại task (handoff)
- [ ] Giữ / port `SurfaceState` a11y
- [ ] CSP: không widen; client-only cho motion
- [ ] i18n VI; `min-height` 44px touch targets
- [ ] Visual regression: so [`FE-REFACTOR-GAP-UAT`](./FE-REFACTOR-GAP-UAT-2026-10-21.md) + mockup
- [ ] Reviewer ≠ implementer; exact SHA DoD

### 5.2 Rủi ro

| Rủi ro | Mức | Mitigation |
| --- | --- | --- |
| Motion creep / chóng mặt | Cao | Motion budget §3.4; PD review mỗi PR component |
| Tailwind + 3.4k dòng `globals.css` xung đột | Cao | Slice 0 coexist; xóa class theo route |
| Bundle `motion` trên mobile | TB | Import cục bộ; lazy client; ít animated components |
| Aceternity default palette lệch Live Pulse | TB | Token-only colors; forbid zinc defaults in PR |
| Dev copy Aceternity Pro vào repo | TB | Legal review; chỉ Free registry |
| Admin monolith 2k+ lines | TB | Freeze đến slice 5 |
| CSP nonce (#653) | TB | Không block Tailwind; tránh inline script mới |
| Portal drift brand | Thấp (freeze) | Optional: `vemoki.ts` từ token sau epic |

---

## 6. Ảnh / tham chiếu

| Loại | Đường dẫn |
| --- | --- |
| Mockup tương tác (SoT) | [`docs/plans/mobile-production-refactor/web-prototype.html`](../plans/mobile-production-refactor/web-prototype.html) |
| Prod vs mock gap (UAT) | [`docs/reviews/FE-REFACTOR-GAP-UAT-2026-10-21.md`](./FE-REFACTOR-GAP-UAT-2026-10-21.md), `assets/fe-refactor-gap-2026-10-21/` |
| Kiểm kê prod guest | [`docs/reviews/assets/FE-PD-DESIGN-SYSTEM-2026-10-22/`](./assets/FE-PD-DESIGN-SYSTEM-2026-10-22/) (worktree `fe-pd-design-system` hoặc sync path) |
| Aceternity registry (online) | Ví dụ nav: [Resizable Navbar](https://ui.aceternity.com/components/resizable-navbar) (**tham khảo — không dùng product**); primitives: [shadcn via signup-form](https://ui.aceternity.com/components/signup-form) |
| Visual identity freeze | [`docs/design/visual-identity-v2/visual-notes.md`](../design/visual-identity-v2/visual-notes.md) |

*Không chụp screenshot Aceternity trong session này — dùng mockup đã duyệt + link registry chính thức.*

---

## 7. Tham chiếu kỹ thuật repo (read-only)

| Tài nguyên | Ghi chú |
| --- | --- |
| `apps/web/package.json` | Next **16.4.2**, React **19.3.1**, chưa Tailwind |
| `apps/web/src/ui/surface-state.tsx` | Pattern empty/loading/error — migrate `@ticket/ui` |
| `apps/web/next.config.ts` | CSP ADR-20; `unsafe-inline` script (#653) |
| `apps/portal` | antd **6.6.6** — **không đổi** theo user |
| Báo cáo Radix trước | Insight kiểm kê §1 vẫn valid; khuyến nghị §3 thay bằng hybrid Aceternity+shadcn |

---

## 8. Quyết định cần Architect (không chặn PD)

1. Vị trí package: `packages/ui` vs `packages/web-ui` (monorepo naming).
2. Storybook vs internal route cho visual QA.
3. Thời điểm portal `vemoki.ts` sync token (optional).

---

*Báo cáo docs-only — không thay `apps/*`, không commit. Epic #715 — design system v2 consumer web theo hướng Aceternity có kiểm soát.*
