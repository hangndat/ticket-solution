/**
 * VI surface copy for public published catalog (ADR-19).
 * Aligned with PD `docs/design/event-server-source/ui-states.md` (Epic #254).
 */

export const PUBLIC_EVENT_COPY = {
  homeEmpty: {
    title: 'Chưa có sự kiện đang mở',
    detail:
      'Hiện chưa có sự kiện công khai. Bạn vẫn có thể đổi mã nếu đã có mã.',
  },
  homeUnreachable: {
    title: 'Không tải được danh sách',
    detail:
      'Máy chủ chưa phản hồi. Không hiển thị sự kiện mẫu thay thế.',
  },
  homeInvalid: {
    title: 'Dữ liệu sự kiện không hợp lệ',
    detail:
      'Phản hồi không đúng định dạng. Không dùng nội dung dự phòng.',
  },
  detailUnreachable: {
    title: 'Không tải được sự kiện',
    detail:
      'Không kết nối được máy chủ nội dung. Không thay bằng bản demo.',
  },
  detailInvalid: {
    title: 'Nội dung không hợp lệ',
    detail:
      'Phản hồi sự kiện không đúng định dạng.',
  },
  noStartsAt: 'Chưa có giờ bắt đầu',
  detailAboutFallback:
    'Một không gian để gặp gỡ, kết nối và tận hưởng những khoảnh khắc đáng nhớ. Tìm thông tin tham dự và cập nhật từ nhà tổ chức tại đây.',
  detailAttendTitle: 'Thông tin tham dự',
  detailAttendBody:
    'Kiểm tra thời gian mở cửa trên vé. Đưa mã QR của từng vé cho nhân viên khi vào cổng.',
  detailLocationUnknown: 'Chưa công bố',
} as const;
