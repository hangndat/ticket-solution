# FE header mobile — căn hàng & harness (Epic #766/#770)

**Branch:** `hangndat/fe-header-mobile-fix`  
**Playwright:** `MARKETING_HOSTS='vemoki.com,www.vemoki.com,127.0.0.1,localhost' NEXT_PUBLIC_DEMO_DATA_STRIP=1 node apps/web/tests/fe-layout-regression.mjs http://127.0.0.1:3000`  
**Assets:** `docs/reviews/assets/fe-header-mobile-fix-2026-10-22/` (`results.json` + PNG 390/360/320 VI+EN)

## Thay đổi

- Marketing sales mobile: một hàng (logo + locale + ☰); CTA/đăng nhập ẩn khỏi header (`mkt-nav-desktop-only`), nút ☰/locale 44px căn giữa; hero CTA xếp cột trên mobile.
- App attendee: strip demo rút gọn + `text-wrap: balance`; `top-nav` / ☰ Menu 44px căn giữa; wordmark cố định chiều cao touch row.
- Harness `fe-layout-regression.mjs`: đo `maxTopDelta` + `maxCenterDelta` (±2px / ±1px) cho header marketing & attendee mobile.

## So sánh ảnh (sau fix)

| Surface | 390 VI | 390 EN |
| -------- | ------ | ------ |
| Marketing | `marketing-vi-390.png` | `marketing-en-390.png` |
| Attendee (privacy) | `attendee-privacy-390.png` | — |

Baseline trước fix: `docs/reviews/assets/fe-layout-fix-2026-10-22/marketing-*-390.png`, `attendee-privacy-390.png`.
