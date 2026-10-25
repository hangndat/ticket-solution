# VD11 Portal — coordinator kiểm runtime sau fix 1/2

Source integrated `de127569` (Linh fix `59adeacb9f6e2e97647ab44bdcee4d0eb6c59e5a`), HEAD khi kiểm `68e4bf5b` chỉ thêm UAT web. Source Portal tương đương checkout `vd11-portal-recovery` chạy tại `127.0.0.1:3334`, đã restart sau build cuối. Report Linh còn nhắc SHA trung gian trước amend; SHA bàn giao thực tế là `59adeacb`.

Coordinator dùng Orca embedded browser với Owner OIDC synthetic thật, mở config fixture MFest, Escape đóng drawer mobile trước chụp, không sửa/lưu/publish dữ liệu.

| Viewport | Document scrollWidth | Hai input affix wrappers | Tiêu đề |
| --- | --- | --- | --- |
| 390×900 | 390 | 44px, 44px | Đủ «Cấu hình / brand / xuất bản»; vùng title 210.07×44px; parent clientWidth=scrollWidth=210; white-space normal, overflow visible |
| 1024×900 | 1024 | 44px, 44px | Đọc đủ, xuống dòng |
| 1440×900 | 1440 | 44px, 44px | Đọc đủ |

Ảnh đã mở kiểm tra: `/tmp/vd11-coordinator-fix-config-{390,1024,1440}.png`. Ảnh worker `/tmp/vd11-linh-fix-assets/*390.png` còn drawer mở che nội dung, chỉ dùng đối chiếu menu, không dùng làm proof form/title. Tab coordinator `d89c1f2b-5e75-4bd3-84e5-55919967c623` đã đóng.

Coordinator chạy trực tiếp `pnpm --filter @ticket/portal test` và `pnpm --filter @ticket/portal build` trên integration sau cherry-pick: đều exit 0, không pipe qua tail. Chưa có row small action trong fixture config để đo riêng. Giữ P-F03/P-F04 chờ James revalidate độc lập cùng candidate mới; web W-F01..F03 còn mở, không deploy hoặc đánh dấu acceptance complete.
