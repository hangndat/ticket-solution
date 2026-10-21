# FE web catalog wave 2 — UAT (2026-10-21)

| Trường | Giá trị |
| --- | --- |
| Epic | #715 (wave 2 post-merge) |
| Mockup SoT | `docs/plans/mobile-production-refactor/web-prototype.html` |
| Scope | Home catalog grid, color-block cards, guest «Tài khoản», footer product row |

## Checks

| Check | Kết quả |
| --- | --- |
| `pnpm --filter @ticket/web lint` | PASS |
| `pnpm --filter @ticket/web typecheck` | PASS |
| `pnpm --filter @ticket/web test` | PASS (gồm `event-media-catalog.test.ts`) |
| Headless UAT `node apps/web/tests/home-catalog-uat.mjs http://localhost:3000` | PASS (chrome); grid column AC **skipped** — API/BFF không chạy, catalog fail-closed empty/unreachable |

## Viewports

| Viewport | Artifact |
| --- | --- |
| Mobile 390 | `apps/web/.uat-artifacts/home-catalog-mobile-390-390.png` |
| Desktop 1280 | `apps/web/.uat-artifacts/home-catalog-desktop-1280-1280.png` |

Report JSON: `apps/web/.uat-artifacts/home-catalog-uat-report.json`

## Ghi chú

- Catalog grid 1/2/3 cột @ 640px / 1280px: CSS trong `globals.css` block `Home catalog`.
- Thẻ sự kiện: khối màu + initials, không poster marketing/demo banner trên home.
- Re-run UAT với D9 stack (`localhost:3000` + API public events) để xác nhận grid columns khi có dữ liệu.
