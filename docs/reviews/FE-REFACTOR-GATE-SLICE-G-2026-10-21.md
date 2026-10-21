# Slice G — gate chrome (Epic #715)

| Trường | Giá trị |
| --- | --- |
| Task | `task_ab8df424b1e3` |
| Scope | `apps/web/app/gate/**`, `globals.css` block Slice G |
| Mockup SoT | `docs/plans/mobile-production-refactor/web-prototype.html` |
| Logic | Giữ `apps/web/src/gate/*` — không đổi BFF/auth |

## Thay đổi

- `gatebar` phạm vi + trạng thiết bị (kết nối).
- Tab **Quét vé / Nhập tay / Lịch sử** (mockup staff IA).
- Tab quét: khung camera (CSS) + sidebox; CTA sang nhập tay.
- Tab nhập tay: giữ luồng phiên / giữ chỗ / xác nhận + fail-closed.
- Tab lịch sử: bảng responsive `data-label`, tìm kiếm cục bộ, «Tải thêm», đối soát.

## Checks

```bash
pnpm --filter @ticket/contracts build && pnpm --filter @ticket/web-session build
pnpm --filter @ticket/web lint && pnpm --filter @ticket/web typecheck && pnpm --filter @ticket/web test
```

## UAT headless

```bash
# Dev server + API/OIDC tùy môi trường
node apps/web/tests/fe-refactor-gate-chrome-uat.mjs http://127.0.0.1:3000
```

Artifacts: `docs/reviews/assets/fe-refactor-gate-2026-10-21/*.png` (1280 + 390).

**Giới hạn:** Khi chưa có phiên nhân viên, SSR soft-redirect khỏi `/gate` — script vẫn chụp landing; tab chrome chỉ xuất hiện sau đăng nhập + capability cổng (giống UAT a11y gate).
