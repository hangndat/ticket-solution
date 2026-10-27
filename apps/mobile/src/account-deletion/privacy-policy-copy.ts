/**
 * Native privacy body — Vietnamese product copy.
 * Source: apps/web/src/marketing/copy.ts keys privacy.* (locale vi, 2026-10-18).
 * Do not invent legal terms here; keep in sync with that file.
 */
export const PRIVACY_POLICY_TITLE = 'Chính sách quyền riêng tư';

export const PRIVACY_POLICY_UPDATED = 'Cập nhật: 2026-10-18';

export const PRIVACY_POLICY_INTRO =
  'Vemoki (`vemoki.com`) xử lý dữ liệu cần thiết để vận hành nền tảng sự kiện và trả lời đăng ký quan tâm. Thời gian lưu giữ, vùng dữ liệu và mức hỗ trợ dưới đây là chính sách hiện hành cho bản MVP.';

export const PRIVACY_POLICY_SECTIONS: readonly {
  title: string;
  body: string;
}[] = [
  {
    title: 'Dữ liệu chúng tôi thu',
    body: 'Tài khoản / phiên đăng nhập (email, mã định danh từ nhà cung cấp đăng nhập Keycloak / user ID); thông tin sự kiện và mã/vé / nội dung QR hiển thị; dữ liệu check-in; mã thiết bị nhận thông báo đẩy (Apple Push) khi bật thông báo; form quan tâm hoặc form sự kiện (tên, email, tổ chức, vai trò, loại tổ chức/quy mô sự kiện nếu bạn chọn điền, điện thoại nếu sự kiện yêu cầu); nhật ký kỹ thuật cần thiết (IP, trình duyệt, thời gian). Không bán dữ liệu; MVP không dùng SDK quảng cáo / theo dõi xuyên app.',
  },
  {
    title: 'Mục đích',
    body: 'Xác thực và phân quyền; cấp / hiển thị / xác thực vé; gửi thông báo giao dịch (email và, nếu bật, thông báo đẩy); hỗ trợ và theo dõi bán hàng; bảo mật, nhật ký kiểm toán và chống lạm dụng; tiếp nhận yêu cầu xóa tài khoản như mô tả bên dưới.',
  },
  {
    title: 'Máy ảnh và thông báo',
    body: 'Máy ảnh (app iOS Gate): quét mã QR vé trên thiết bị tại cổng cho nhân sự được cấp quyền. Quét realtime trên thiết bị — mặc định không lưu ảnh vào thư viện và không tải ảnh quét lên máy chủ. Thông báo: tùy chọn; dùng cho cập nhật giao vé / nhắc sự kiện; có thể tắt trong Cài đặt iOS.',
  },
  {
    title: 'Lưu giữ',
    body: 'Yêu cầu xóa tài khoản: xử lý xóa hoặc ẩn danh dữ liệu cá nhân liên quan trong ≤ 30 ngày (không xóa ngay lập tức — giữ đối soát khiếu nại theo chính sách). Vé / check-in: giữ 365 ngày rồi xóa hoặc ẩn danh dữ liệu cá nhân, giữ số liệu tổng hợp. Nhật ký kiểm toán: giữ tới 730 ngày. Tệp QR/export: liên kết tải ngắn hạn; tệp hết hạn nghiệp vụ được gỡ trong ≤ 90 ngày. Sao lưu tôn trọng yêu cầu xóa trong cửa sổ phục hồi đã công bố; bộ nhớ tạm trên thiết bị được xóa khi đăng xuất / đổi người dùng.',
  },
  {
    title: 'Yêu cầu xóa tài khoản',
    body: 'Người dùng đã đăng nhập: trên web mở Tài khoản (`/account`) hoặc trong app iOS mở Account → «Yêu cầu xóa tài khoản». Khi gửi, yêu cầu đã được tiếp nhận — chưa phải xóa ngay. Chúng tôi xử lý xóa hoặc ẩn danh trong ≤ 30 ngày; nhật ký kiểm toán có thể giữ tới 730 ngày theo chính sách. Không bắt buộc gọi điện hay mở ticket hỗ trợ để khởi tạo yêu cầu.',
  },
  {
    title: 'Vùng dữ liệu',
    body: 'Một vùng máy chủ: cơ sở dữ liệu, lưu trữ tệp, Keycloak và email cùng quốc gia với máy chủ. Không tách nhiều vùng trong MVP; quốc gia host ghi trong thỏa thuận xử lý dữ liệu khi có tenant thật.',
  },
  {
    title: 'Liên hệ',
    body: 'Câu hỏi quyền riêng tư: trang Hỗ trợ (`/support`) hoặc `support@vemoki.com` / `privacy@vemoki.com` (khi alias sẵn sàng). Liên hệ tạm: hangndat@gmail.com.',
  },
];

export const PRIVACY_POLICY_NOTE =
  'Các số liệu trên khớp chính sách hiện hành (18/10/2026). Mục tiêu phục hồi kỹ thuật nội bộ chưa dùng làm cam kết hỗ trợ cho đến khi kiểm tra trên máy chủ đích.';
