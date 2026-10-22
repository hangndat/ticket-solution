# Header + menu mobile — shadcn `Sheet` (thay #784)

**Surfaces:** marketing (`vemoki.com`, host marketing) · attendee (`app.vemoki.com`, catalog/guest).  
**Component mục tiêu:** `Sheet` + `SheetTrigger` + `SheetContent` (Radix Dialog) — `side="right"`, portal body, scroll lock, focus trap, Esc đóng.  
**Prototype:** [prototype/header-mobile-sheet.html](./prototype/header-mobile-sheet.html).

---

## Visual budget

| | Marketing | Attendee (app) |
| --- | --- | --- |
| Nền header | `bg-ink` / chữ `text-paper` | `bg-paper` / chữ `text-ink` |
| Border dưới | `border-line/30` trên ink | `border-line` |
| CTA header | `Button` variant primary (signal) — **một dòng** | Không CTA đỏ header (guest); đăng nhập trong sheet |
| Logo | wordmark `vemoki↗`, `font-display` | wordmark + optional demo strip |

---

## Hàng chrome (mobile &lt; `md`)

**Chiều cao hàng:** `min-h-14` (56px) với `py-2` (`space.sm`); **không** fixed 44px cho cả hàng — chỉ control vuông 44×44.

**Grid (CSS grid):**

```text
[ logo (1fr min) ] [ gap space.xl ] [ locale? ] [ CTA? ] [ menu 44×44 ]
```

| Cột | Marketing | Attendee |
| --- | --- | --- |
| Logo | `flex items-center`, wordmark một dòng | Cùng, căn **center** theo trục dọc với Menu |
| Locale | `Toggle` hoặc 2 nút VI/EN, `min-w-[44px]` mỗi | Chỉ khi route i18n; guest catalog VI mặc định |
| CTA | `Quan tâm` / `Interest` — `whitespace-nowrap text-sm px-3` | — |
| Menu | `SheetTrigger` icon + label «Menu» / «Đóng» khi mở | Cùng pattern |

### Khắc phục FAIL #784

| ID | Yêu cầu | Spec |
| --- | --- | --- |
| F784-001 | CTA VI gãy 2 dòng | `whitespace-nowrap`; copy **«Quan tâm»** (không «Đăng ký quan tâm» trên header); `text-sm font-semibold`; `min-w-0` **cấm** trên nút CTA; thu nhỏ locale trước khi cắt CTA |
| F784-002 | EN @320 chồng locale | Thứ tự: logo shrink → ẩn label Menu chỉ giữ icon @320 EN nếu cần → CTA `px-2.5` → locale `gap-1`; **không** `position:absolute` chồng |
| F784-003 | Menu app lệch trục | `items-center` trên hàng; trigger `inline-flex items-center justify-center h-11 w-11` (44px); label «Menu» `text-xs` **bên trong** hoặc `sr-only` + icon căn giữa |
| F784-004 | Đóng menu lệch | `SheetClose` cùng class trigger; `leading-none` |
| F784-005 | Demo strip | `text-xs py-1.5 px-3`; `whitespace-nowrap` trên date; wrap chỉ giữa `·` |

**Căn trục logo ↔ Menu:** `maxTopDelta ≤ 2px` giữ **center** bounding box logo và nút 44px (giữ harness PR, bổ sung assert **single-line CTA** trong test mới).

---

## Viewport

| Width | Kiểm tra |
| --- | --- |
| 390 | Baseline iPhone |
| 360 | Android phổ biến |
| 320 | Hẹp — EN marketing bắt buộc không chồng |

Locale: VI + EN cho mỗi width. State: menu **đóng** + **mở**.

---

## Sheet (mở)

| Thuộc tính | Giá trị |
| --- | --- |
| `side` | `right` |
| Width | `w-[min(100vw-3rem,20rem)]` hoặc `max-w-sm` |
| Nền | marketing: `bg-ink text-paper`; attendee: `bg-paper text-ink` |
| Overlay | `bg-ink/60` |
| Padding | `p-space.lg` (`p-4`) |
| Nav links | `flex flex-col gap-space.md`; focus ring `ring-focus` |
| Scroll | `overflow-y-auto` trong sheet; **body scroll lock** (Radix mặc định) |

### A11y (bắt buộc)

- Trigger: `aria-expanded`, `aria-controls={id}`, `data-testid` giữ tên hiện có (`marketing-mobile-nav-toggle`, `site-mobile-menu-toggle`, …).
- Sheet: `role="dialog"` `aria-modal="true"`; title ẩn `SheetTitle` sr-only «Menu chính» / «Main menu».
- **Esc** đóng; focus vào link đầu hoặc close; tab trap trong sheet.
- **Reduced motion:** `data-[state=open]:animate-in` tắt khi `prefers-reduced-motion: reduce` — dùng `motion-reduce:transition-none motion-reduce:animate-none`.

---

## Marketing copy (header)

| Locale | CTA | Menu |
| --- | --- | --- |
| VI | Quan tâm | Menu / Đóng |
| EN | Interest | Menu / Close |

Links sheet: Tính năng, Cách hoạt động, Giải pháp, FAQ, Xem demo — đồng bộ prototype #770.

---

## Attendee copy (header guest)

- Demo strip (khi bật): `Dữ liệu mô phỏng · app.vemoki.com · PD 2026-10-22` — không ngắt giữa ngày.
- Sheet: Vé của tôi, Đổi vé, Sự kiện, … theo nav hiện tại `site-chrome` (giữ route, đổi shell Sheet).

---

## Implement (#794)

1. `npx shadcn@latest add sheet` (sau D-1 prefix).
2. Thay `marketing-mobile-nav-menu.tsx` + phần menu `site-chrome.tsx`.
3. Xóa `mobile-menu-focus.ts` khi không còn import.
4. Test: Playwright `data-testid`, một dòng CTA VI @320–390, `aria-expanded`, Esc.

**data-testid:** không đổi tên đã có trừ coordinator đồng ý — map vào `SheetTrigger` / `SheetContent`.
