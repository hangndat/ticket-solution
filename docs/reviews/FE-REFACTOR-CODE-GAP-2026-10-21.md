# FE refactor — gap audit: `apps/web` vs mockup web (2026-10-21)

| Trường | Giá trị |
| --- | --- |
| Task | `task_2660070a0944` · Slice B read-only audit |
| Mockup SoT | `/Users/admin/orca/workspaces/main/fix-prod-redeem-gate-1021/docs/plans/mobile-production-refactor/web-prototype.html` |
| Handoff | Cùng thư mục: `WEB-HANDOFF.md` (đã duyệt 20/10/2026) |
| Code tree | `apps/web` @ worktree `FE-refactor` (branch `hangndat/FE-refactor`) |
| Tip đối chiếu | `9515c980db4185c8109fe648204036e3e0e56fb1` |
| Phạm vi audit | Token/CSS/font/nav/layout/component — **không** đổi `apps/*`, không commit |

**Tóm tắt:** Brand token **màu + font Live Pulse v2** trong code đã khớp `brand/vemoki/tokens.json`; lệch mockup chủ yếu ở **scale type**, **radius/border**, **shell responsive**, **bố cục catalog/detail/wallet**, và **chrome ops** (admin/gate/redeem) so với mockup “sản phẩm”. Mockup HTML dùng system font và class tiện ích — **SoT hành vi + bố cục** lấy từ mockup + `WEB-HANDOFF.md`; **SoT màu/font** lấy tokens v2 (Sora / Be Vietnam Pro), không copy font system trong prototype.

---

## 1. Nguồn đối chiếu

| Nguồn | Vai trò |
| --- | --- |
| `web-prototype.html` | Desktop/mobile toggle, nav theo vai trò, catalog 3 cột, detail 2 cột + sidebox, wallet, account sidebar, admin sidebar + bảng, gate quét/nhập/lịch sử |
| `WEB-HANDOFF.md` | Phạm vi guest/user/staff/admin; responsive (header ngang / menu thu gọn); không bottom tabs; owned count trên card; đổi mã auth gate |
| `brand/vemoki/tokens.json` | ink/paper/signal/focus, Sora + Be Vietnam Pro |
| `apps/web/app/globals.css` | ~2k dòng — hầu hết product chrome |
| `apps/web/src/site-chrome.tsx` | Wordmark + `SiteNav` (capabilities-driven) |

---

## 2. Token / CSS / font

### 2.1 Màu (canonical)

| Token | `tokens.json` / mockup `:root` | `globals.css` `:root` | Gap |
| --- | --- | --- | --- |
| ink | `#0B1220` | `#0B1220` | Không |
| paper | `#F4F6F8` | `#F4F6F8` | Không |
| signal | `#E11D48` | `#E11D48` | Không |
| focus | `#2563EB` | `#2563EB` | Không |
| muted text | mockup `--muted: #5b687b` | `--ink-muted` (color-mix) | **Khác cách định nghĩa** — cần map semantic `--line` / `--muted` nếu muốn pixel-close mockup |
| borders | mockup `--line: #dde3eb` | `--ink-faint` mix | **Lệch** — mockup border nhạt hơn, đồng nhất |
| page backdrop | mockup body `#e5eaf0` (khung review) / site trắng | gradient paper + signal radial trên `body` | **Khác atmosphere** — code “Live Pulse” hơn mockup flat |

**Lưu ý:** `docs/design/production-web-review/PD-PRODUCTION-WEB-HANDOFF.md` mô tả palette **cũ** (Syne, ink `#22241f`) — **lỗi thời so với code hiện tại**; audit này theo `tokens.json` + mockup 20/10.

### 2.2 Typography

