# Vemoki · Electric Violet

> **Lưu trữ lịch sử (04/11/2026).** Trạng thái “chưa tích hợp” và các nhận định release bên dưới phản ánh thời điểm lập bản bàn giao, không phải trạng thái sản phẩm hiện tại. Xem [tài liệu runtime](../../README.md) và [nguồn brand canonical](../../../../../brand/vemoki/README.md) trước khi triển khai.

Bộ logo và đặc tả Design System dựa trên ảnh user đã duyệt ngày 04/11/2026. Liv (product-design) thực hiện; coordinator kiểm tra artifact sau hai batch sửa và một ngoại lệ export có chẩn đoán. Đây là **bàn giao thiết kế local**, chưa tích hợp token/logo vào ứng dụng.

## Xem và tải

- [Preview logo, foundations, components và màn mẫu](preview/index.html)
- [Tải bộ logo SVG + PNG + hướng dẫn (ZIP)](logo/vemoki-electric-violet-logo-kit.zip)
- [Logo ngang](logo/png/horizontal-primary.png) · [logo dọc](logo/png/stacked.png) · [biểu tượng](logo/png/mark.png)
- [Quy định sử dụng logo và provenance](logo/README.md)
- [Foundations và mapping token](specs/foundations.md) · [Components và trạng thái](specs/components.md)
- [Báo cáo, evidence và giới hạn](REPORT.md)

Preview tham chiếu asset/font tương đối trong checkout; bộ ZIP chứa logo độc lập. Chữ trong các SVG logo là path, không phụ thuộc font cài trên máy.

## Kết quả kiểm tra bàn giao

Coordinator đã xem ảnh đối chiếu mark/wordmark với mẫu duyệt, PNG logo ngang/dọc, bản đảo trắng trên tím và ảnh tile dọc. Lỗi hình V và lỗi cắt chữ đã được xử lý. Kiểm tra tự động ngày 04/11/2026: 10 SVG chứa path, không nhúng ảnh hoặc chữ sống; logo PNG có alpha, nguồn app icon 1024×1024 nền kín; 20 file SVG/PNG trong ZIP trùng bytes với file hiện tại. Worker báo kiểm transformed path bounds 10/10 SVG nằm trong viewBox; số đo tái dựng silhouette và phương pháp được ghi trong REPORT.

SVG được trace từ ảnh raster đã duyệt, không phải file vector gốc; các cạnh còn giữ dấu vết pixel khi phóng lớn. Hex chuẩn hóa và token derived là đề xuất trong foundations, không coi mọi token là đã được user duyệt riêng. `brand/vemoki/tokens.json` vẫn là nguồn runtime hiện hành; không tạo token SoT thứ hai.

## Bước tích hợp theo ownership

Coordinator đối chiếu quyết định brand và mapping token với pipeline hiện có; Web/iOS triển khai theo task riêng và kiểm runtime. Portal giữ Ant Design mặc định theo O26. Artifact này không chứng minh code complete, UAT, production ready hoặc cho phép deploy/store.
