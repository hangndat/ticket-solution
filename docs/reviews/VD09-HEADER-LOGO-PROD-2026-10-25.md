# VD09 header và logo — production, 2026-10-25

- Web commit triển khai: `4b2ae3b5f7cedd3923e7d210b5369a059e072854` (gồm thay đổi header `31021060b8f50d767f968bb4c9aab8728ba6b5ae`).
- Review độc lập: [VD09-HEADER-LOGO-REVIEW-2026-10-25.md](VD09-HEADER-LOGO-REVIEW-2026-10-25.md), PASS, desktop 97/100 và mobile 96/100.
- Phạm vi: `apps/web` marketing header/logo, không đổi API, database, auth hoặc portal. Không tạo PR theo yêu cầu của chủ dự án.

## Triển khai

1. Sao lưu web đang chạy tại `/opt/vemoki/backup/web-pre-vd09-header-logo-20261025-0630.tgz` (mode `600`, 114 MB).
2. Copy web hiện tại sang `apps/web-buildtest-vd09-logo-20261025`; đồng bộ đúng các file marketing và PNG logo từ commit được review. `next build` chạy trong `vemoki-runtime:local` và thành công.
3. Chạy candidate riêng trên `127.0.0.1:3117`: `/marketing` trả 200; Playwright xác nhận không tràn ngang tại 1440/390/320, logo PNG hiện đúng, header không có CTA tư vấn, locale `<select>` nằm cuối; VI→EN giữ `#interest`; menu mobile không có primary CTA.
4. Dừng candidate, chuyển web đã build vào `apps/web`, giữ lại `.data` runtime của bản đang chạy, chuyển web cũ ra `/opt/vemoki/backup/web-pre-vd09-header-logo-tree-20261025-0630`, khởi động lại riêng `vemoki-web-1`.

## Kiểm tra sau triển khai

| Kiểm tra | Kết quả |
| --- | --- |
| `https://vemoki.com/marketing`, `https://vemoki.com/en` | HTTP 200 |
| `vemoki-web-1` | `running`, exit code 0 |
| Chỉ còn `apps/web` trong `/opt/vemoki/src/apps` | Đạt |
| `vd09-neon-interest-click.mjs https://vemoki.com` | OK |
| Playwright production 1440/390 | Logo hiện, locale cuối header, không có CTA tư vấn trong header, overflow 0 |
| VI→EN từ `/marketing#interest` | `https://vemoki.com/en#interest` |

Ảnh chụp production: [desktop](assets/vd09-production/header-logo-live-1440-2026-10-25.png), [mobile](assets/vd09-production/header-logo-live-390-2026-10-25.png).

Trạng thái: **production web đã triển khai và kiểm tra đạt**. Không kết luận pilot ready cho các slice khác.
