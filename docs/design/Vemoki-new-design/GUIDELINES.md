# Vemoki — Brand & UI Guidelines v1.0
Chốt màu: Electric Violet · 05/11/2026 · Digital-first web/app

## 01. Định hướng
Vemoki hỗ trợ vé QR, đăng ký và check-in sự kiện, với khả năng mở rộng dịch vụ. Tính cách: rõ ràng, cởi mở, năng động, đáng tin. Thiết kế ưu tiên thao tác nhanh cho cả người tổ chức và người tham dự. Không giới hạn thương hiệu vào concert.
Giá trị định hướng đề xuất: Đơn giản để sử dụng; Kết nối có ích; Chỉn chu khi vận hành; Linh hoạt để mở rộng. Đây là định hướng nội dung đề xuất, chưa phải lời hứa về tính năng đã triển khai.
Tagline làm việc đề xuất: “Mở kết nối. Chạm trải nghiệm.” Chưa đưa vào logo/app icon; chờ duyệt riêng.

## 02. Logo Connect V
Logo chính: hai nhánh V cùng tím #7038FF, giữ khoảng hở đặc trưng; wordmark đen mực. Nền tối dùng logo trắng; không tự chuyển logo sang màu UI dark. App icon nền tím, V trắng. Một màu là quy tắc bản chính.
Khoảng trống tối thiểu: 1/4 chiều cao biểu tượng ở mọi phía. Kích thước khởi điểm: biểu tượng 24 px, lockup ngang rộng 120 px; favicon 16 px chỉ dùng bản tối ưu riêng. Phải kiểm tra khe nối ở kích thước thật trước release.
Không kéo méo, đổi góc, thêm glow, viền, bóng 3D, phối hai màu tùy ý hoặc đặt trực tiếp lên ảnh rối. Dùng vùng nền sạch.
Bộ này quy định cách dùng logo; KHÔNG chứa logo SVG gốc. Hình từ vòng trước là concept raster, không phải vector master. Cần dựng/kiểm duyệt vector Connect V, outline wordmark rồi xuất SVG, PDF và PNG. Không thay wordmark bằng chữ gõ font UI.
Danh mục xuất logo: lockup tím/đen, trắng, đen; symbol tím/trắng/đen; icon 1024 PNG nền kín và các kích thước nền tảng yêu cầu; favicon SVG/ICO 16/32/48. Kiểm tra crop icon trên iOS/Android; Android tách foreground/background và monochrome asset theo pipeline của dự án.

## 03. Màu nền tảng
Brand Violet #7038FF — RGB 112,56,255. Ink #17151F — RGB 23,21,31. Cold White #FAFAFC — RGB 250,250,252. Silver #CBCDD5 — RGB 203,205,213.
Dùng sRGB cho digital. Không lấy màu bằng eyedropper từ ảnh AI. Không dùng Silver làm chữ nội dung trên trắng. In ấn cần chuyển CMYK theo profile nhà in và proof, không dùng một công thức CMYK chung.
Tỷ lệ định hướng cho UI: 75–85% nền trung tính, 10–20% nội dung/chữ, khoảng 5–10% tím ở điểm tương tác. Không áp tỷ lệ cứng cho ảnh sự kiện hay campaign.

## 04. Semantic colors
Coder dùng tên semantic trong tokens.json / vemoki.css, không rải HEX trực tiếp trong component. Màu dark mode là màu tương tác được làm sáng để dễ đọc; màu thương hiệu vẫn #7038FF.

| Token | Light | Dark |
|---|---|---|
| primary | #7038FF | #B59AFF |
| primary-hover | #6028E8 | #C7B1FF |
| primary-pressed | #5120C5 | #A17FF5 |
| on-primary | #FFFFFF | #17151F |
| primary-soft | #F1EBFF | #302347 |
| on-primary-soft | #5120C5 | #D8C9FF |
| background | #FAFAFC | #121017 |
| surface | #FFFFFF | #1D1926 |
| surface-subtle | #F3F2F7 | #282231 |
| text | #17151F | #F7F5FC |
| text-secondary | #625E70 | #BDB6CC |
| border | #DEDCE6 | #40384E |
| control-border | #858091 | #867B98 |
| focus | #7038FF | #B59AFF |
| disabled-bg | #E9E7EF | #322B3D |
| disabled-text | #777180 | #9A90AA |
| success | #137A4B | #79DCAB |
| success-bg | #EAF8F0 | #143627 |
| warning | #8A5700 | #F3CA74 |
| warning-bg | #FFF5D6 | #3A2B10 |
| error | #BE263B | #FFA2B1 |
| error-bg | #FFF0F2 | #41202B |
| info | #2459BA | #A4C5FF |
| info-bg | #EDF3FF | #1B2C49 |

