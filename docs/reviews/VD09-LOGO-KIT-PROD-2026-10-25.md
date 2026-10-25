# VD09 logo kit mới — production, 2026-10-25

- Mã được triển khai: `fbca335536c22409f5b59d483f6a0584314e9fcd` (web gồm toggle VI/EN + decor neon `5bc8b4bf`, logo kit `a8a14349`, `8b815f26`; portal `fbca3355`).
- Review độc lập: [VD09-TOGGLE-DECOR-REVIEW-2026-10-25.md](VD09-TOGGLE-DECOR-REVIEW-2026-10-25.md) PASS; [VD09-LOGO-KIT-REVIEW-2026-10-25.md](VD09-LOGO-KIT-REVIEW-2026-10-25.md) PASS (web 90, mobile 85) + revalidation `fbca3355` (LK-01, LK-02 đóng; portal PASS, LK-03 low mở).
- Phạm vi deploy: service `web` và `portal`. Không đổi API, worker, DB, Keycloak, nginx. Mobile (`5dc0c05a`, `e9355e9c`) chỉ có trong repo, chưa build/phát hành iOS. Không tạo PR theo yêu cầu chủ dự án.

## Web

1. Đối chiếu SHA-256 trên VPS: mọi file web bị sửa khớp `4b2ae3b5` (bản deploy trước) → overlay an toàn.
2. Backup `/opt/vemoki/backup/web-pre-vd09-logokit-20261025-0718.tgz` (mode 600, không gồm node_modules/.next) và cây cũ `/opt/vemoki/backup/web-pre-vd09-logokit-tree-20261025-0718`.
3. Candidate `apps/web-buildtest-logokit` + 18 file runtime từ `fbca3355` (hash verify OK); `next build` trong `vemoki-runtime:local` exit 0.
4. Candidate cổng 3117: `/marketing`, `/marketing/en`, favicon/icon/apple-icon/OG/V mark/decor đều 200; Playwright qua tunnel 1440/390 overflow 0, header `… Đăng nhập VI EN`.
5. Swap giữ `.data` của bản đang chạy, restart riêng `vemoki-web-1` → running.

## Portal

VPS portal **cũ hơn repo** (`globals.css`, `portal-pro-layout.tsx` khác `main`). Không đè toàn bộ file; chỉ áp patch logo của `fbca3355` lên bản VPS (hunk CSS sider thu gọn thêm tay cuối `globals.css`) + file mới (favicon.ico, icon.png, apple-icon.png, public/brand/vemoki-v-mark.webp/png, portal-brand-lockup.tsx). Backup `/opt/vemoki/backup/portal-pre-vd09-logokit-20261025-0718.tgz` và cây `portal-pre-vd09-logokit-tree-20261025-0718`. Build exit 0, candidate 3118 smoke 200, swap, restart `vemoki-portal-1` → running.

## Kiểm tra sau triển khai

| Kiểm tra | Kết quả |
| --- | --- |
| `https://vemoki.com/marketing`, `/en`, `/favicon.ico`, `/icon.png`, `/opengraph-image.png` | 200 |
| `https://app.vemoki.com/`, `https://api.vemoki.com/v1/health` | 200 |
| `https://portal.vemoki.com/auth`, `/favicon.ico`, `/brand/vemoki-v-mark.webp` | 200; mark load OK |
| `vd09-neon-interest-click.mjs https://vemoki.com` | OK |
| Playwright live 1440/390 | overflow 0, logo mới, VI/EN cuối header |

Ảnh live: [web 1440](assets/vd09-production/logokit-live-1440-2026-10-25.png), [web 390](assets/vd09-production/logokit-live-390-2026-10-25.png), [portal auth](assets/vd09-production/logokit-live-portal-auth-2026-10-25.png).

## Giới hạn

- Portal production vẫn là bản cũ hơn `main` + patch logo; cần đợt đồng bộ source VPS riêng.
- Không đăng nhập tài khoản thật sau deploy; chỉ smoke route công khai.
- Rollback: dừng service, đổi lại thư mục từ `*-tree-20261025-0718` trong `/opt/vemoki/backup`, start lại.
