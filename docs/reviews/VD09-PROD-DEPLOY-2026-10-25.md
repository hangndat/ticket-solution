# VD-09 — phát hành marketing neon lên production

Ngày kiểm tra: **2026-10-25 05:39 UTC**. Kết quả: **PASS — `https://vemoki.com/` đang phục vụ trang neon mới**.

## Nguồn và phạm vi

- Mã marketing được reviewer Mira nghiệm thu tại `d238356ff72bab0790dc5184428a7b46e2611544`: desktop **95/100**, mobile **95/100**; chi tiết tại [vd09-marketing-neon-uiux.md](./vd09-marketing-neon-uiux.md).
- User xác nhận quyền sử dụng ảnh bàn giao cho production ngày 2026-10-25; ghi nhận trong `apps/web/public/marketing/neon/PROVENANCE.md` ở commit `2fcb955b`. Không thực hiện audit giấy phép độc lập.
- Chỉ phát hành service `web`. API, worker, Keycloak, Postgres, nginx và dữ liệu nghiệp vụ không được thay mã/cấu hình. Giữ `apps/web/.data` hiện hữu khi đổi thư mục.
- VPS `/opt/vemoki/src` không có `.git` và có mã web đang chạy khác `origin/main`. Bản build production là **cây web VPS hiện hữu + mã/tài nguyên marketing VD-09 + `app/globals.css` đã duyệt**, không phải toàn bộ checkout Git tại một SHA. Đây là giới hạn tái lập cần xử lý ở đợt đồng bộ source sau; không nhận diện toàn bộ service bằng SHA marketing.

## Triển khai và phục hồi

1. Tạo backup `/opt/vemoki/backup/web-pre-vd09-20261025T053058Z.tgz` (mode 600); giữ thêm cây trước deploy tại `/opt/vemoki/backup/web-vd09-prev2-20261025` để rollback.
2. Dựng ứng viên ở `apps/web-vd09-buildtest`, build bằng `vemoki-runtime:local` và smoke qua cổng nội bộ 3117. Lần build đầu phát hiện hai file marketing và khối token neon trong `app/globals.css` còn thiếu trên VPS so với baseline Git; đã đồng bộ đầy đủ rồi build lại **exit 0**.
3. Lần swap đầu trả HTTP 200 nhưng ảnh live sai màu/chữ do thiếu token CSS; đã rollback ngay về cây trước deploy. Ngoài ra bản rollback để trong `apps/` làm `pnpm --filter @ticket/web` chạy hai app và cổng 3000 bị chiếm; đã chuyển rollback ra `/opt/vemoki/backup` để phục hồi service.
4. Ứng viên thứ hai được **chụp desktop/mobile trước swap**, hiển thị đúng neon; Playwright click form trên ứng viên **OK**. Sau swap, `vemoki-web-1` ở trạng thái `running` và trang live được chụp lại.

## Smoke sau deploy

| Kiểm tra | Kết quả |
| --- | --- |
| `https://vemoki.com/`, `/marketing/en`, `/privacy` | 200 |
| `https://vemoki.com/marketing/neon/hero-composite-v2.png` | 200 |
| `https://app.vemoki.com/` | 200 |
| `https://api.vemoki.com/v1/health` | 200 |
| Playwright `vd09-neon-interest-click.mjs` trên `https://vemoki.com` | OK: hero/CTA cuối/nav, deep link, form visible, Escape |
| Live mobile/desktop: `html[data-vemoki-marketing]` | `neon-v1`; headline VI đúng |
| Tràn ngang live ở 320/390/768/1440 px | 0 px mỗi viewport |

Ảnh **trang live**: [desktop 1440](./assets/vd09-production/marketing-vi-desktop-1440.png) (`sha256:4eec21ee0d495b11dea9e7875823083d295911dff27e8812c9af8b1ac37ab8bc`) và [mobile 390](./assets/vd09-production/marketing-vi-mobile-390.png) (`sha256:29855b63cf92e8afb48db0ac94c3199588466c9e886429b004f32546ba1fb171`).

## Giới hạn

- Chưa gửi form thật trên production để tránh tạo lead/email thử; đã kiểm tra mở form, trường nhập và đóng dialog trên domain thật, còn validation và route có test local.
- Chưa chạy đăng nhập tài khoản thật hoặc luồng attendee/staff có xác thực sau deploy; smoke product chỉ kiểm tra route công khai.
- Lệnh `docker compose start web` có khởi chạy lại các dependency one-shot `migrate`/`minio-init` theo compose; không đồng bộ migration hay thay cấu hình dịch vụ này, API health vẫn 200.
- Không mở GitHub PR theo yêu cầu user. Production đang chạy bản ghép trên cây VPS; cần hợp nhất source VPS vào quy trình release Git ở đợt kế tiếp để có SHA toàn service.