Border thường dùng để phân chia trang trí. Viền input/checkbox cần control-border. Success không thay cho primary. Luôn kèm icon hoặc chữ cho trạng thái; không phân biệt vé hợp lệ chỉ bằng xanh/đỏ.

## 05. Typography
Font UI đề xuất: Be Vietnam Pro; fallback system-ui, sans-serif. Dùng 400 body, 500 label, 600 button/heading, 700 hero. Font có tiếng Việt; phải kiểm tra đủ dấu trên build thực tế. Font không kèm trong ZIP: tải từ nguồn chính thức, kiểm tra và giữ giấy phép khi self-host.
Web: self-host WOFF2 khi đã có file hợp lệ, font-display:swap. Native: bundle font tương ứng và map đúng weight; hỗ trợ Dynamic Type/font scaling. Không dùng letter spacing âm cho body tiếng Việt.

| Style | Size/line-height px | Weight |
|---|---|---|
|display|48/60|700|
|h1|36/48|700|
|h2|28/40|600|
|h3|22/32|600|
|body|16/26|400|
|small|14/22|400|
|caption|12/18|500|

Mobile display 36/46, h1 28/38; body giữ 16/26. Caption 12 chỉ cho thông tin phụ; giá, mã vé, hướng dẫn thao tác tối thiểu 14. Tránh ép chiều cao làm cắt dấu. Ngày, giờ và số lượng dùng tabular numerals khi cần căn cột.

## 06. Layout, spacing, shape
Spacing px: 0,4,8,12,16,20,24,32,40,48,64,80,96. Token JSON dùng số; native ánh xạ sang dp/pt.
Mobile <768: 4 cột, lề 16, gap 16. Tablet 768–1023: 8 cột, lề 24. Desktop ≥1024: 12 cột, gap 24, lề tối thiểu 32, content max-width 1200. Form đọc một cột max-width 480. Breakpoint là theo nội dung, không theo tên thiết bị.
Control radius 12; card 16; dialog 24; chip 999. Icon 20/24 px, stroke 1.75–2, cùng một bộ icon. Không trộn icon 3D và outline. Khoảng bấm tối thiểu theo quy ước sản phẩm 48×48; glyph nhỏ vẫn có hit area lớn.
Đổ bóng nhẹ chỉ cho lớp nổi: 0 8px 24px rgba(23,21,31,.08). Dark mode ưu tiên border hơn bóng. Thứ tự lớp: base 0, sticky 100, dropdown 200, modal 400, toast 500. Modal phải có backdrop.

## 07. Component specifications
| Thành phần | Quy định |
|---|---|
| Primary button | Cao tối thiểu 48, pad ngang 20, chữ 16/600; mỗi vùng quyết định một CTA chính; loading giữ chiều rộng, có nhãn Đang xử lý |
| Secondary / tertiary | Secondary nền surface và control-border; tertiary dạng text có hit area 48. Disabled dùng disabled tokens và thuộc tính disabled |
| Destructive action | Nút nền error, chữ nền tương phản đã kiểm tra riêng hoặc dùng chữ error trên error-bg; chỉ cho xóa/hủy; xác nhận khi không thể hoàn tác |
| Input | Label luôn hiển thị bên trên, gap 8; cao ≥48; helper/error dưới gap 4; placeholder không thay label; error kết hợp aria-invalid và aria-describedby |
| Checkbox / radio / switch | Vùng chạm 48, nhãn bấm được, trạng thái checked rõ bằng hình; switch chỉ cho thay đổi bật/tắt tức thời |
| Tabs / navigation | Selected có underline hoặc nền và chữ; aria-current cho trang hiện tại; mobile 3–5 mục chính, dùng nhãn văn bản |
| Event card | Ảnh 16:9, tên 2 dòng tối đa ở danh sách, thời gian/địa điểm rõ, badge tình trạng; detail hiển thị tên đầy đủ |
| Ticket card | Tên sự kiện, thời gian, người tham dự, loại vé, mã tham chiếu, QR và trạng thái riêng; nội dung quan trọng không bị truncate |
| Dialog / bottom sheet | Title, nội dung, hành động rõ; close accessible; trap focus, Escape khi phù hợp, trả focus về trigger; desktop max 560 |
| Table | Header rõ, row ≥48; sort có nhãn; mobile chuyển card hoặc vùng scroll có nhãn; selection không chỉ dùng màu |
| Toast / inline alert | Toast xác nhận ngắn, live region phù hợp; lỗi cần hành động giữ inline đến khi xử lý, không chỉ hiện thoáng qua |
| Search / filters | Giữ query khi quay lại, clear dễ thấy, hiển thị số kết quả; chip lọc có cách xóa và nút Xóa bộ lọc |
| Empty / loading / error | Empty giải thích + CTA; loading skeleton cùng layout; error có cách thử lại và giữ dữ liệu đã nhập |
| Pagination | Có nhãn trang, trạng thái disabled và current; danh sách quản trị ưu tiên pagination khi cần vị trí ổn định |

