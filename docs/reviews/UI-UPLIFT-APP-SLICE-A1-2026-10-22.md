# UI Uplift — App attendee Slice A1 (P0+P1 nav + catalog chrome)

| Trường | Giá trị |
| --- | --- |
| Branch | `hangndat/uiimpl-app-chrome` |
| Scope | Catalog hero ink band, nav IA, `CatalogEventCard` spotlight + Demo badge, demo strip env, skeleton loading |
| Prototype | `docs/design/ui-uplift-2026-10/app/` |

## Evidence (local `next start`, Chrome headless)

| Viewport | Ảnh |
| --- | --- |
| Desktop 1280 | ![](./assets/ui-uplift-app-slice-a1/home-catalog-desktop-1280.png) |
| Mobile 390 | ![](./assets/ui-uplift-app-slice-a1/home-catalog-mobile-390.png) |

`home-catalog-uat.mjs` PASS (grid optional when API unreachable; chrome + nav labels verified).

## Env

- `DEMO_DATA_STRIP=1` or `NEXT_PUBLIC_DEMO_DATA_STRIP=1` — strip «Dữ liệu mô phỏng»

## Checks (worker)

- `pnpm --filter @ticket/ui test`
- `pnpm --filter @ticket/web lint` · `typecheck` · `test` · `test:routes` · `build`
