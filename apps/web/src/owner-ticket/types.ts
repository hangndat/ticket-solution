/**
 * Owner ticket detail — Nest GET /v1/me/tickets/{id}?tenantId= (TD §10 / PR #400).
 * Mirrors TicketSummary.
 */
export type OwnerTicketDetail = {
  ticketId: string;
  tenantId: string;
  eventId: string;
  ticketTypeId: string;
  sourceId: string;
  state: string;
  credentialVersion: number;
  createdAt: string;
};

export type LoadOwnerTicketResult =
  | { status: 'ok'; ticket: OwnerTicketDetail }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'tenant-unresolved' }
  | { status: 'not-found' }
  | { status: 'unreachable' }
  | { status: 'invalid' };

export const OWNER_TICKET_COPY = {
  title: 'Vé của bạn',
  needLogin: {
    title: 'Cần đăng nhập',
    detail:
      'Liên kết vé yêu cầu phiên đăng nhập của chủ vé. Đăng nhập để tiếp tục — chúng tôi không hiển thị chi tiết vé khi chưa xác minh.',
  },
  missing: {
    title: 'Không tìm thấy vé',
    detail:
      'Không có vé khớp đường dẫn này cho tài khoản hiện tại. Đăng xuất rồi đăng nhập đúng email chủ vé (trong thư xác nhận), hoặc kiểm tra lại liên kết.',
  },
  tenantUnresolved: {
    title: 'Không xác định được tổ chức',
    detail:
      'Tài khoản đã đăng nhập nhưng chưa gắn tổ chức khớp slug trên liên kết. Đăng nhập đúng email chủ vé trong thư, hoặc thử đổi mã lấy vé.',
  },
  unreachable: {
    title: 'Không tải được vé',
    detail: 'Máy chủ vé tạm thời không phản hồi. Thử lại sau ít phút.',
  },
  invalid: {
    title: 'Liên kết không hợp lệ',
    detail:
      'Đường dẫn vé không đúng định dạng. Kiểm tra lại email hoặc mở từ «Vé của tôi».',
  },
} as const;