Tất cả component phải có default, hover (web), focus-visible, pressed/selected, disabled khi áp dụng. Form thêm filled, error, success; dữ liệu thêm loading, empty, offline. CSS đi kèm là nền tảng và mẫu button/input/card/badge, không phải thư viện component hoàn chỉnh.

## 08. Flow đặc thù sự kiện
Khách: đăng ký → xác nhận → nhận vé → mở QR → check-in. Người tổ chức: tạo sự kiện → quản lý khách → quét → kiểm tra kết quả. Chỉ hiển thị các tính năng sản phẩm thực sự hỗ trợ.
QR đen trên trắng, không gradient, không đặt logo che mã; giữ quiet zone theo thư viện QR. Bắt đầu với vùng hiển thị 240×240 CSS px, thử thực tế theo mật độ mã và thiết bị. Không dùng QR minh họa cho vé thật.
Kết quả quét: hợp lệ (success + tên + loại vé); đã sử dụng (warning + thời điểm); không hợp lệ (error + lý do); chưa xác minh/offline (neutral/info + hướng xử lý). Không báo thành công khi chưa có xác nhận backend. Khóa thao tác lặp khi đang xác thực; backend cần chống check-in trùng.
Màn vé phải có trạng thái đã hủy/hết hạn nếu sản phẩm hỗ trợ, mã tham chiếu và cách nhận hỗ trợ. Không để màu tím che thông tin QR. Dữ liệu cá nhân chỉ hiển thị theo quyền; toast không lộ thông tin không cần thiết.

## 09. Nội dung và hình ảnh
Giọng nói: ngắn, rõ, thân thiện. CTA có động từ: Tạo sự kiện, Nhận vé, Xem vé, Quét mã. Thông báo: “Check-in thành công”; “Vé này đã được sử dụng”; “Chưa thể xác minh vé. Kiểm tra kết nối và thử lại.”
Dùng ảnh sự kiện thật, đa dạng concert/workshop/corporate/community; tránh phủ tím toàn bộ ảnh. Chữ trên ảnh cần lớp nền tương phản. Không mô tả tính năng tương lai như đã sẵn sàng. Tagline không thay mô tả chức năng trên landing page.
Ngày giờ theo locale và múi giờ sự kiện, ghi rõ múi giờ khi có khán giả quốc tế; không chỉ dựa vào đồng hồ thiết bị.

## 10. Accessibility và motion
Mục tiêu WCAG 2.2 AA: chữ thường ≥4.5:1; chữ lớn ≥3:1; kiểm tra cả icon và ranh giới control cần thiết. Các cặp text chính đã được tính trong contrast-report.json; đây không phải chứng nhận toàn bộ sản phẩm đạt WCAG.
Focus ring 3 px, offset 3; keyboard navigation đầy đủ; form dùng label thật; alt text cho ảnh có thông tin; decorative icon aria-hidden. Test zoom 200%, reflow 320 CSS px, dark mode, screen reader và Vietnamese font scaling.
Animation 120/180/240ms, easing ease-out; ưu tiên opacity/transform, không nháy; tôn trọng prefers-reduced-motion. Không animation QR hoặc thông báo quét đang cần đọc.

## 11. Handoff & release checklist
1. Import CSS vào web hoặc đọc tokens.json và map semantic token cho native. JSON là cấu trúc đơn giản, không tuyên bố tương thích plugin Figma/DTCG tự động.
2. Font: tải font nguồn chính thức, đóng gói license; kiểm thử dấu tiếng Việt.
3. Hoàn thiện vector master/logo assets, kiểm tra khe V ở 16/24/32 và crop app icon.
4. Xây component đầy đủ states; gắn validation, keyboard/focus và dữ liệu thật.
5. Kiểm thử 320/375/768/1024/1440 px; light/dark; tên dài; lỗi mạng; touch; contrast trên các cặp mới.
6. Test QR thật trên camera iOS/Android, ánh sáng mạnh/yếu, màn hình độ sáng thấp và vé trùng.
7. App store assets, icon export và splash tạo theo yêu cầu nền tảng hiện hành của dự án; chưa bao gồm trong gói này.

## 12. File map và nguồn
GUIDELINES.md: tài liệu đầy đủ. GUIDELINES.html: bản xem trực quan offline, swatch và mẫu UI. vemoki.css: tokens và mẫu CSS. tokens.json: semantic palette, typography, spacing. contrast-report.json: phép tính tương phản. README.md: tích hợp.
Nguồn: https://www.w3.org/TR/WCAG22/ ; https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html ; https://github.com/bettergui/BeVietnamPro
