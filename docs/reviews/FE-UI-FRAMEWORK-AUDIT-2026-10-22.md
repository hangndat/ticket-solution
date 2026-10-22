# FE UI framework audit — web + mobile (2026-10-22)

Baseline: `origin/main` `d1313079`. Branch `676b4774` (có #784 chưa merge) lớn hơn một chút: `marketing-uplift.css` 2080 dòng thay vì 2003, `attendee-uplift.css` 582 thay vì 505. Các finding P0 có trên cả hai.  
Phạm vi: `apps/web`, `packages/ui`, `apps/mobile`. `apps/portal` (antd 6) ngoài phạm vi, giữ nguyên theo ADR-22.  
Mục đích: lệnh thực thi cho worker FE web, FE mobile và PD. Mọi số liệu đều chạy lại được bằng lệnh ở [Phụ lục A](#phụ-lục-a--lệnh-đo-lại-số-liệu).

---

## 0. TL;DR

1. **Framework đã cài nhưng gần như không dùng.**
   - Web có Tailwind v4, shadcn `components.json`, cva và `@ticket/ui`. Nhưng chỉ **1/85** file `.tsx` dùng class Tailwind (trang dev), và chỉ **10/85** file import `@ticket/ui`. Chưa `shadcn add` component nào, cũng không có Radix.
   - Mobile có `@expo/ui`, nhưng chỉ dùng **1** component (`Switch`).
2. **CSS tự viết vẫn đang phình ra.** Web có khoảng **7.3k dòng** CSS tay. Riêng hôm nay thêm `marketing-uplift.css` (**2003 dòng, 292 selector** trên main) và `attendee-uplift.css` (505 dòng). Đây là CSS được port thẳng từ prototype HTML tĩnh của PD.
3. **Có bug thật trong `@ticket/ui` (P0).** `withUiPrefix()` đặt prefix sau variant (`hover:ui:x`). Với cách viết này, Tailwind v4 **không sinh CSS**. Vì vậy mọi trạng thái hover, focus-visible, disabled, aria-busy, placeholder và motion-reduce của Button/Input/Label/Skeleton đều không có tác dụng. Form "interest" trên marketing prod đang bị ảnh hưởng.
4. **Có bug a11y (P0).** Tab ở `/gate` đặt `tabIndex=-1` cho các tab không được chọn, nhưng không có xử lý phím mũi tên. Người dùng bàn phím **không chuyển được tab**.
5. **Token bị lệch giữa các nguồn.**
   - `--radius-sm` là **2px** trong legacy nhưng **8px** trong marketing.
   - `--line` có 2 giá trị (`#dde3eb` và `#d7dfe9`), cả 2 đều xuất hiện trong cùng file `marketing-uplift.css`.
   - `brand/vemoki/tokens.json` mới có màu và font, **chưa có spacing, radius, shadow hay breakpoint**.
   - Web dùng 9 breakpoint khác nhau, trong đó có 1 cặp chồng nhau ở 640px.
6. **Mobile chưa có token khoảng cách.**
   - Khoảng 250 chỗ padding/margin/gap/radius ghi số cứng (358 nếu tính cả `fontSize`), nhiều giá trị lẻ lưới (5, 10, 14, 18, 22).
   - 109 `fontSize` ghi số cứng, trong khi `typography.*` chỉ được dùng 22 lần.
   - Không có Button dùng chung: 35 `<Pressable>` rải trên 19 file.

7. **Legacy phải về 0 (mục 6A).**
   - Khoảng **1.4k dòng CSS chết** xóa được ngay, trong đó có cả CSS khung review prototype đang bị ship lên prod.
   - Admin và platform trong `apps/web` (khoảng 100 class legacy) sẽ **xóa hẳn, không migrate**, theo ADR-20 (chuyển sang portal).
   - Phần còn lại migrate theo 3 wave. Tiêu chí hoàn thành là một bộ lệnh kiểm tra đều phải ra 0.

**Lệnh ngay:** đóng băng CSS tay (mục 5) và sửa WP-0 (2 bug P0) **trước khi** merge thêm PR UI nào.

---

## 1. Hiện trạng stack

| Layer | Đã có | Dùng thực tế |
|---|---|---|
| Web styling | Tailwind 4.1.14 (`@tailwindcss/postcss`), import với `prefix(ui)`, **không Preflight** | 1 file tsx dùng class `ui:` (`app/dev/design-system/page.tsx`) |
| Web primitive | `@ticket/ui`: button, card, input, label, alert, skeleton, filter-chip, surface-state, bento-grid, catalog-*, demo-*, field-error, steps-timeline… | `Button` chỉ dùng ở `src/marketing/interest-form.tsx` và trang dev. Primitive khác chỉ 1–3 file |
| Web headless/a11y | **Không có** (không Radix, chưa cài component shadcn nào; thư mục `components/ui` không tồn tại) | Dialog, menu, tab đều tự viết |
| Web motion | `motion` 12, `UiMotionProvider` | Theo island (đúng ADR-22) |
| Web CSS tay | `live-pulse-legacy.css` 3722 dòng (640 selector), `marketing-uplift.css` 2080 (292), `attendee-uplift.css` 582 (73), 6 file `*.module.css` khoảng 940 dòng | Đây là nguồn style chính |
| Mobile styling | Inline `style={{…}}` (khoảng 270 chỗ), **0** file dùng `StyleSheet.create` | — |
| Mobile token | `theme/`: chỉ có màu (`brand`, `colors`) và `typography` | Không có spacing/radius/elevation |
| Mobile native UI | `@expo/ui` 58.0.19 | 1 chỗ: `Switch` trong `redeem/redeem-form-fields.tsx` |

**Nguyên nhân gốc:**
- ADR-22 cố ý giữ legacy, không Preflight và dùng prefix `ui:`. Tailwind chỉ được bật khi một slice adopt, nhưng chưa slice nào adopt thật.
- PD giao prototype dạng HTML/CSS tĩnh viết theo BEM. FE port nguyên văn sang (header `marketing-uplift.css`: *"marketing uplift prototype (static, no build)"*).
- `components.json` để `"prefix": ""`, lệch với build `prefix(ui)`. Nếu chạy `shadcn add`, component sẽ sinh class không có prefix, mà những class đó **không được generate**, nên component không có style. Vì vậy không ai dùng được shadcn.

---

## 2. Findings — web (`apps/web`, `packages/ui`)

### W-01 · P0 · Bug · `withUiPrefix` đặt prefix sai thứ tự nên mọi variant không có tác dụng

- **File:** `packages/ui/src/ui-tw.ts` (hàm `withUiPrefix`). Lỗi viết tay cùng kiểu có ở:
  - `packages/ui/src/primitives/button.tsx:15`: `motion-reduce:ui:animate-none`
  - `packages/ui/src/primitives/label.tsx:10`: `peer-disabled:ui:cursor-not-allowed`, `peer-disabled:ui:opacity-70`
  - `packages/ui/src/primitives/skeleton.tsx:12`: `motion-reduce:ui:animate-none`
- **Bằng chứng:** compile thử bằng `@tailwindcss/postcss` 4.1.14 với `prefix(ui)`:
  - Sinh CSS: `ui:hover:opacity-90`, `ui:motion-reduce:animate-none`.
  - **Không sinh:** `hover:ui:opacity-95`, `motion-reduce:ui:animate-none`, `focus-visible:ui:ring-[3px]`.
  - Đúng với tài liệu Tailwind v4: prefix luôn đứng **đầu** class, trước mọi variant.
- **Class đang không có tác dụng** (lấy từ `dist/primitives/variants.js`):
  - `focusRingClass`: 5/5 class
  - `buttonVariants`: 9/22 (`disabled:*`, `aria-[busy=true]:*`, `focus-visible:*`, `hover:*` của các variant)
  - `inputVariants`: 8/16 (`placeholder:*`, `disabled:*`, `focus-visible:*`)
- **Ảnh hưởng prod:**
  - `src/marketing/interest-form.tsx` (CTA marketing): nút submit khi disabled hoặc loading **không mờ đi**, không đổi con trỏ, không đổi màu khi hover; placeholder của input không ăn màu token.
  - Focus ring đang được CSS legacy `button:focus-visible` (`live-pulse-legacy.css:61-68`) che đi. Khi gỡ legacy thì ring sẽ mất hẳn.
- **Test che lỗi:** `packages/ui/test/primitives-ssr.test.cjs` chỉ kiểm tra chuỗi class có trong HTML, không kiểm tra CSS có được sinh ra hay không.
- **Lệnh sửa:**
  1. Sửa `withUiPrefix`: xuất ra `ui:${variants}:${util}` (prefix đứng đầu). Class đã bắt đầu bằng `ui:` thì giữ nguyên.
  2. Sửa 3 chuỗi viết tay ở trên theo dạng `ui:motion-reduce:animate-none`, `ui:peer-disabled:…`.
  3. Thêm test compile: dùng `@tailwindcss/postcss` compile `@source` trỏ vào `packages/ui/src`, rồi assert CSS output có selector `.ui\:hover\:`, `.ui\:focus-visible\:`, `.ui\:disabled\:`.
  4. Thêm guard: test fail nếu `grep -rE "[a-z\]]:ui:" packages/ui/src apps/web` có kết quả.
- **DoD:** screenshot `interest-form` trước và sau ở 4 trạng thái (default, hover, focus-visible, disabled/loading). Đính kèm output test compile.

### W-02 · P0 · A11y · Tab ở `/gate` không dùng được bằng bàn phím

- **File:** `app/gate/gate-chrome.tsx:20-44` (`GateTabNav`).
- **Lỗi:**
  - Các tab không được chọn có `tabIndex={-1}` nhưng **không có handler ArrowLeft/ArrowRight/Home/End**, nên bàn phím không tới được các tab đó.
  - Container là `<nav>` thay vì `role="tablist"`, nên `role="tab"` bị mồ côi.
- **Lệnh sửa:** thay bằng shadcn `Tabs` (Radix) sau khi xong WP-2, hoặc hotfix trước bằng cách thêm `role="tablist"` và roving tabindex với phím mũi tên.
- **DoD:** test bàn phím (Tab vào tablist, mũi tên chuyển tab, Enter/Space kích hoạt), chạy axe sạch trên `/gate`.

### W-03 · P1 · Config · shadcn không dùng được vì lệch prefix

- **File:** `apps/web/components.json` để `"tailwind.prefix": ""`, nhưng `apps/web/app/globals.css` lại import utilities với `prefix(ui)`.
- **Hệ quả:** code shadcn hoặc Aceternity copy về dùng class không có prefix, không được generate. Hiện cũng chưa có `@/components/ui`. `lib/utils.ts` có tồn tại.
- **Cần quyết định** (xem mục 4, D-1). Khuyến nghị: **bỏ prefix**, bọc legacy vào `@layer legacy` đặt **trước** `utilities`. Khi đó class shadcn/Aceternity dùng nguyên được, utilities thắng legacy theo thứ tự layer, và không còn helper `withUiPrefix`.

### W-04 · P1 · Process · CSS tay vẫn tăng trong epic uplift

| File | Dòng | Selector | Hex/rgba ngoài khai báo `--var` | Nguồn |
|---|---|---|---|---|
| `app/live-pulse-legacy.css` | 3722 | 640 | 104 | legacy |
| `app/marketing-uplift.css` | 2003 (2080 với #784) | 292 | 128 | #770, thêm 22/10 (`5246a5aa` … `cad394c2`) |
| `app/attendee-uplift.css` | 505 (582 với #784) | 73 | 39 | #766 Slice A1 (`829166a6`) |
| `app/redeem/redeem-surface.module.css` | 361 | — | 23 | — |
| `app/account/account-settings.module.css` | 209 | — | 7 | dùng chung cho `privacy/` |
| `src/owner-ticket/wallet-ticket-card.module.css` | 146 | — | 5 | — |
| `app/t/[tenantSlug]/tickets/[ticketId]/ticket-detail.module.css` | 110 | — | 7 | — |
| `app/t/[tenantSlug]/events/[eventSlug]/event-detail-sidebox.module.css` | 61 | — | 4 | — |
| `app/wallet/wallet-page.module.css` | 54 | — | 0 | — |

Có 13 `!important` (legacy 11, marketing 2).  
**Lệnh:** áp dụng mục 5 (đóng băng CSS) và ratchet ở WP-1.

### W-05 · P1 · Token lệch giữa các nguồn

| Token | `live-pulse-legacy.css` | `marketing-uplift.css` | `vemoki-theme.css` (generated) |
|---|---|---|---|
| `--radius-sm` | 2px (dòng 20) | 8px (dòng 26) | — |
| `--radius-md` | 8px | 12px | — |
| `--radius-lg` | 14px | 18px (+ `--radius-xl` 24px) | — |
| `--line` | `#dde3eb` | `#d7dfe9` (dòng 20) **và** `#dde3eb` (dòng 1931) | `#D7DFE9` |
| `--ink`/`--paper`/`--signal`/`--focus` | khai báo lại | khai báo lại 2 lần (dòng 15 và 1927) | có |
| Shadow | — | `--shadow-soft`, `--shadow-frame` (chỉ dùng ở marketing) | — |
| Spacing | `--space-1..8` (4–72px) | `--space-section` (clamp) | — |

`brand/vemoki/tokens.json` mới có `colors` (4 màu) và `typography` (2 font). Hai token `destructive` và `line` trong `vemoki-theme.css` được sinh ra ngoài file này.  
**Lệnh:** WP-3, mở rộng nguồn token gốc. PD chốt một bộ radius/shadow/spacing duy nhất (D-3).

### W-06 · P2 · Breakpoint tùy tiện, có chỗ chồng nhau

- **Các giá trị đang dùng:**

  | Breakpoint | Số lần dùng |
  |---|---|
  | 480 | 1 |
  | 639 | 6 |
  | 640 | 2 + 1 |
  | 720 | 1 |
  | 760 | 1 |
  | 767 | 8 |
  | 768 | 8 |
  | 899 | 3 |
  | 900 | 10 |
  | 959 | 1 |
  | 960 | 5 |
  | 1280 | 4 |

- **Chồng nhau:** có cả `@media (max-width: 640px)` lẫn `@media (min-width: 640px)`, nên ở đúng 640px cả hai cùng khớp.
- **Lệnh:** chỉ dùng breakpoint Tailwind `sm` 640 / `md` 768 / `lg` 1024 / `xl` 1280. Nếu prototype thật sự cần 900/960 thì định nghĩa thêm breakpoint trong `@theme` (D-3). Cấm thêm `@media (… px)` viết tay.

### W-07 · P2 · Trùng lặp nút: khoảng 30 class nút/CTA cho cùng một khái niệm

Selector đang có: `.btn-primary`, `.btn-secondary`, `.btn-destructive`, `.button`, `.cta`, `.hero-cta`, `.home-cta`, `.home-cta-primary`, `.account-cta-primary`, `.account-cta-logout`, `.invite-admin-cta`, `.auth-buttons`, `.admin-job-nav__btn`, `.gate-tabs__btn(--active)`, `.ticket-card__cta`, `.wallet-heading__cta`, `.mkt-btn`, `.mkt-btn--primary|--secondary|--ghost|--block`, `.mkt-btn-primary|-secondary|-ghost`, `.mkt-hero-cta`, `.mkt-nav-cta`, `.mkt-demo-cta`, `.mkt-cta-row`, `.mkt-cta-grid`…

- **Hai quy ước đặt tên song song** cho cùng một nút: `mkt-btn--primary` (6 file tsx) và `mkt-btn-primary` (2 file tsx). Ngoài ra `btn-primary` có ở 5 file.
- Có 21 file tsx dùng `<button>` trần. `@ticket/ui` `Button` chỉ được 1 file prod dùng.
- Có 37 selector dạng card, 13 dạng chip/badge/pill, 16 dạng input/field/form.
- **Lệnh:** WP-4, thay toàn bộ bằng `@ticket/ui` `Button` (thêm variant/size nếu thiếu, kèm `asChild` hoặc `buttonVariants()` cho `<a>`/`<Link>`).

### W-08 · P2 · Dialog, menu mobile tự viết

- **File:**
  - `src/marketing/marketing-mobile-nav-menu.tsx` (151 dòng)
  - `src/site-chrome.tsx` (menu attendee, 335 dòng)
  - `src/nav/mobile-menu-focus.ts` (39 dòng, focus trap tự viết)
- **Các phần tự làm:** focus trap, Esc, backdrop, trả focus, `role="dialog" aria-modal`.
- **Phần thiếu:** không thấy cơ chế khóa cuộn body hay `inert` cho phần nền trong 2 component này. Không có portal, nên z-index phụ thuộc DOM cha.
- **Lệnh:** WP-2, thay bằng shadcn `Sheet` (Radix Dialog). Giữ nguyên `data-testid` để không vỡ test. Xóa `mobile-menu-focus.ts` khi không còn ai dùng.
- **Không cần đổi:** FAQ (`src/marketing/sections/faq.tsx`) dùng `<details>/<summary>` native là đúng, giữ nguyên.

### W-09 · P2 · Rủi ro · Bật `color-scheme: light dark` nhưng không có style dark

- `marketing-uplift.css:9`: `.mkt.mkt--uplift { color-scheme: light dark; }`, trong khi **0** khai báo `prefers-color-scheme` trong mọi file CSS.
- **Rủi ro:** khi hệ điều hành ở chế độ tối, trình duyệt có thể vẽ input, scrollbar và control native theo nền tối, trong khi trang vẫn là nền sáng. Cần verify bằng screenshot khi OS ở chế độ tối.
- **Lệnh:** nếu chưa hỗ trợ dark thì đổi thành `color-scheme: light` (D-4).

### W-10 · P2 · Test đang khóa tên class CSS

- **File:** `tests/fe-layout-regression.test.ts`, `tests/marketing-mobile-nav.test.ts`, `tests/marketing-bento.test.ts`, `tests/mobile-menu-focus.test.ts` (4 file đọc trực tiếp file `.css`), cùng `tests/marketing-mobile-nav-evidence.mjs` và `tests/fe-layout-regression.mjs` (dựa vào tên class).
- Các test này dùng regex trên **nội dung file CSS**, ví dụ `/\.mkt-nav-menu-toggle[\s\S]*justify-content:\s*center/`.
- **Hệ quả:** migrate sang Tailwind là vỡ test, dù UI không đổi.
- **Lệnh:** WP-7, chuyển sang kiểm tra hành vi (`data-testid`, role, computed style qua Playwright) và screenshot evidence. Bỏ regex trên CSS.

---

## 3. Findings — mobile (`apps/mobile`)

### M-01 · P1 · Không có token spacing/radius/elevation

- `src/theme/` mới có `colors.ts`, `tokens.ts` (chỉ màu) và `typography.ts`.
- Khoảng 250 chỗ `padding|margin|gap|borderRadius*: <số>` trong `.tsx` (đo bằng `scripts/ui-budget.mjs`: `mobile.spacing_literals`). Phân bố giá trị dưới đây đo bằng lệnh cũ có gộp cả `fontSize` (tổng 358), chỉ dùng để thấy mức lẻ lưới:

  | Giá trị | Số lần |
  |---|---|
  | 12 | 62 |
  | 8 | 36 |
  | 16 | 29 |
  | 20 | 27 |
  | **10** | 27 |
  | **14** | 16 |
  | 4 | 14 |
  | **6** | 9 |
  | 48 | 6 |
  | 2 | 4 |
  | **18** | 4 |
  | 0 | 4 |
  | 24 | 3 |
  | **5** | 2 |
  | **22** | 2 |

  Giá trị in đậm là lẻ lưới 4/8.
- **Lệnh:** WP-5, thêm `space` (`xxs` 2, `xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 24, `2xl` 32, `3xl` 48), `radius` và `elevation` vào `theme/tokens.ts`. Giá trị lấy từ nguồn token gốc ở WP-3 để khớp với web. Map giá trị lẻ về bậc gần nhất (10→8 hoặc 12, 14→12 hoặc 16, 18/22→16 hoặc 24) **có PD duyệt**.

### M-02 · P1 · Typography bị bỏ qua

- 109 `fontSize: <số>` và 52 `fontWeight: '<số>'` ghi cứng trong `.tsx`, trong khi `typography.*` chỉ được dùng 22 lần.
- **Lệnh:** mọi `Text` dùng role trong `typography` (wordmark/display/title/body/callout/caption…). Thiếu role thì thêm vào `typography.ts`, không ghi số tại chỗ.

### M-03 · P1 · Không có Button, Input, Spinner dùng chung

- **`<Pressable>`** (35 chỗ trên 19 file):
  - `account-deletion/account-deletion-panel.tsx`
  - `components/`: `account-grouped-section.tsx`, `attendee-cta.tsx`, `screen-state.tsx`, `wallet-owned-tickets-link.tsx`
  - `gate/`: `gate-camera.tsx`, `staff-gate-chrome.tsx`, `staff-gate-device-history-panel.tsx`, `staff-gate-empty-state.tsx`, `staff-gate-history-sheet.tsx`, `staff-gate-manual-entry.tsx`, `staff-gate-ops-sticky.tsx`, `staff-manual-confirm-sheet.tsx`
  - `push/push-status.tsx`
  - `redeem/redeem-form-fields.tsx`
  - `screens/`: `events.tsx`, `my-tickets.tsx`, `redeem.tsx`, `staff-manual.tsx`
- **`<TextInput>`** (7 file):
  - `redeem/redeem-form-fields.tsx`
  - `screens/`: `staff-manual.tsx`, `redeem.tsx`, `events.tsx`, `global-redeem.tsx`
  - `gate/`: `staff-gate-device-history-panel.tsx`, `staff-gate-manual-entry.tsx`
- **`<ActivityIndicator>`:** 9 file.
- Mới có 28 chỗ khai báo `accessibilityRole="button"` và 13 chỗ có `hitSlop`/`minHeight` 44–48, nên kích thước vùng chạm và a11y đang không đồng đều.
- **Lệnh:** WP-6, tạo `src/components/ui/button.tsx`:
  - variant `primary`/`secondary`/`ghost`/`destructive`, size `md`/`lg`
  - `loading`, `disabled`, `accessibilityRole="button"`, `accessibilityState`, vùng chạm tối thiểu 44pt, phản hồi khi nhấn
  - Tạo thêm `input.tsx` (label, error, `accessibilityLabel`) và `spinner.tsx`. Sau đó thay toàn bộ danh sách trên.

### M-04 · P2 · `@expo/ui` gần như chưa dùng

| Hiện tại (tự làm) | Thay bằng |
|---|---|
| `gate/staff-gate-history-sheet.tsx`, `gate/staff-gate-manual-entry.tsx`: `<Modal transparent animationType="slide">` | `@expo/ui` `BottomSheet`, hoặc route expo-router `presentation: 'formSheet'` (có kéo để đóng, detent, chuẩn native). Giữ `onRequestClose` (Android back) và `KeyboardAvoidingView` ở manual-entry |
| `gate/staff-manual-confirm-sheet.tsx`: `<Modal animationType="fade">` dùng làm hộp xác nhận | Giữ Modal hoặc dùng `Alert.alert` native nếu nội dung đơn giản (PD quyết) |
| Segment/tab tự vẽ trong `gate/staff-gate-chrome.tsx` (`backgroundColor: active ? colors.card : 'transparent'`) | `@expo/ui` `Picker` dạng segmented |
| `components/account-grouped-section.tsx` (section kiểu Settings) | `@expo/ui` `List`/`FieldGroup` |

Ghi chú: các sheet hiện tại **đã làm đúng** `onRequestClose` và `accessibilityRole`. Migrate để có hành vi native, không phải để sửa bug.

### M-05 · P2 · Hex và style inline

- **Hex ngoài `theme/` trong `.tsx`** (26 chỗ):

  | File | Số chỗ |
  |---|---|
  | `screens/my-tickets.tsx` | 5 |
  | `screens/events.tsx` | 4 |
  | `redeem/redeem-form-fields.tsx` | 3 |
  | `gate/staff-gate-scan-toast.tsx` | 3 |
  | `account-deletion/account-deletion-panel.tsx` | 3 |
  | `screens/event-detail.tsx` | 2 |
  | `gate/gate-camera.tsx` | 2 |
  | `screens/ticket-detail.tsx`, `push/push-status.tsx`, `components/wallet-owned-tickets-link.tsx`, `components/qr-code.tsx` | 1 mỗi file |

  Các file `.ts` còn lại cần lọc tay, vì có thể là dữ liệu hoặc id chứ không phải màu.
- **File nhiều style inline nhất:**

  | File | Số chỗ |
  |---|---|
  | `gate/staff-gate-device-history-panel.tsx` | 25 |
  | `redeem/redeem-form-fields.tsx` | 19 |
  | `screens/event-detail.tsx` | 17 |
  | `screens/my-tickets.tsx` | 16 |
  | `screens/events.tsx` | 14 |
  | `gate/staff-gate-ops-sticky.tsx` | 13 |
  | `gate/staff-gate-chrome.tsx` | 13 |
  | `screens/ticket-detail.tsx` | 12 |

- **Lệnh:** phần style tĩnh chuyển sang `StyleSheet.create` ở cuối file, dùng token. Inline chỉ dành cho giá trị động (theme tenant, trạng thái).

### M-06 · P2 · Rủi ro · App để chế độ sáng/tối tự động nhưng màu chỉ có bản sáng

- `app.config.ts:94` đặt `userInterfaceStyle: 'automatic'`, nhưng `theme/colors.ts` chỉ có màu cố định cho nền sáng.
- **Rủi ro:** khi máy ở chế độ tối, component native (status bar, `@expo/ui` Switch/Picker/BottomSheet, header hệ thống) chuyển sang tối, trong khi app vẫn vẽ nền `paper`.
- **Cần verify** trên máy thật hoặc simulator ở chế độ tối. Quyết định ở D-4.

---

## 4. Quyết định cần chốt (owner: user/PD, trước WP-2)

> **Đã chốt (user, 2026-10-22):**
> - **D-1 → D-5:** theo cột Khuyến nghị bên dưới. Bỏ prefix và đưa legacy vào `@layer legacy`; PD giao prototype bằng JSX + Tailwind; PD chốt một bảng token duy nhất; chỉ làm giao diện sáng; mobile dùng theme TS + `StyleSheet`.
> - **D-6:** **bỏ `/gate` trên web**, mobile thay thế. W-02 được giải quyết bằng cách xóa route; chỉ hotfix nếu việc xóa bị chặn.
> - **D-7:** **đóng băng** `app/admin` + `app/platform`. BA (Kazu) xác nhận parity với `apps/portal`, đủ thì xóa và redirect.
> - **PR #784:** **đóng**. Header/menu mobile làm lại bằng shadcn `Sheet` trong WP-2, theo spec của PD.
> - **Merge:** leader được merge tuần tự khi reviewer PASS trên exact SHA và CI xanh. **Không deploy prod.**

| ID | Câu hỏi | Khuyến nghị | Lý do |
|---|---|---|---|
| D-1 | Prefix Tailwind web: giữ `ui:` hay bỏ? | **Bỏ prefix.** Legacy vào `@layer legacy` đặt trước `utilities`: `@layer theme, base, legacy, components, utilities;` | Code shadcn/Aceternity copy về chạy được ngay, không cần `withUiPrefix`, và utilities thắng legacy theo thứ tự layer. Rủi ro: class legacy trùng tên utility (`.container`, `.hidden`…). Cần grep, đổi tên trước, kèm screenshot diff |
| D-2 | PD giao prototype dạng gì? | **JSX + Tailwind dùng component shadcn/`@ticket/ui`** (hoặc Figma/screenshot kèm tên token). Không giao HTML/CSS tĩnh viết BEM | Đây là nguyên nhân gốc của W-04 |
| D-3 | Bộ token duy nhất: radius, shadow, spacing, breakpoint | PD chốt 1 bảng duy nhất vào `brand/vemoki/tokens.json`. Đề xuất radius `sm` 8 / `md` 12 / `lg` 18 / `xl` 24 (theo marketing, mới hơn), spacing lưới 4, breakpoint mặc định của Tailwind | Hết lệch giữa legacy, marketing và mobile |
| D-4 | Dark mode | Giai đoạn này **light-only**: web `color-scheme: light`, mobile `userInterfaceStyle: 'light'`. Làm dark là epic riêng | Tránh trạng thái nửa sáng nửa tối |
| D-5 | Cách style mobile | **Giữ theme TS thuần + `StyleSheet`**, chưa thêm NativeWind/Tamagui | YAGNI. Thiếu token chứ không thiếu thư viện |
| D-6 | `/gate` trên web còn giữ không, khi mobile đã có staff gate? | BA/PO chốt. **Giữ**: migrate ở wave 3 (kèm W-02). **Bỏ**: xóa route cùng 64 class legacy | Gate chiếm nhiều class legacy thứ 2 (64) |
| D-7 | Thời điểm xóa `app/admin` + `app/platform` khỏi `apps/web` | Xóa ngay khi `apps/portal` đạt parity (ADR-20). Trước đó **đóng băng hoàn toàn**, không migrate Tailwind | Migrate rồi xóa là làm 2 lần. Khoảng 100 class legacy biến mất cùng route |

---

## 5. Quy tắc hiệu lực ngay cho mọi worker UI (dán vào prompt)

```text
UI RULES (FE-UI-FRAMEWORK-AUDIT-2026-10-22) — bắt buộc, reviewer reject nếu vi phạm:

WEB (apps/web, packages/ui)
1. KHÔNG thêm selector mới vào live-pulse-legacy.css, marketing-uplift.css, attendee-uplift.css,
   và KHÔNG tạo *.module.css mới. Chỉ được XÓA hoặc sửa bug tại chỗ (ghi rõ trong PR).
2. UI mới hoặc UI được chạm vào: dùng Tailwind utilities + component @ticket/ui / shadcn (components/ui).
   Không có component phù hợp → thêm vào @ticket/ui (cva variant), không viết CSS riêng.
3. Tương tác (dialog, sheet, menu, dropdown, tabs, popover, tooltip, toast): BẮT BUỘC shadcn/Radix.
   Cấm tự viết focus trap, Esc handler, roving tabindex.
4. Không mã hex/rgba, không số px tùy ý (p-[13px]) trong tsx. Chỉ dùng token theme.
   Thiếu token → đề xuất thêm vào brand/vemoki/tokens.json (PD duyệt).
5. Breakpoint chỉ sm/md/lg/xl (+ breakpoint khai báo trong @theme). Cấm @media px viết tay.
6. (Đến khi xong D-1) Tailwind prefix: `ui:` LUÔN đứng đầu: `ui:hover:bg-ink/5`, KHÔNG `hover:ui:bg-ink/5`.
7. Nút/link dạng nút: dùng Button / buttonVariants() của @ticket/ui. Cấm class btn/cta mới.
8. Giữ data-testid khi migrate. Test kiểm tra hành vi/role/testid, không regex nội dung file CSS.

MOBILE (apps/mobile)
9. Không số cứng cho padding/margin/gap/borderRadius/fontSize/fontWeight. Dùng theme.space / theme.radius / typography.*.
10. Không hex ngoài src/theme/. Dùng colors.* / brand.*.
11. Nút: src/components/ui/button.tsx. Input: src/components/ui/input.tsx. Cấm Pressable trần làm nút.
12. Sheet / segmented / picker / switch / menu / grouped list: ưu tiên @expo/ui (hoặc formSheet expo-router).
    Chỉ dùng RN Modal hoặc tự vẽ khi @expo/ui thiếu (ghi lý do trong PR).
13. Style tĩnh để trong StyleSheet.create. Inline chỉ cho giá trị động.

PD
14. Prototype giao dạng JSX + Tailwind/shadcn, hoặc design kèm tên token. Không giao HTML/CSS tĩnh.
    Token mới phải vào brand/vemoki/tokens.json trước khi FE dùng.

CHUNG
15. Chạm vào route/component nào thì XÓA legacy của phần đó trong cùng PR: CSS, class, helper, test regex CSS.
    Không để style cũ và mới song song. PR migrate mà không giảm số dòng legacy → reject.
16. app/admin, app/platform (web): ĐÓNG BĂNG. Chỉ sửa bug bảo mật/chặn vận hành. Không migrate (sẽ xóa theo ADR-20).
```

---

## 6. Work packages (thứ tự thực hiện)

> Mỗi WP là 1 PR riêng (GitHub Flow), có screenshot trước/sau theo `ui-workflow`, reviewer-uiux duyệt.
> Phụ thuộc: WP-0 → WP-1 → (D-1..D-3) → WP-2/WP-3 → WP-4 → WP-8. Mobile chạy song song: WP-5 → WP-6 → WP-9.

### WP-0 · P0 · Hotfix (web) — owner: FE web

- [ ] W-01: sửa `withUiPrefix` và 3 chuỗi viết tay, thêm test compile CSS và guard grep.
- [ ] W-02: roving tabindex + phím mũi tên + `role="tablist"` cho `GateTabNav` (hoặc chờ WP-2 nếu WP-2 merge trong 48h).
- **DoD:**
  - `pnpm --filter @ticket/ui test` và `pnpm --filter @ticket/web test` đều pass.
  - `grep -rE "[a-z\]]:ui:" packages/ui/src apps/web/app apps/web/src` = 0.
  - Screenshot 4 trạng thái của `interest-form`.
  - Test bàn phím cho `/gate`, axe 0 violation trên `/gate` và trang marketing có form.

### WP-1 · P1 · Đóng băng và ratchet (web + mobile) — owner: FE lead

- [ ] Viết bản sửa đổi ADR-22: thêm mục 5 (quy tắc) và trạng thái các quyết định D-1..D-5.
- [ ] Viết script `scripts/ui-budget.mjs` và chạy trong CI. Baseline lưu ở `scripts/ui-budget.baseline.json`. Script **fail khi bất kỳ chỉ số nào tăng**:
  - **Web:** tổng số dòng `apps/web/**/*.css` (trừ `globals.css`), số file `*.module.css`, số hex trong tsx, số `@media (…px)` viết tay.
  - **Mobile:** số literal `padding|margin|gap|borderRadius|fontSize: <số>`, số hex ngoài `src/theme`, số `<Pressable` ngoài `src/components/ui`, số `<Modal`.
  - Chỉ số giảm thì cập nhật baseline trong cùng PR (ratchet chỉ đi xuống).
- [ ] Thêm checklist mục 7 vào PR template.
- **DoD:** CI fail khi thử thêm 1 dòng vào `marketing-uplift.css`, pass khi xóa bớt.

### WP-2 · P1 · Bật shadcn + Radix (web) — owner: FE web — cần D-1

- [ ] Áp dụng D-1: bỏ prefix (hoặc set `components.json` `tailwind.prefix: "ui"` nếu giữ prefix), cho `@layer legacy` vào chuỗi layer, grep và đổi tên các class legacy trùng tên utility.
- [ ] Nếu bỏ prefix: xóa `withUiPrefix`, bỏ `ui:` khỏi `packages/ui` (codemod), cập nhật `primitives-ssr.test.cjs`.
- [ ] `shadcn add`: `sheet`, `dialog`, `tabs`, `dropdown-menu`, `popover`, `tooltip`, `sonner` (toast). Chỉnh token sang Live Pulse (ink/paper/signal/focus), không giữ palette neutral mặc định.
- [ ] Thay `marketing-mobile-nav-menu.tsx` và menu trong `site-chrome.tsx` bằng `Sheet`, xóa `src/nav/mobile-menu-focus.ts`. Thay `GateTabNav` bằng `Tabs`.
- [ ] Đặt component shadcn ở `packages/ui` (dùng chung) hoặc `apps/web/components/ui` (theo alias trong `components.json`), ghi rõ lựa chọn vào ADR.
- **DoD:**
  - Screenshot desktop 1280 / mobile 390 trước/sau cho marketing và attendee, cả vi/en.
  - Test bàn phím: Esc, focus trap, trả focus, scroll lock.
  - axe 0. Lighthouse không giảm so với `docs/reviews/assets/PR776-marketing-lighthouse/`.
  - First-load JS không tăng quá ngưỡng ADR-22. Radix chỉ nằm trong client island.

### WP-3 · P1 · Nguồn token gốc (web + mobile) — owner: PD + FE — cần D-3

- [ ] Mở rộng `brand/vemoki/tokens.json`: `radius`, `shadow`, `space`, `breakpoints`, `colors.line`, `colors.destructive`, `colors.muted`, các màu trạng thái (`admit`, `unknown`…).
- [ ] Sửa `packages/ui/scripts/generate-tokens.mjs` để xuất ra:
  - `@theme` CSS cho web (`--radius-*`, `--shadow-*`, `--spacing`, `--breakpoint-*`)
  - **file TS cho mobile** (`apps/mobile/src/theme/tokens.generated.ts`)
- [ ] Xóa các khai báo `--ink/--paper/--signal/--focus/--line/--radius-*` bị lặp trong `marketing-uplift.css` (dòng 15–35 và 1927+) và `live-pulse-legacy.css` (dòng 6–28), trỏ về token đã generate.
- **DoD:** CI test so khớp token (đã có trong ADR-22 §4) phủ cả nhóm token mới. Screenshot diff không lệch ngoài các chỗ PD duyệt.

### WP-4 · P2 · Gom nút về một component (web) — owner: FE web

- [ ] Bổ sung `@ticket/ui` `Button`: variant `primary|secondary|ghost|destructive|link`, size `sm|md|lg`, `block`, cho phép render thành `<a>`/`<Link>` qua `buttonVariants()` hoặc `asChild` (Radix Slot).
- [ ] Thay toàn bộ selector ở W-07 và 21 file `<button>` trần. Xóa CSS tương ứng.
- **DoD:** `grep -cE "^\.(mkt-)?btn|cta" apps/web/app/*.css` = 0 (trừ phần layout như `cta-row` nếu đã chuyển sang utility). Screenshot đủ trạng thái.

### WP-5 · P1 · Token mobile — owner: FE mobile — cần D-3 (có thể làm trước với giá trị tạm, rồi nối WP-3)

- [ ] Thêm `space`, `radius`, `elevation` và export qua `theme/index.ts`.
- [ ] Codemod khoảng 250 chỗ literal spacing/radius sang `space.*`/`radius.*`. Giá trị lẻ lưới lập bảng map để PD duyệt **trước** codemod.
- [ ] 109 `fontSize` và 52 `fontWeight` chuyển sang `typography.*`, thêm role nếu thiếu.
- [ ] 26 hex trong tsx chuyển sang `colors.*`.
- **DoD:**
  - `grep -rnoE "(padding|margin|gap|borderRadius|fontSize)[A-Za-z]*: [0-9]+" apps/mobile/src --include='*.tsx' | grep -v src/theme` = 0.
  - Screenshot iOS các màn chính trước/sau: events, event-detail, my-tickets, ticket-detail, redeem, gate, account.

### WP-6 · P1 · Component nền mobile — owner: FE mobile

- [ ] `src/components/ui/button.tsx`, `input.tsx`, `spinner.tsx` (spec ở M-03).
- [ ] Thay 35 `Pressable` (19 file), 7 file `TextInput` và 9 file `ActivityIndicator`.
- **DoD:** `grep -rl "<Pressable" apps/mobile/src | grep -v components/ui` chỉ còn các vùng chạm không phải nút (có lý do trong PR). Kiểm tra VoiceOver 1 luồng (redeem) và 1 luồng (gate manual).

### WP-7 · P2 · Viết lại test khóa CSS (web) — owner: FE web — làm cùng WP-2/WP-4

- [ ] 6 file ở W-10: bỏ regex trên CSS, chuyển sang assert role/testid/computed style hoặc screenshot.

### WP-8 · P1 · Dọn sạch legacy (web) — owner: FE web — chi tiết ở mục 6A

- **Bước 1 (xóa CSS chết):** làm ngay, độc lập với WP khác.
- **Bước 2 (migrate wave 1–3):** sau WP-2..WP-4.
- **Bước 3 (xóa admin/platform):** theo D-7.
- **Đóng epic** khi mọi lệnh ở 6A.4 trả 0.

### WP-9 · P2 · `@expo/ui` (mobile) — owner: FE mobile — sau WP-6

- [ ] Các sheet ở M-04 chuyển sang `BottomSheet`/`formSheet`, segmented sang `Picker`, grouped section sang `List`/`FieldGroup`.
- [ ] Verify D-4 (chế độ tối) trên simulator.
- **DoD:** video hoặc screenshot thao tác kéo để đóng sheet trên iOS và Android. Nút back Android vẫn đóng được sheet.

---

## 6A. Dọn sạch legacy: định nghĩa, kiểm kê, lộ trình, tiêu chí hoàn thành

> Mục tiêu: **legacy = 0**. Không giữ chế độ "song song" vô thời hạn như hiện tại.
> Mọi PR thuộc mục này phải: (1) giảm baseline `ui-budget`, (2) có screenshot diff toàn bộ route bị ảnh hưởng (vi/en × 1280/390), (3) test xanh.

### 6A.1 Những gì tính là "legacy"

| ID | Hạng mục | Hiện trạng (main `d1313079`) | Đích |
|---|---|---|---|
| L-1 | `app/live-pulse-legacy.css` | 3722 dòng, 394 class, 640 selector | **Xóa file** |
| L-2 | `app/marketing-uplift.css` | 2003 dòng, 150 class | **Xóa file** (chuyển Tailwind + component) |
| L-3 | `app/attendee-uplift.css` | 505 dòng, 45 class | **Xóa file** |
| L-4 | 6 file `*.module.css` (redeem-surface, account-settings (dùng chung cho privacy), wallet-ticket-card, ticket-detail, event-detail-sidebox, wallet-page) | 941 dòng | **Xóa hết** |
| L-5 | Token khai báo tay trong CSS: `live-pulse-legacy.css` dòng 6–28, `marketing-uplift.css` dòng 15–35 và khoảng 1927+ | Lệch nhau (W-05) | Chỉ còn token sinh từ `tokens.json` |
| L-6 | Prefix `ui:`: `withUiPrefix` (`packages/ui/src/ui-tw.ts`), `prefix(ui)` trong `globals.css`, mọi class `ui:*` | Bắt buộc vì legacy | **Bỏ** (D-1), sau khi legacy hết hoặc đã vào `@layer legacy` |
| L-7 | A11y tự viết: `src/nav/mobile-menu-focus.ts`, 2 menu mobile, `GateTabNav` | W-02, W-08 | Thay bằng Radix, xóa file |
| L-8 | Test regex nội dung CSS: 5 file ở W-10 | Khóa tên class | Test hành vi |
| L-9 | Không Preflight (comment `globals.css`: *"no Preflight on legacy"*) | — | `@import 'tailwindcss';` đầy đủ, có Preflight |
| L-10 | Route staff/admin trong `apps/web`: `app/admin` (14 tsx), `app/platform` (2 tsx), `src/admin`, `src/platform` | Khoảng 100 class legacy | **Xóa route** khi portal parity (ADR-20, D-7) |
| L-11 | Mobile: literal style, `Pressable` trần, `Modal` tự dựng | M-01..M-05 | Theo WP-5/6/9 |

### 6A.2 Bước 1 · P1 · Xóa CSS chết (làm ngay, rủi ro thấp)

Quét bằng [script ở Phụ lục C](#phụ-lục-c--script-tìm-css-chết): class trong CSS **không xuất hiện** ở bất kỳ file `.ts/.tsx/.mjs` nào trong `apps/web/app`, `apps/web/src`, `packages/ui/src`.

| File | Class chết | Rule chết (ước tính) | Class ghép động (kiểm tay) |
|---|---|---|---|
| `live-pulse-legacy.css` | 89 | 133 rule, khoảng 923 dòng | 13 |
| `marketing-uplift.css` | 36 | 67 rule, khoảng 505 dòng | 4 |
| `attendee-uplift.css` | 1 (`home-hero--legacy-hidden`) | 1 rule, khoảng 5 dòng | 2 |
| **Tổng** | **126** | **khoảng 1430 dòng (khoảng 23% CSS tay)** | 19 |

**Các nhóm đáng chú ý:**
- **`marketing-uplift.css` dòng 1847–1989, "Review chrome (prototype shell)", khoảng 143 dòng:** `:root.review-root`, `body.review-body`, `.review`, `.reviewhead*`, `.seg*`, `.browser*` (`.chrome-bar`, `.dot`, `.address`, `.site`), `.mkt--mobile*`, `.reviewnote`. Đây là CSS của khung review prototype, bị ship lên prod. Xóa cả block.
  - **Giữ** dòng 1990–2003 (`.mkt.mkt--uplift section`, `.mkt-legal section`, `.mkt-header`, `.mkt-footer`). Đây là rule đang dùng thật, chỉ bị nối vào sau block review.
  - Lưu ý: `.seg`, `.browser`, `.site`, `.on` là tên chung chung, nên script có thể tưởng là "còn dùng" (khớp chữ thường trong code). Đây là ví dụ cho thấy kết quả script cần được kiểm tay.
- **Legacy, nhóm trang chủ hoặc event cũ đã được thay thế:** `home-catalog-card*` (đã có `CatalogEventCard` trong `@ticket/ui`), `home-hero`, `home-featured*`, `event-card`, `event-grid`, `event-row`, `event-banner-*`, `event-logo-*`, `poster-*`, `auth-page`, `auth-session`, `auth-status`, `account-header`, `account-back`, `ticket-qr-*`, `btn-secondary`, `btn-destructive`, `card-action`…
- **Marketing, các section đã viết lại:** `mkt-bento`, `mkt-bento-cell*`, `mkt-bento-visual*`, `mkt-bento-event*`, `mkt-faq-trigger`, `mkt-faq-icon`, `mkt-faq-panel*`, `mkt-field`, `mkt-check`, `mkt-footer-grid`, `mkt-footer-links`, `mkt-fade-in`, `mkt-btn--block`, `mkt--mobile`.

**Quy trình:**
1. Chạy script, lưu danh sách vào PR.
2. Xóa những rule mà **mọi selector** đều chứa class chết. Rule có selector hỗn hợp (một phần còn sống) chỉ xóa phần selector chết.
3. 19 class "ghép động" (tên được ghép bằng template string, ví dụ `…--${tone}`): grep tay, chỉ xóa khi chứng minh được là không dùng.
4. Cập nhật test nào đang assert class đã xóa.
5. Screenshot diff toàn bộ route public và attendee (vi/en × 1280/390). **Kỳ vọng không có diff.**

**DoD:** chạy lại script cho 0 class chết (trừ class ghép động đã ghi chú), `ui-budget` giảm khoảng 1.4k dòng, không có diff ảnh.

### 6A.3 Bước 2 · Phân loại route: migrate hay xóa

Số class legacy (`live-pulse-legacy.css`) **đang được dùng** theo nhóm thư mục. Một class có thể được đếm ở nhiều nhóm.

| Nhóm | Class legacy đang dùng | Chiến lược | Wave |
|---|---|---|---|
| `app/admin` (80), `app/platform` (20), `src/admin` (3), `src/platform` | khoảng 100 | **Xóa route, không migrate** (D-7, ADR-20). Trong thời gian chờ: đóng băng, redirect sang `portal.vemoki.com` khi parity | Theo D-7 |
| `app/gate` | 64 | **D-6**: giữ thì migrate (kèm W-02), bỏ thì xóa | 3 hoặc xóa |
| `src/marketing` + `marketing-uplift.css` | 54 class legacy + khoảng 110 class uplift còn sống | Migrate. **Lưu ý:** marketing vẫn phụ thuộc 54 class legacy, nên phải gỡ cả 2 nguồn | **1** |
| Attendee chrome và discovery: `app/(root)` 21, `src/site-chrome.tsx` 17, `src/ui` 13, `src/home-catalog` 6, `src/branding` 6, `src/content` 9, `src/published` 4, `src/brand-mark.tsx` 2 + `attendee-uplift.css` | khoảng 78 + 44 | Migrate | **2** |
| Attendee detail và ví: `app/t` 36 (event-detail, ticket-detail), `src/owner-ticket` 10, `app/wallet` 9 + 4 module.css tương ứng | khoảng 55 | Migrate | **2** |
| Luồng giao dịch: `app/redeem` 25 + `src/redeem` 8 + `redeem-surface.module.css`, `app/claim` 22, `app/invite` 20, `app/account` 22 + `account-settings.module.css`, `app/privacy` 1, `app/auth` 2, `src/oidc` 2 | khoảng 102 | Migrate. Ưu tiên giữ hành vi form, test e2e đầy đủ | **3** |
| Đuôi dài: `src/fixtures`, `src/guest`, `src/nav`, `src/events.ts`, `app/dev` | khoảng 10 | Migrate hoặc xóa khi gặp | 3 |

**Mỗi wave là 1 PR cho mỗi route group, không gộp cả wave:**
1. Viết lại markup bằng Tailwind và component.
2. Xóa class và CSS tương ứng (cả legacy lẫn uplift).
3. Viết lại test regex CSS liên quan.
4. Hạ baseline `ui-budget`.
5. Chụp screenshot evidence.

**Mốc kiểm tra sau mỗi wave:**
- Sau wave 1: `marketing-uplift.css` **đã xóa**.
- Sau wave 2: `attendee-uplift.css` **đã xóa**, chỉ còn 2 file `*.module.css` (redeem, account).
- Sau wave 3 + D-6 + D-7: `live-pulse-legacy.css` **đã xóa**, 0 file `*.module.css`.

### 6A.4 Bước 3 · Tiêu chí "legacy sạch" (đóng epic khi tất cả đều pass)

```bash
# CSS
test ! -e apps/web/app/live-pulse-legacy.css
test ! -e apps/web/app/marketing-uplift.css
test ! -e apps/web/app/attendee-uplift.css
find apps/web/app apps/web/src -name '*.module.css' | wc -l                   # 0
ls apps/web/app/*.css                                                          # chỉ globals.css

# Tailwind đầy đủ (có Preflight), không prefix
grep -n "@import 'tailwindcss'" apps/web/app/globals.css                       # có
grep -rn "prefix(ui)\|withUiPrefix" apps/web packages/ui/src --include='*.css' --include='*.ts' --include='*.tsx' | grep -v node_modules   # 0
grep -rlE '\bui:[a-z]' apps/web/app apps/web/src packages/ui/src | wc -l       # 0

# Token: không khai báo tay trong CSS
grep -nE "^\s*--(ink|paper|signal|focus|line|muted|radius-[a-z]+|space-[0-9]+):" apps/web/app/globals.css   # 0 (chỉ đến từ vemoki-theme.css)

# A11y tự viết
test ! -e apps/web/src/nav/mobile-menu-focus.ts

# Test không regex CSS
grep -rlE "\.css['\"]" apps/web/tests | wc -l                                  # 0 (hiện 4: fe-layout-regression, marketing-bento, marketing-mobile-nav, mobile-menu-focus)

# Route admin/platform đã chuyển sang portal (D-7)
test ! -d apps/web/app/admin && test ! -d apps/web/app/platform

# Ratchet
node scripts/ui-budget.mjs                                                     # pass, baseline web CSS = 0
```

Thêm vào đó:
- ADR-22 được cập nhật thành **"Done: legacy removed"**, ghi SHA của PR cuối.
- Dọn các ghi chú "legacy" trong `globals.css` và README `packages/ui`.
- Bộ screenshot cuối toàn bộ route (vi/en × 1280/390) lưu ở `docs/reviews/assets/`.

---

## 7. Checklist PR UI (reviewer dùng để reject)

- [ ] Không tăng chỉ số `scripts/ui-budget.mjs` (CI xanh).
- [ ] Không thêm selector vào `*.css` legacy/uplift, không tạo `*.module.css` mới.
- [ ] Tương tác dùng shadcn/Radix (web) hoặc `@expo/ui` (mobile), không tự viết focus trap hay roving tabindex.
- [ ] Không hex hoặc số px tùy ý trong tsx, chỉ dùng token.
- [ ] Prefix `ui:` đứng đầu (cho đến khi xong D-1).
- [ ] Nút dùng `Button` dùng chung (web: `@ticket/ui`; mobile: `components/ui/button`).
- [ ] Screenshot trước/sau: desktop 1280 + mobile 390 (web), iOS (mobile); vi + en; có trạng thái hover/focus/disabled/loading nếu đụng control.
- [ ] axe 0 violation trên route bị chạm; có test bàn phím nếu đụng tương tác.
- [ ] `data-testid` được giữ nguyên; test không regex nội dung CSS.
- [ ] Nếu xóa CSS: nêu số dòng đã xóa trong mô tả PR.

---

## Phụ lục A — Lệnh đo lại số liệu

Nguồn chuẩn sau #792: `node scripts/ui-budget.mjs` (baseline `scripts/ui-budget.baseline.json`). Các lệnh dưới là bản đo tay ban đầu.

```bash
# Web: số dòng CSS
find apps/web/app apps/web/src -name '*.css' | xargs wc -l | sort -n

# Web: số file dùng Tailwind / @ticket/ui
grep -rlE '\bui:[a-z]' apps/web/app apps/web/src --include='*.tsx' | wc -l
grep -rlE "from '@ticket/ui" apps/web/app apps/web/src --include='*.tsx' | wc -l
find apps/web/app apps/web/src -name '*.tsx' | wc -l

# Web: variant đặt trước prefix (W-01)
grep -rnE "[a-z\]]:ui:" packages/ui/src apps/web/app apps/web/src

# Web: breakpoint
grep -hoE "@media[^{]+" apps/web/app/*.css $(find apps/web/app apps/web/src -name '*.module.css') | sort | uniq -c | sort -rn

# Web: class nút
grep -hoE "^\.[a-z0-9_-]*(btn|button|cta)[a-z0-9_-]*" apps/web/app/*.css | sort -u

# Mobile: literal spacing / font
grep -rnoE "(padding|margin|gap|borderRadius)[A-Za-z]*: [0-9]+" apps/mobile/src --include='*.tsx' | grep -v '/theme/' | wc -l
grep -rnoE "fontSize: [0-9]+" apps/mobile/src --include='*.tsx' | wc -l
grep -rnoE "typography\.[a-z]+" apps/mobile/src --include='*.tsx' | wc -l

# Mobile: Pressable / Modal / @expo/ui
grep -rlE "<Pressable" apps/mobile/src | wc -l
grep -rln "<Modal" apps/mobile/src
grep -rn "from '@expo/ui" apps/mobile/src
```

## Phụ lục B — Bằng chứng W-01 (compile Tailwind 4.1.14, `prefix(ui)`)

Input `@source inline(...)`:  
`hover:ui:opacity-95 ui:hover:opacity-90 motion-reduce:ui:animate-none ui:motion-reduce:animate-none focus-visible:ui:ring-[3px] ui:flex`

Selector sinh ra (rút gọn):

```text
.ui\:flex { … }
.ui\:hover\:opacity-90 { … }
.ui\:motion-reduce\:animate-none { … }
```

Không sinh: `hover:ui:opacity-95`, `motion-reduce:ui:animate-none`, `focus-visible:ui:ring-[3px]`.

Số class bị ảnh hưởng (`packages/ui/dist/primitives/variants.js`):

| Export | Không có tác dụng / tổng |
|---|---|
| `focusRingClass` | 5/5 |
| `buttonVariants` (default) | 9/22 |
| `inputVariants` (default) | 8/16 |
| `alertVariants` | 0/9 |
| `cardVariants` | 0/6 |

## Phụ lục C — Script tìm CSS chết

Đặt vào `apps/web/scripts/ui-dead-css.mjs` (WP-8 bước 1). Chạy từ `apps/web`: `node scripts/ui-dead-css.mjs`.

**Giới hạn của script:**
- So khớp chuỗi tên class trên toàn bộ source, nên tên chung chung (`.dot`, `.seg`, `.on`, `.site`) có thể bị tính nhầm là "còn dùng".
- Class được ghép bằng template string được tách riêng thành nhóm "dynamic". **Phải kiểm tay** trước khi xóa.

```js
import fs from 'node:fs';
import path from 'node:path';

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return ['node_modules', '.next', 'dist'].includes(e.name) ? [] : walk(p);
    return [p];
  });

const files = [...walk('app'), ...walk('src'), ...walk('../../packages/ui/src')].filter(
  (f) => /\.(tsx|ts|mjs)$/.test(f) && !/\.test\./.test(f),
);
const all = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const dyn = new Set([
  ...[...all.matchAll(/([a-z][\w-]*?(?:--|__|-))\$\{/g)].map((m) => m[1]),
  ...[...all.matchAll(/['"]([a-z][\w-]*(?:--|__|-))['"]\s*\+/g)].map((m) => m[1]),
]);

for (const css of process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['app/live-pulse-legacy.css', 'app/marketing-uplift.css', 'app/attendee-uplift.css']) {
  if (!fs.existsSync(css)) continue;
  const text = fs.readFileSync(css, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const classes = [...new Set([...text.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map((m) => m[1]))];
  const dead = [];
  const dynamic = [];
  for (const c of classes) {
    if (new RegExp(`(?<![\\w-])${c.replace(/-/g, '\\-')}(?![\\w-])`).test(all)) continue;
    ([...dyn].some((p) => c.startsWith(p)) ? dynamic : dead).push(c);
  }
  console.log(`${css}: ${classes.length} class | dead ${dead.length} | dynamic ${dynamic.length}`);
  console.log(`  dead: ${dead.join(' ')}`);
  console.log(`  dynamic (kiểm tay): ${dynamic.join(' ')}`);
}
```