| Khía cạnh | Mockup | Code | Gap |
| --- | --- | --- | --- |
| Display | system stack (prototype) | Sora (`--font-display`) | **Chủ ý:** giữ Sora theo brand; mockup không bắt system font |
| Body | 14px system | Be Vietnam Pro, base ~16px / line 1.6 | **Scale lớn hơn** mockup (H1 mockup 38px vs code `clamp` tới ~4.6rem trên `.shell h1`) |
| H1 catalog | mockup ~38px, letter-spacing -1.5px | home `clamp(2rem, 5vw, 3.2rem)`; shell pages tới ~5rem | **Hero typography outdate** vs mockup hierarchy |
| Eyebrow | 10px uppercase | `.eyebrow` 0.72rem | Gần; OK |

### 2.3 Radius / control chrome

| Element | Mockup | Code | Gap |
| --- | --- | --- | --- |
| Global radius | 7–14px (cards, inputs, buttons) | `--radius-sm: 2px` hầu hết control | **Lệch lớn** — cảm giác “sharp ops” vs mockup soft product |
| Primary button | `border-radius: 8px`, nền `--red` | `.button` / `.redeem-submit` — signal nhưng góc 2px, nhiều chỗ `border: 2px solid var(--ink)` | **Outdate** |
| Inputs | 8px, min-height 46px | min-height 44px, border 2px ink mix | Gần a11y; **visual** lệch |
| Focus | outline 3px `#2563eb` offset 2px | outline 3px `var(--focus)` offset **4px** | Nhỏ |

### 2.4 File ước lượng (token/CSS nền)

| File | Vai trò | Ước lượng chỉnh |
| --- | --- | --- |
| `apps/web/app/globals.css` | Radius scale, buttons, nav, grid, admin/gate/redeem utilities | **1 file, ~150–350 dòng** (thêm `--radius-md/lg`, semantic line/muted, button variants) |
| `apps/web/app/layout.tsx` | Footer copy/links | **~5–15 dòng** |
| `brand/vemoki/tokens.json` | (tuỳ chọn) thêm radius semantic export | **0–10 dòng** nếu sync design repo |

---

## 3. Shell / nav

| Mockup | Code hiện tại | Gap |
| --- | --- | --- |
| Sticky nav 72px (62px mobile), logo `vemoki↗`, links + **active underline đỏ** | `SiteNav`: flex wrap, link text đều nhau, **không** underline active state | **Outdate** |
| Avatar + tên khi đăng nhập | Không có avatar chip | **Thiếu** |
| Mobile: ẩn `.navlinks`, **☰ Menu** overlay | Chỉ `.nav-links` wrap — **không** hamburger / drawer | **Outdate** (WEB-HANDOFF yêu cầu menu thu gọn) |
| Guest: Sự kiện · (Vé của tôi) · Đổi mã · Tài khoản | Guest: Đổi mã · Nhận lời mời · Đăng nhập — **không** link “Sự kiện”, **không** “Vé của tôi” | **IA lệch mockup** (claim thay invite flow mockup không nhấn mạnh) |
| Staff/admin nav theo vai trò trong menu mobile | Capabilities đúng (`/admin`, `/gate`) nhưng cùng chrome guest | Chức năng OK, **presentation** lệch |

**File ước lượng**

| File | Chỉnh |
| --- | --- |
| `apps/web/src/site-chrome.tsx` | **+80–150 dòng** (mobile menu, active link, avatar slot) |
| `apps/web/app/globals.css` (`.top-nav`, `.nav-links`) | **~60–120 dòng** |
| `apps/web/src/nav/capabilities.ts` | **~10–25 dòng** (thêm link Home / wallet nếu product chốt IA) |

---

## 4. Catalog (home / sự kiện công khai)

