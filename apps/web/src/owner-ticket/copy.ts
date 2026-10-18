export const OWNER_TICKET_COPY = {
  pageTitle: 'Vé của bạn',
  pageIntro:
    'Chi tiết vé theo liên kết email. Cần đăng nhập đúng tài khoản đã nhận vé — không kèm mã QR trong URL.',
  authRequired: {
    title: 'Cần đăng nhập',
    detail:
      'Liên kết vé yêu cầu đăng nhập. Sau khi đăng nhập bạn sẽ quay lại trang này.',
  },
  loading: {
    title: 'Đang tải vé…',
    detail: 'Đang xác minh phiên và tải vé trong tổ chức.',
  },
  tenantUnresolved: {
    title: 'Không xác định được tổ chức',
    detail:
      'Tài khoản đã đăng nhập nhưng chưa gắn tổ chức khớp slug trên liên kết. Thử lại sau khi đổi mã lấy vé trên web, hoặc mở app với cùng tài khoản.',
  },
  unreachable: {
    title: 'Không tải được vé',
    detail: 'Không gọi được dịch vụ vé. Thử lại sau vài phút.',
  },
  unauthorized: {
    title: 'Phiên đăng nhập hết hạn',
    detail: 'Đăng nhập lại để xem vé.',
  },
  notFound: {
    title: 'Không thấy vé này',
    detail:
      'Không có vé khớp mã trên tài khoản hiện tại trong tổ chức này. Kiểm tra đúng tài khoản đã nhận email.',
  },
  invalid: {
    title: 'Dữ liệu vé không hợp lệ',
    detail: 'Phản hồi máy chủ không đúng định dạng. Thử lại sau.',
  },
} as const;
