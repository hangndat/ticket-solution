# FE layout fix — attendee footer + marketing CLS/mobile (Epic #766/#770)

**Branch:** `hangndat/fe-layout-fix`  
**Playwright:** `node apps/web/tests/fe-layout-regression.mjs http://localhost:3000`  
**Artifacts:** `docs/reviews/assets/fe-layout-fix-2026-10-22/` (`results.json` + PNG per case)

## Thay đổi

| Vùng | Cách sửa |
| --- | --- |
| Attendee (`attendee-uplift.css`) | `body` flex column `min-height: 100dvh`, `main` `flex: 1`, footer `margin-top: auto`, `overflow-x: clip` |
| Marketing (`marketing-uplift.css`) | `scrollbar-gutter: stable`, shell flex column, locale `Link` đồng bộ kích thước, hero `min-height`, mobile clip/overflow, bento 1 cột, tắt tilt 3D mobile |

## Số đo (local `next start` @ tip branch)

- **Footer (trang ngắn):** `gapPx ≤ 2` khi `scrollHeight ≤ viewport` — ví dụ `/wallet` guest, `404`, `not-found` @ 1280/390.
- **Overflow:** `document.scrollWidth ≤ innerWidth` — marketing VI/EN @ 1280, 390, 360, 320; attendee cases trong harness.
- **Hero VI vs EN (1280):** Δ chiều cao `.mkt-hero-copy` ≈ 45px (ngưỡng harness 72px).
- **CLS load marketing:** VI + EN mỗi lần full navigation — xem `marketingLoadCls` trong `results.json` (ngưỡng 0.08).

## Checks

```bash
pnpm --filter @ticket/ui build && pnpm --filter @ticket/web-session build
pnpm --filter @ticket/web lint typecheck test test:routes build
```
