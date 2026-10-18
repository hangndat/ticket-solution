/**
 * VI surface copy for public published catalog (ADR-19).
 * Aligned with PD `docs/design/event-server-source/ui-states.md` (Epic #254).
 */

export const PUBLIC_EVENT_COPY = {
  homeEmpty: {
    title: 'Chưa có sự kiện đã xuất bản',
    detail:
      'Tổ chức này chưa công bố sự kiện nào. Bạn vẫn có thể đổi mã nếu đã có mã.',
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
  demoLabel: 'Sự kiện demo · Không dùng vào cổng',
  demoNoticeTitle: 'Bản demo có nhãn rõ',
  demoNoticeBody:
    'Nội dung mang nhãn · Demo từ seed máy chủ — không phải lịch production ẩn.',
} as const;
