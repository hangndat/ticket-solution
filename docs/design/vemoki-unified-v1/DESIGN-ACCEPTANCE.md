# Chốt hướng thiết kế Vemoki — 24/10/2026

**Trạng thái: design complete cho handoff triển khai.** Đây là prototype tĩnh; chưa phải code complete, acceptance complete hay pilot ready.

## Quyết định phạm vi

- User quyết định bỏ Web Gate. Chỉ workspace Staff của app iOS được quét QR, nhập tay và xác nhận vào cổng theo quyền và kết quả backend. Attendee web/iOS chỉ hiển thị vé; Portal chỉ đọc báo cáo Gate theo `report.read`.
- [Decision Log O23](../../DECISION-LOG.md) thay phần `GATE-STAY-APP` cũ. Trước khi tắt route `/gate` cần Task Spec, contract/ADR, kiểm kê deep link/client, phương án giải thích/redirect và nghiệm thu migration. Không suy ra route đã bị xóa từ bản thiết kế.
- Bản chuẩn để implement là thư mục này; các ZIP/patch cũ ngoài thư mục không có hiệu lực thay thế.

## Kết quả kiểm tra prototype

| Kiểm tra | Kết quả |
| --- | --- |
| Đối chiếu manifest SHA-256/kích thước | PASS; không thiếu hay sai payload |
| `impeccable detect` trên marketing + product | Không còn finding tương phản thấp, chữ chức năng quá nhỏ hoặc nhảy cấp heading |
| Render Chrome headless qua localhost | 7/7 trang product, ảnh tải đầy đủ; preview và bốn thumbnail được tạo lại |
| Tràn ngang 320/360/390/430/768/1024/1440 | 0/49 trường hợp trên bảy trang product |

Marketing giữ ngôn ngữ neon đã duyệt. Các cảnh báo detector về gradient, glow và nhãn trang trí không tự động đảo hướng thị giác. Cảnh báo padding ở camera viewport là heuristic: nhãn và chân viewport có inset, vùng camera chạy sát viền theo chủ đích.

## Gate còn mở khi triển khai

- Kiểm tra contrast theo computed style và axe-core trên app/web thực tế; keyboard, screen reader/VoiceOver, 200% zoom và Dynamic Type.
- iOS simulator và thiết bị thật cho camera, QR, trạng thái offline/unknown/pending, recovery và quyền Staff. Kết quả queued không được hiển thị như admission thành công.
- Kiểm thử route migration `/gate`, auth/RBAC, deep link, audit, monitoring và rollback trước khi tắt Web Gate production.
- Duyệt quyền sử dụng ảnh/font và copy minh họa trước khi phát hành. Số liệu/event/QR trong prototype không phải dữ liệu production.
