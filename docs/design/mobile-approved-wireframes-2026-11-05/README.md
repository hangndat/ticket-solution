# Wireframe iOS đã duyệt — 05/11/2026

**Trạng thái:** thiết kế đã được owner duyệt trong phiên trao đổi ngày 05/11/2026; **chưa phải UI đã triển khai hoặc nghiệm thu runtime**. Phạm vi là app iOS người tham dự và Staff Gate. Không áp dụng cho Web hoặc Portal.

## Xem bản tổng hợp

- [Board tổng hợp 45 khung](index.html): ảnh chụp trực tiếp từ các bản duyệt, chia theo luồng. Bốn chỉnh sửa nút bấm được ghi và minh họa dưới màn liên quan.
- [ADR quyết định thiết kế](../../architecture/ADR-MOBILE-WIREFRAMES-2026-11-05.md).
- [Handoff cho leader triển khai](IMPLEMENTATION-HANDOFF.md).
- [Manifest SHA-256](MANIFEST.sha256) cho `index.html` và 15 HTML gốc.

`index.html` tự chứa 45 ảnh WebP để xem độc lập. Các HTML trong `originals/` giữ nguyên wireframe từng lượt duyệt, không lấy bản tổng hợp 25 màn đã vẽ lại sai làm nguồn. Board tổng hợp **không** thay thế từng HTML gốc khi cần đối chiếu bố cục chi tiết.

## Bản gốc theo luồng

| Luồng đã duyệt | Khung | HTML gốc |
| --- | ---: | --- |
| Vé của tôi, kết hợp phương án A+C | 1 | [wallet](originals/wallet-wireframe-hybrid-ac.html) |
| Khám phá | 1 | [explore](originals/explore-review-wireframe-20261105.html) |
| Chi tiết sự kiện | 2 | [event detail](originals/event-detail-wireframe-20261105.html) |
| Đổi mã nhận vé | 2 | [redeem](originals/redeem-wireframe-20261105.html) |
| Chi tiết vé, QR và mã nhập tay | 3 | [ticket detail](originals/ticket-detail-wireframe-20261105.html) |
| Tài khoản | 1 | [account](originals/account-wireframe-20261105.html) |
| Xóa tài khoản | 3 | [account deletion](originals/account-deletion-wireframe-20261105.html) |
| Chính sách quyền riêng tư | 2 | [privacy](originals/privacy-wireframe-20261105.html) |
| Nhận vé mời | 3 | [claim invitation](originals/claim-invitation-wireframe-20261105.html) |
| Gate quét vé | 3 | [gate scan](originals/gate-scan-wireframe-20261105.html) |
| Trạng thái/kết quả Gate | 5 | [gate status](originals/gate-scan-status-wireframe-20261105.html) |
| Gate nhập mã tay | 5 | [gate manual](originals/gate-manual-wireframe-20261105.html) |
| Lịch sử Gate | 2 | [gate history](originals/gate-history-wireframe-20261105.html) |
| Lời mời tham gia tổ chức | 2 | [membership invite](originals/membership-invite-wireframe-20261105.html) |
| Trạng thái bổ sung: quyền nhân viên, tài khoản nhân viên, rỗng/lỗi | 10 | [remaining states](originals/remaining-mobile-wireframes-20261105.html) |

Tổng: **45 khung**. Một HTML có thể chứa nhiều biến thể/trạng thái của cùng một màn; số khung không phải số route production.

## Bốn chỉnh sửa nút sau lượt duyệt

Các ảnh gốc được giữ để bảo toàn provenance. Khi triển khai, áp dụng các chỉnh sửa được owner chấp thuận sau đó:

1. **Tài khoản nhân viên:** dùng nút quay lại trên thanh đầu trang để về Gate, bỏ CTA “Quay lại quét vé” trùng ở đáy. “Đăng xuất” ở cuối nội dung cuộn; không để bị cắt ngoài màn.
2. **Khám phá trống:** “Làm mới” là hành động phụ. Trạng thái không có sự kiện không được diễn tả như lỗi kết nối.
3. **Link mời không hợp lệ:** khách chưa đăng nhập về **Sự kiện**; tài khoản đã xác minh có thể về **Vé của tôi**.
4. **Chi tiết sự kiện không sẵn sàng:** link sai/sự kiện không công khai chỉ đưa về **Khám phá**; “Thử lại” chỉ hiện cho lỗi kết nối có thể thử lại.

Trên mọi màn có nút đáy: chừa safe area, cho phần nội dung dài cuộn riêng và giữ hành động chính trong vùng bấm được. Đối chiếu bản duyệt và chỉnh sửa CTA như một gói; không suy từ ảnh gốc rằng lỗi cắt nút đã được xử lý trong app.

## Thứ tự nguồn và giới hạn

- Hành vi, quyền và route theo [Decision Log](../../DECISION-LOG.md), đặc biệt O23, O27–O31, O33 và quyết định Electric Violet; [PRD](../../PRD.md) và [Technical Design](../../TECHNICAL-DESIGN.md) vẫn là contract nghiệp vụ.
- Nhận diện theo [Electric Violet](../electric-violet/README.md) và `brand/vemoki/tokens.json`; board này không tạo token hoặc logo SoT khác.
- Bộ này là visual baseline mới cho **iOS**. Khi khác O30 về cách trình bày ví, áp quyết định scoped trong [ADR](../../architecture/ADR-MOBILE-WIREFRAMES-2026-11-05.md); giữ invariants nghiệp vụ O30.
- Dữ liệu sự kiện, email, vé và QR trong wireframe là minh họa. HTML/ảnh tĩnh không chứng minh auth, admission, offline, safe area trên máy thật, CI hoặc UAT.

**Kiểm tra khi lưu:** 45/45 ảnh trong board tải được ở desktop và khổ 390 px; không có cuộn ngang. `MANIFEST.sha256` pin bytes của 16 HTML. Không chạy app build hay UI UAT trong lượt tài liệu này.
