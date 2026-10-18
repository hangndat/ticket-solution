/**
 * VI surface copy for public published catalog (ADR-19).
 * PD handoff `docs/design/event-server-source/` chưa có trên main — bám BA/architect.
 */

export const PUBLIC_EVENT_COPY = {
  homeEmpty: {
    title: 'Chưa có sự kiện công khai',
    detail:
      'Không có sự kiện đã xuất bản cho các tổ chức trên trang này. Đổi mã lấy vé vẫn dùng được khi bạn có mã.',
  },
  homeUnreachable: {
    title: 'Không tải được danh sách sự kiện',
    detail:
      'Máy chủ sự kiện tạm thời không phản hồi. Thử lại sau — không hiển thị bản demo thay thế.',
  },
  homeInvalid: {
    title: 'Dữ liệu sự kiện không hợp lệ',
    detail:
      'Máy chủ trả về nội dung không đọc được. Thử lại sau hoặc liên hệ ban tổ chức.',
  },
  detailUnreachable: {
    title: 'Không tải được sự kiện',
    detail:
      'Không kết nối được máy chủ. Thử lại sau — trang này không dùng dữ liệu demo thay thế.',
  },
  detailInvalid: {
    title: 'Nội dung sự kiện không hợp lệ',
    detail:
      'Máy chủ trả về dữ liệu không khớp schema. Không hiển thị một phần nội dung.',
  },
  demoLabel: 'Sự kiện demo · Không dùng vào cổng',
  demoNoticeTitle: 'Bản demo có nhãn rõ',
  demoNoticeBody:
    'Nội dung mang nhãn · Demo từ seed máy chủ — không phải lịch production ẩn.',
} as const;
