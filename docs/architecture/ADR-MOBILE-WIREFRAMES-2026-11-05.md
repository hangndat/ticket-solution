# ADR — Baseline wireframe iOS đã duyệt ngày 05/11/2026

| Trường | Giá trị |
| --- | --- |
| Trạng thái | **Đã chấp nhận về thiết kế**, chưa xác nhận implementation theo wireframe mới |
| Người quyết định | Owner, duyệt từng màn và bản tổng hợp trong phiên trao đổi 05/11/2026 |
| Phạm vi | `apps/mobile` — người tham dự và Staff Gate |
| Architecture impact | **Không** trong quyết định này: không đổi route, API, schema, auth hoặc hợp đồng Gate |
| Artifact chuẩn | [`docs/design/mobile-approved-wireframes-2026-11-05/`](../design/mobile-approved-wireframes-2026-11-05/README.md) |
| Baseline repo khi lưu | `51bd5a5b77ba6fdeeac011a0982dd6770f7bdac5` (working tree có thay đổi khác; không suy là tested SHA) |

## Bối cảnh

Owner duyệt lần lượt wireframe cho Ví A+C, Khám phá, chi tiết sự kiện, Đổi mã, chi tiết vé, Tài khoản/xóa tài khoản/quyền riêng tư, nhận vé mời, các màn Staff Gate và lời mời tham gia tổ chức. Sau đó owner duyệt board 10 trạng thái bổ sung và yêu cầu rà nút bấm ở đáy. Một board 25 màn đã được dựng lại từ mô tả nên khác hẳn các bản duyệt; owner bác bỏ. Bản tổng hợp hiện tại chụp trực tiếp **45 khung** từ 15 HTML gốc, không dùng board dựng lại đó làm chuẩn.

Quyết định này cập nhật nguồn visual iOS sau [O23, O27–O30](../DECISION-LOG.md) và nhận diện [Electric Violet](../design/electric-violet/README.md). Nó không xác nhận các màn đã tồn tại trong app, không sửa contract nghiệp vụ và không tự mở scope phát hành.

## Quyết định

1. **Nguồn visual:** dùng HTML trong `originals/` làm mẫu từng màn; `index.html` là bản xem chung và bản ghi bốn delta CTA. Không tái dựng từ mô tả hoặc dùng board 25 màn sai. Pin bytes bằng `MANIFEST.sha256`.
2. **Ví của tôi:** mẫu A+C mới đã duyệt là baseline trình bày. Màn có vé gần nhất nổi bật và danh sách vé còn lại gọn. Phần **trình bày** này thay chỉ dẫn O30 “mọi thẻ vé một hàng” trong đúng phạm vi ví iOS; giữ hành vi O30 về thứ tự vé hợp lệ/đã dùng, watermark vé đã dùng, back navigation và không nhân đôi tên sự kiện không cần thiết. Nếu một chi tiết ảnh và invariant O30 xung đột, leader ghi finding cụ thể trước khi implement, không âm thầm bỏ invariant.
3. **Nhận diện:** Electric Violet cho chrome platform iOS theo Decision Log 04/11. Event/tenant branding lấy từ dữ liệu đã publish, không dùng màu platform để ghi đè màu sự kiện. `brand/vemoki/tokens.json` là token SoT; không thêm palette, logo hay pipeline mới từ ảnh prototype.
4. **CTA và bố cục:** mỗi trạng thái có một hành động chính rõ ràng; nút phụ giảm nhấn. Nội dung dài cuộn được và nút không nằm ngoài safe area, không bị bàn phím hoặc thanh tab che. Áp đúng bốn sửa đổi ở [README](../design/mobile-approved-wireframes-2026-11-05/README.md#bốn-chỉnh-sửa-nút-sau-lượt-duyệt), đặc biệt bỏ nút về Gate trùng ở đáy Tài khoản nhân viên và đặt Đăng xuất cuối nội dung cuộn.
5. **Ranh giới nghiệp vụ:** guest/verified tabs theo O28, account root stack theo O29, privacy native theo O27, staff event/gate theo O31/O32 và Gate admission chỉ iOS Staff theo O23. Kết quả queued/unknown/offline không được trình bày như “Cho vào”; QR/mã tay chỉ hiển thị khi credential của vé được xác minh theo contract hiện hành.

## Phương án đã xét

| Phương án | Kết luận |
| --- | --- |
| Dựng lại tất cả màn từ mô tả trong một visual mới | **Loại**: đã tạo khác biệt lớn so với bản owner duyệt. |
| Chỉ lưu ảnh tổng hợp, không lưu HTML nguồn | **Loại**: mất nội dung/biến thể chi tiết và provenance của từng lần duyệt. |
| Giữ HTML gốc + board ảnh tổng hợp + delta CTA tách bạch | **Chọn**: giữ nguyên thiết kế đã duyệt, làm rõ phần sửa sau đó. |

## Hệ quả và giới hạn

- Leader triển khai phải so app thật với đúng HTML gốc và bốn delta CTA; không lấy số lượng khung làm số Task/route.
- Ảnh tĩnh chứa dữ liệu minh họa; tương tác, safe area, Dynamic Type, auth, QR, Gate, offline và animation cần được kiểm trên app thật theo AC được giao. [O33](../DECISION-LOG.md) waive a11y UAT MVP/pilot; không ghi a11y PASS từ bản thiết kế này hoặc tự mở lại gate đã waive.
- Không áp cho Web/Portal. Portal giữ Ant Design mặc định theo O26. Quyết định này không cấp quyền merge, deploy, store hoặc đóng Epic.
- Nếu code hiện tại hoặc quyết định mới hơn mâu thuẫn với wireframe, leader ghi rõ màn/state/đường dẫn và chuyển owner quyết định trong scope; không suy thiết kế tĩnh thay API/authorization.

## Handoff và xác minh

Xem [handoff cho leader](../design/mobile-approved-wireframes-2026-11-05/IMPLEMENTATION-HANDOFF.md). Lượt lưu tài liệu đã kiểm 45/45 ảnh tải được trong board, không tràn ngang ở 390 px và manifest bytes; **chưa chạy** build, simulator, device UAT hay review product exact SHA.
