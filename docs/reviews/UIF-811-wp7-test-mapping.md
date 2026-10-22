# UIF-811 WP-7 — mapping assertion CSS → hành vi

SHA tip: `dbc7397558ad3e3080cbb35836204a2358a2a488`

| File test | Assertion cũ (regex / đọc `.css`) | Thay bằng |
| --- | --- | --- |
| `fe-layout-regression.test.ts` | `attendee-uplift.css`: `100dvh`, `margin-top: auto`, flex | `layout.tsx`: `attendee-uplift` + `data-testid="site-footer"`; Playwright UAT `fe-layout-regression.mjs` (footer gap) |
| `fe-layout-regression.test.ts` | `marketing-uplift.css`: `scrollbar-gutter`, `overflow-x: clip`, `.mkt-locale a[aria-current]` | SSR `LocaleSwitch` `aria-current`; `chrome.tsx` `marketing-surface`; overflow UAT `fe-layout-regression.mjs` |
| `marketing-bento.test.ts` | `@media (prefers-reduced-motion)` trên `.mkt-bento-*` trong CSS | SSR: 7 tile + không `motion/react`; Playwright `marketing-bento-reduced-motion.mjs` (transition/animation `0s`) |
| `marketing-bento.test.ts` | `.mkt-bento-grid` + `animation-timeline: view()` trong CSS | SSR: grid tĩnh, không motion island; scroll reveal giữ CSS-only (không assert file CSS) |
| `marketing-mobile-nav.test.ts` | `@media (max-width: 767px)` ẩn links / hiện toggle trong CSS | `chrome.tsx` + `marketing-mobile-nav-menu.tsx` testid/structure; Playwright `marketing-mobile-nav-viewport.mjs` |
| `mobile-menu-focus.test.ts` | Không còn comment Slice G / `.gate-page` trong `live-pulse-legacy.css` | `app/gate` không tồn tại; redirect `/gate` đã có `routes.integration.mjs` + nav tests D-6 |

`grep -rlE "\.css['\"]" apps/web/tests` → **0** (sau PR).

Evidence: `docs/reviews/assets/uif-811-wp7/` (before = `origin/main`, after = branch).
