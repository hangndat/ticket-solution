# UAT — Issue #813 (WP-2b shadcn Sheet mobile nav) · F01

| Trường | Giá trị |
| --- | --- |
| **SHA** | `56fddeb9f37a209aff8ba379e825b85da103d17c` (`origin/main` tip khi chụp lại) |
| **Server** | `pnpm --filter @ticket/web build && cd apps/web && NODE_ENV=production pnpm exec next start --hostname 127.0.0.1 --port 3456` |
| **Browser** | Playwright headless shell (cùng pattern `pr826-attendee-evidence.mjs` / `pr824-marketing-evidence.mjs`) |
| **Artifacts** | `docs/reviews/assets/PR813/*.png` (+ `.md5.txt` per file) |

## Viewports / routes (ma trận F01)

| File | Route | Viewport | State |
| --- | --- | --- | --- |
| `marketing-vi-mobile-390-menu-closed.png` | `/marketing` | 390×844 | menu đóng |
| `marketing-vi-mobile-390-menu-open.png` | `/marketing` | 390×844 | menu mở (Sheet) |
| `marketing-en-mobile-390-menu-closed.png` | `/marketing/en` | 390×844 | menu đóng |
| `marketing-en-mobile-390-menu-open.png` | `/marketing/en` | 390×844 | menu mở |
| `marketing-vi-desktop-1280-menu-closed.png` | `/marketing` | 1280×900 | desktop chrome |
| `attendee-vi-mobile-390-menu-closed.png` | `/` | 390×844 | menu đóng |
| `attendee-vi-mobile-390-menu-open.png` | `/` | 390×844 | menu mở |
| `attendee-vi-desktop-1280-menu-closed.png` | `/` | 1280×900 | desktop chrome |

## Lệnh chụp (main @ `56fddeb9`)

```bash
pnpm --filter @ticket/web build
cd apps/web && NODE_ENV=production pnpm exec next start --hostname 127.0.0.1 --port 3456 &
node apps/web/scripts/pr813-sheet-uat-evidence.mjs http://127.0.0.1:3456
```

Marketing routes dùng header `x-forwarded-host: vemoki.com` (giống wave 2a). Attendee `/` không cần host override.

## Đối chiếu wave 2a (#827, `docs/reviews/assets/PR826/`)

| State PR813 | MD5 (56fddeb9) | PR826 `after-0fa69c644ef7` |
| --- | --- | --- |
| Attendee header @390 closed | `e6c882e7…` | `home-header-390-after.png` — **khớp** |
| Attendee sheet @390 open | `ef5257dc…` | `nav-sheet-open-390-after.png` — **khớp** |
| Attendee header @1280 | `5cf36cd8…` | `home-header-1280-after.png` — **khác** (main tip sau merge 2a; desktop chrome đổi nhẹ, vẫn menu đóng) |
| Marketing mobile/desktop | (8 file riêng PR813) | PR826 không cover marketing VI/EN — **bổ sung trong PR813** |

Ảnh placeholder trước #842 (cùng kích thước / MD5 trùng giữa closed-open) đã **thay bằng** bộ chụp trên: script fail nếu bất kỳ hai state trùng MD5 (`pr813-sheet-uat-evidence.mjs`).

## Kết luận F01 (#813)

| AC | Trạng thái |
| --- | --- |
| Menu Sheet mobile VI/EN @390 (đóng + mở) | **Đạt** — 4 PNG marketing, MD5 phân biệt open/closed |
| Desktop @1280 (marketing + attendee, menu đóng) | **Đạt** — 2 PNG |
| Attendee mobile @390 (đóng + mở) | **Đạt** — parity header/sheet với evidence PR826 wave 2a trên attendee @390 |
| Evidence gắn SHA reproducible | **Đạt** — `56fddeb9` + lệnh trên |

**Verdict F01:** **PASS** trên `56fddeb9f37a209aff8ba379e825b85da103d17c` (không cần chụp Orca tab riêng — Playwright headless đủ cho matrix tĩnh header/Sheet; Orca UAT gate vẫn áp dụng cho task browser-driven khác).
