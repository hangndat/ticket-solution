# Kiểm tra gói thiết kế Vemoki — 24/10/2026

**Phạm vi:** prototype HTML/CSS trong `design-system/product/` và `design-system/marketing/`. Không phải nghiệm thu app production hoặc chứng nhận WCAG.

| Kiểm tra | Kết quả |
| --- | --- |
| Manifest payload | `python3 docs/design/vemoki-unified-v1/VERIFY.py` PASS: 56/56 file, không thiếu/thừa/sai SHA-256 hoặc kích thước |
| `impeccable detect --json` | 0 finding `low-contrast`, `undersized-ui-text`, `skipped-heading`; 51 cảnh báo/cố vấn còn lại thuộc ngôn ngữ neon đã duyệt và heuristic camera padding |
| Chrome headless qua localhost | 7/7 trang product render; 0 ảnh lỗi; tạo lại 7 ảnh trang và 4 thumbnail |
| Tràn ngang | 0/49 ở 7 trang × 320/360/390/430/768/1024/1440px |

Các màu chữ tương phản thấp đặt trực tiếp trong HTML đã được thay bằng màu đậm. Camera viewport giữ hình ảnh sát viền theo chủ đích; nhãn và chân viewport có inset. Không dùng ảnh chụp prototype làm bằng chứng vận hành Gate thật.

**Chưa chạy:** computed-style contrast audit toàn trang, axe-core, keyboard-only E2E, Safari iOS, VoiceOver, Dynamic Type và kiểm tra camera/QR trên thiết bị thật. Các gate này thuộc nghiệm thu implementation.

Các ZIP/patch cũ không thuộc kết luận kiểm tra này.
