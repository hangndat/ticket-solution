# Quyết định coordinator — mẫu banner v2

Đây là handoff canonical cho FB08. Root dùng ủy quyền user để xác nhận hướng thiết kế; thay phần mâu thuẫn trong `HANDOFF.md` của Liv. Source baseline `30ce1da`; token/font giữ nguyên (`brand/vemoki/tokens.json`, Sora, Be Vietnam Pro).

**Đính chính:** Catalog có `CatalogHeroBand` tại `apps/web/app/(consumer)/page.tsx`, không được loại khỏi scope. Orca resize được bằng `exec --command 'set viewport W H'`. Không dùng/cài Playwright trực tiếp trong workflow này. Capture before không phải mẫu sau thiết kế.

Mẫu trực quan: `prototype.html`, hai chế độ mặc định marketing và `?view=catalog`. Layout prototype dùng ảnh capture thật `assets/catalog-runtime-baseline.png` (root Orca, product127.0.0.1:3417, 1440×1000, guest, dữ liệu demo public, trước swap local). Đây là mẫu composition, chưa phải evidence bản implement. Font assets giữ license từ `apps/web/fonts/OFL-*.txt`.

## Freeze để triển khai

- Marketing hero: nền ink phẳng, không fake chrome/device/QR. Bỏ chiều cao cưỡng bức 40rem/28rem và marquee lặp. H1 ngắn theo prototype, lead mô tả khả năng thật; một primary “Xem sản phẩm” (đích demo giữ nguyên), secondary link “Trao đổi nhu cầu” (interest), login là text link phụ. Giữ analytics/test IDs có ý nghĩa, không thêm số liệu/claim mới. VI/EN dịch tương đương.
- Desktop >=1280: hai cột 1:1.12, gap48px; <=1024 stack để ảnh không bé; mobile padding20px/gap32px. H1 tối đa3.6rem, không eyebrow. Caption ảnh nói rõ capture sản phẩm thật/dữ liệu demo. Dùng Next/Image, width/height/sizes cố định, ảnh không crop mất UI. Có thể hero dùng capture wallet khi local login xong; không phụ thuộc sửa `ProductPreviewFrame` dùng chung, thay callsite bằng component web riêng.
- Catalog: bỏ nền gradient tối/eyebrow, header giấy thoáng gọn, title/intro trái và redeem link phải; mobile stack. Card grid và search thật theo sau, không thêm hero ảnh giả hay banner quảng cáo. Root sửa shared `CatalogHeroBand`; web điều chỉnh consumer link/callsite trên nền sáng.
- Event/redeem: banner/header dùng dữ liệu thật hiện có, không thêm dải quảng cáo; giữ EventBanner ảnh bìa và tỷ lệ hình. Rà loading của các route này, không giữ root fallback catalog cho mọi surface.
- Media bento: thay mockup bằng capture sản phẩm có provenance đúng capability. Nếu chưa có ảnh thật phù hợp, dùng feature text gọn, không lấy ảnh không liên quan hoặc prototype để giả bằng chứng. Không sửa `packages/ui/ProductPreviewFrame` để lách ownership.
- Loading: root catch-all “Đang tải…” + status card lớn bị bỏ. Marketing và consumer có skeleton theo bố cục thật; skeleton giữ shell/navigation và khung ảnh/title/filter/list theo route, aria-busy + nhãn screenreader; reduced motion; không màn đệm thông báo trống toàn trang.
- Header locale cần slot VI/EN ổn định tại390/1024/1440 kể cả thay text nav. Validate bounding box, không suy “sẵn đúng” từ hai viewport đầu/cuối; active state không đổi box dimensions.

## States / nghiệm thu

Ready dùng data thật local. Loading giữ footprint, không nhảy chiều cao ảnh. Error có lời giải thích/retry; empty có nút xóa bộ lọc. Không thay auth flow. Focus rõ, link/button semantic, hình có alt đúng, contrast AA, reduced motion.

Kiểm VI/EN390/1024/1440; screenshot + measuredviewport và source media manifest. Mọi hình sản phẩm lưu provenance route/build/persona/state, không chứa token/cookie/dữ liệu khách thật. Full-flow UAT độc lập với prototype. Bộ đếm batch #869 vẫn2/2; phần chưa thực hiện tiếp tục cùng batch, không tạo vòng sửa mới.