| Mockup | Code (`app/page.tsx`) | Gap |
| --- | --- | --- |
| H1 «Hẹn bạn ở trải nghiệm tiếp theo» + search + select thời gian | H1 «Điều tốt đẹp…» + CTA đổi mã/đăng nhập; **không** search/filter | **Copy + tooling outdate** |
| Lưới **3 cột** `.grid` | `.event-list` **1 cột** dọc; `.event-grid` 2 cột ≥760px **không dùng** trên home | **Layout outdate** |
| Card: art block + owned strip «Bạn có N vé» | Banner + logo + row; **không** owned count; featured trùng item đầu trong list | **Thiếu owned affordance** (handoff) |
| Không CTA đăng nhập trên card | «Xem sự kiện ↗» — OK | Gần mockup |

**File ước lượng**

| File | Chỉnh |
| --- | --- |
| `apps/web/app/page.tsx` | **~40–90 dòng** (grid, search UI shell, dedupe featured, owned badge hook) |
| `apps/web/app/globals.css` (`.event-list`, `.home-hero`, tools) | **~50–100 dòng** |
| `apps/web/src/published/*` | **0–30 dòng** nếu API owned count (contract — ngoài pure CSS) |

---

## 5. Event detail

| Mockup | Code (`app/t/.../events/[eventSlug]/page.tsx`) | Gap |
| --- | --- | --- |
| Hero art + **2 cột**: prose + **sidebox** «Vé tham dự / Đổi mã» | `hero-atmosphere` full-bleed + CTA trong hero; **không** sidebar sticky | **Layout outdate** |
| Facts 2×2 (THỜI GIAN / ĐỊA ĐIỂM) | `details` dl 3 cột desktop | Gần nội dung; **visual** khác |
| Breadcrumb «‹ Tất cả sự kiện» | `back-link` cuối trang | **Vị trí** lệch |
| Per-event nav minimal | `Wordmark` + org name — không global `SiteNav` | **Cố ý** tenant chrome; mockup dùng global nav — cần quyết định PD |

**File ước lượng**

| File | Chỉnh |
| --- | --- |
| `app/t/[tenantSlug]/events/[eventSlug]/page.tsx` | **~50–100 dòng** |
| `apps/web/app/globals.css` (`.hero`, `.cols`, `.sidebox`) | **~40–80 dòng** (nhiều class mockup chưa có) |

---

## 6. Wallet / vé của tôi

| Mockup | Code | Gap |
| --- | --- | --- |
| Route `wallet`: ticket grid 2 cột, filter chip theo event, header + CTA đổi mã | **Không route `/wallet`**; list monospace trong `redeem-form.tsx`; ticket QR ở `/t/.../tickets/[id]` | **Thiếu surface** — mockup tách wallet khỏi redeem |
| Card ticket: tag, foot code, «Mở vé →» | Owner ticket page có QR + `SiteNav`; redeem list chỉ `code · state` | **Card UI outdate** |

**File ước lượng**

| File | Chỉnh |
| --- | --- |
| **Mới** `apps/web/app/wallet/page.tsx` (+ component) | **~120–200 dòng** |
| `apps/web/app/redeem/redeem-form.tsx` | **~30–60 dòng** (di chuyển list hoặc link sang wallet) |
| `apps/web/app/t/[tenantSlug]/tickets/[ticketId]/page.tsx` | **~20–50 dòng** (card chrome) |
| `apps/web/src/owner-ticket/*`, `globals.css` (`.ticket`, `.ticketgrid`) | **~80–150 dòng** |

---

## 7. Redeem / đổi mã

| Mockup | Code (`app/redeem/*`) | Gap |
| --- | --- | --- |
| Narrow ~530px, form đơn: 1 field mã + CTA | Full `shell` + intro dài + dynamic form/terms/schema/poll | **Đúng API** nhưng **visual ops-heavy** vs mockup |
| «Một mã duy nhất» — không chọn event | `globalEntry` + slug params — aligned logic | Copy OK |
| Login intent quay lại redeem | `loginHref` — aligned | OK |
| Không khối kỹ thuật | `redeem-meta`, `me-result`, idempotency details | **Outdate** cho guest-facing polish |

**File ước lượng**

