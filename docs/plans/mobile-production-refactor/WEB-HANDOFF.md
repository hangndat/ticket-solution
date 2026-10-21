# Web — mockup desktop và mobile

Trạng thái: **đã duyệt user** (20/10/2026) cùng gói mockup mobile + roadmap; bổ sung web là handoff thiết kế — chưa triển khai code web trong Epic #580 trừ khi Architect ghi consumer (MPR-W1).

[Mockup tương tác](web-prototype.html), chuyển Desktop / Mobile web ở trên cùng.

## Phạm vi

- Khách/người dùng: catalog công khai toàn platform, chi tiết sự kiện, số vé sở hữu theo sự kiện, đổi mã/auth gate, ví lọc theo sự kiện, QR, Tài khoản, quyền riêng tư và yêu cầu xóa.
- Nhân viên: Quét / Nhập tay / Lịch sử; trạng thái và phạm vi cổng rõ ràng, lịch sử trình duyệt có tải thêm, không giả là audit toàn hệ thống.
- Quản trị tổ chức: tổng quan, sự kiện gồm published/draft, nhập CSV có preview/lỗi, lời mời, thành viên/phân quyền, cấu hình nhận diện. Các form sâu hiện là preview luồng, không tuyên bố spec hoàn chỉnh cho từng chức năng quản trị. Không mở rộng platform-superadmin trong refactor này.

## Responsive

Desktop: header ngang; ba cột sự kiện; detail hai cột; ví hai cột; sidebar quản trị và bảng dữ liệu. Mobile web: menu thu gọn có điều hướng theo vai trò, danh sách một cột, detail/CTA xếp dọc, bảng chuyển thành thẻ có nhãn, menu quản trị cuộn ngang. Đây là website, không mô phỏng native bottom tabs.

Không thêm CTA đăng nhập trùng trên card sự kiện; guest ẩn Vé của tôi. Đổi mã cần auth rồi quay lại tác vụ; số đếm lấy toàn ví theo eventId và subject, không đếm rows của trang hiện tại. Quyền thông báo web tách khỏi APNs/iOS; chưa hứa hỗ trợ browser push nếu không có contract. Chính sách mở trong cùng website.

## Kiểm tra mockup

Đã mở trong Orca browser, render 144 tổ hợp vai trò/màn/kích thước và kiểm tra cú pháp onclick; bấm card count mở ví lọc MFest; guest không thấy count/ví; mobile table thành thẻ, không overflow ngang ở 388px. Đã xem screenshot desktop và mobile, sửa menu desktop thừa và lớp trang trí chồng chữ. Không gọi API, không gửi email, không auth thật, không UAT production.
