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

/** Row for wallet grid — TicketSummary + optional event label from API. */
export type WalletTicketRow = OwnerTicketDetail & {
  eventName?: string;
};

export type LoadOwnerWalletResult =
  | {
      status: 'ok';
      tickets: WalletTicketRow[];
      tenantSlugById: Record<string, string>;
    }
  | { status: 'unauthenticated' }
  | { status: 'unreachable' }
  | { status: 'invalid' };

export const WALLET_COPY = {
  title: 'Vé của tôi',
  intro:
    'Quản lý vé đã cấp theo sự kiện. Mở vé để xem mã QR tại cổng — không chia sẻ ảnh chụp màn hình.',
  needLogin: {
    title: 'Cần đăng nhập',
    detail:
      'Đăng nhập bằng email chủ vé để xem ví. Chúng tôi không hiển thị danh sách vé khi chưa xác minh.',
  },
  unreachable: {
    title: 'Không tải được vé',
    detail:
      'Máy chủ vé tạm thời không phản hồi. Kiểm tra API (API_BASE_URL, thường :3001) đang chạy, rồi thử lại. Dùng một origin localhost (http://localhost:3000) — không trộn 127.0.0.1 với localhost.',
  },
  empty: {
    title: 'Chưa có vé',
    detail:
      'Bạn chưa có vé trong tài khoản này. Đổi mã lấy vé hoặc kiểm tra email xác nhận.',
  },
  invalid: {
    title: 'Dữ liệu vé không hợp lệ',
    detail: 'Phản hồi từ máy chủ không đúng định dạng. Thử tải lại trang.',
  },
} as const;

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
  forbidden: {
    title: 'Bạn không có quyền xem vé này',
    detail:
      'Vé không thuộc tài khoản hiện tại hoặc tổ chức đã chặn truy cập. Đăng nhập đúng email chủ vé hoặc liên hệ ban tổ chức.',
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