| File | Chỉnh |
| --- | --- |
| `apps/web/app/redeem/page.tsx` | **~15–40 dòng** |
| `apps/web/app/redeem/redeem-form.tsx` | **~60–120 dòng** (layout tiers, ẩn meta guest) |
| `apps/web/src/redeem/form-fields.tsx` | **~20–50 dòng** |
| `globals.css` (`.redeem-page`, `.narrow`, `.form`) | **~40–70 dòng** |

---

## 8. Account / privacy

| Mockup | Code (`app/account/*`) | Gap |
| --- | --- | --- |
| 2 cột: `accountnav` + nội dung; notice thông báo | 1 cột: header + `SessionPanel` + deletion | **Layout outdate** |
| Privacy + delete trong account IA | Link `/privacy` — **product route không có** (chỉ `app/marketing/privacy`) | **Broken / gap route** |
| Footer mockup: Quyền riêng tư + Hỗ trợ | Footer product: brand + «Sự kiện & vé» | **Outdate** |

**File ước lượng**

| File | Chỉnh |
| --- | --- |
| `apps/web/app/account/page.tsx`, `session-panel.tsx`, `account-panel.tsx` | **~50–100 dòng** |
| **Mới** `apps/web/app/privacy/page.tsx` (hoặc rewrite proxy marketing) | **~40–80 dòng** |
| `apps/web/app/layout.tsx` | footer links **~10 dòng** |

---

## 9. Admin (quản trị tổ chức)

| Mockup | Code (`app/admin/*`) | Gap |
| --- | --- | --- |
| Shell `admin`: sidebar 215px (scroll ngang mobile), stats 3 ô, **tables** responsive → cards | Single page «Không gian quản trị» + `AdminForm` sections; `admin-layout` 3 cột chỉ ≥1280px cho job nav | **Bố cục outdate** vs mockup dashboard |
| Màn: Tổng quan, Sự kiện, Nhập CSV, Lời mời, Thành viên, Cấu hình | Jobs: Chuẩn bị / Khách & mã / Cổng / Hỗ trợ + panels kỹ thuật | **IA khác** — code gắn API thật, mockup là preview layout |
| Table mobile `data-label` | Admin tables chủ yếu desktop / sections | **Responsive table pattern thiếu** |

**File ước lượng** (visual pass — không đổi contract admin API)

| File | Chỉnh |
| --- | --- |
| `apps/web/app/admin/page.tsx` | **~30–60 dòng** |
| `apps/web/app/admin/admin-form.tsx` | **~80–150 dòng** (structure only) |
| `apps/web/app/admin/*-section.tsx`, `*-panel.tsx` (10+ files) | **~15–40 dòng / file** — ước **8–12 file** |
| `globals.css` (`.admin`, `.sidebar`, `.stats`, `.tablewrap`) | **~100–180 dòng** |

---

## 10. Gate (cổng / staff)

| Mockup | Code (`app/gate/*`) | Gap |
| --- | --- | --- |
| `gatebar` scope + Quét / Nhập tay / Lịch sử | Một trang «Cổng check-in» + `GateForm` (tenant/event/ticket id, hold/confirm) | **UX model khác** — mockup QR camera + toast; code BFF staff tool |
| Camera frame + scan animation | Không có UI camera | **Thiếu** (có thể phase 2 nếu chỉ polish CSS) |
| Lịch sử bảng + tải thêm | Lookup notes trong form — **không** history table | **Thiếu surface** |

**File ước lượng**

| File | Chỉnh |
| --- | --- |
| `apps/web/app/gate/page.tsx`, `gate-form.tsx`, `gate-offline-shell.tsx` | **~100–250 dòng** (layout + tabs; logic giữ) |
| `apps/web/app/globals.css` (`.gatebar`, `.camera`, `.toast`) | **~70–120 dòng** |
| `apps/web/src/gate/*` | **0–40 dòng** nếu chỉ copy; nhiều hơn nếu history API |

---

## 11. Auth / claim / marketing (phụ)

| Khu vực | Ghi chú |
| --- | --- |
| `/auth` | Mockup có `login` narrow; code có auth session riêng — chưa audit sâu; PD handoff P0 auth vẫn mở |
| `/claim` | Mockup không nhấn; code có «Nhận lời mời» trên nav — **thêm** so mockup guest nav |
| `apps/web/src/marketing/*` | Ngoài phạm vi mockup product (WEB-HANDOFF) |

---

## 12. Đề xuất chia slice worker (không chồng path)

Mỗi slice chỉ sửa path liệt kê + **shared** `globals.css` theo **thứ tự wave** (foundation trước) hoặc tách «globals chỉ section X» bằng comment block để tránh conflict.

| Slice | ID đề xuất | Path ownership | Phụ thuộc |
| --- | --- | --- | --- |
| **F — Design tokens & shell** | `fe-web-F` | `apps/web/app/globals.css` (tokens, buttons, nav, footer), `apps/web/app/layout.tsx`, `apps/web/src/site-chrome.tsx` | Không |
| **C — Catalog home** | `fe-web-C` | `apps/web/app/page.tsx`, `apps/web/src/ui/event-media.tsx` (nếu card art), `apps/web/src/branding/hero-wordmark.tsx` | F |
| **D — Event detail** | `fe-web-D` | `apps/web/app/t/[tenantSlug]/events/[eventSlug]/page.tsx` | F |
| **W — Wallet & tickets** | `fe-web-W` | `apps/web/app/wallet/**` (mới), `apps/web/app/t/[tenantSlug]/tickets/**`, `apps/web/src/owner-ticket/**` | F; API me/tickets |
| **R — Redeem** | `fe-web-R` | `apps/web/app/redeem/**`, `apps/web/src/redeem/form-fields.tsx` | F |
| **A — Account & privacy** | `fe-web-A` | `apps/web/app/account/**`, `apps/web/app/privacy/**` (mới product) | F |
| **M — Admin chrome** | `fe-web-M` | `apps/web/app/admin/**` (không `api/`) | F |
| **G — Gate chrome** | `fe-web-G` | `apps/web/app/gate/**` (không đổi `src/gate` logic trừ copy) | F |

**Quy tắc tránh conflict**

1. **Chỉ slice F** merge đổi `:root` / shared components (`.button`, `.nav-links`, radius scale).
2. Slice C–G chỉ **thêm** class scoped (`.wallet-page`, `.event-detail-layout`) hoặc chỉnh block đã comment trong globals sau F land.
3. Không slice nào sửa `apps/web/app/api/**` trong đợt visual refactor.
4. `apps/web/src/nav/capabilities.ts` — **một** slice (F hoặc W) sở hữu thêm link wallet/home.

---

## 13. Ưu tiên (user: desktop + mobile lệch mockup)

| P | Hạng mục | Lý do |
| --- | --- | --- |
| P0 | F shell + mobile nav + radius/buttons | Ảnh hưởng mọi route |
| P0 | C catalog grid + copy hero | Trang đầu tiên user thấy |
| P1 | D event sidebox + W wallet route | Core attendee loop mockup |
| P1 | R redeem narrow layout | CTA chính |
| P2 | A account layout + `/privacy` product | Trust + legal |
| P2 | M admin / G gate presentation | Staff — mockup ghi «preview layout» |

---

## 14. Giới hạn audit

- Không chạy UAT browser tại `http://localhost:3010` trong task (API :3001 off) — so sánh **source + mockup static**.
- Không đánh giá đúng/sai API admin/gate — chỉ **gap visual/IA**.
- Mockup không thay thế contracts; owned count / wallet filter cần xác nhận endpoint `me/tickets` (đã có consumer trong redeem).

---

*Auditor: worker web read-only · Orca `task_2660070a0944`.*
