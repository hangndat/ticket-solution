/**
 * Owner ticket detail — Nest GET /v1/me/tickets/{id}?tenantId= (TD §10 / PR #400).
 * Mirrors TicketSummary.
 */
import { dual, localizeCatalog } from '../i18n/dual';
import {
  DEFAULT_ATTENDEE_LOCALE,
  type AttendeeLocale,
} from '../i18n/locale';

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

export const WALLET_COPY_CATALOG = {
  title: dual('Vé của tôi', 'My tickets'),
  intro: dual(
    'Quản lý vé đã cấp theo sự kiện. Mở vé để xem mã QR tại cổng — không chia sẻ ảnh chụp màn hình.',
    'Manage issued tickets by event. Open a ticket to show the gate QR — do not share a screenshot.',
  ),
  redeemCta: dual('Đổi mã lấy vé', 'Redeem a code'),
  login: dual('Đăng nhập', 'Sign in'),
  retry: dual('Thử lại', 'Try again'),
  allTickets: dual('Xem tất cả vé', 'View all tickets'),
  filterEmptyTitle: dual(
    'Không có vé cho bộ lọc này',
    'No tickets for this filter',
  ),
  filterEmptyDetail: dual(
    'Chọn «Tất cả» hoặc sự kiện khác để xem vé của bạn.',
    'Choose “All” or another event to see your tickets.',
  ),
  filterAll: dual('Tất cả', 'All'),
  filterAria: dual('Lọc vé theo sự kiện', 'Filter tickets by event'),
  ticketCode: dual('Mã vé', 'Ticket'),
  openTicket: dual('Mở vé', 'Open ticket'),
  openTicketAria: dual('Mở vé {title}', 'Open ticket {title}'),
  noOrgWarn: dual(
    'Không xác định được tổ chức cho vé này. Thử đăng nhập lại hoặc đổi mã.',
    'Could not resolve the organization for this ticket. Try signing in again or redeem a code.',
  ),
  noOrgAria: dual(
    '{title} — chưa mở được liên kết vé',
    '{title} — ticket link is not available',
  ),
  eventFallback: dual('Sự kiện {id}…', 'Event {id}…'),
  needLogin: {
    title: dual('Cần đăng nhập', 'Sign in required'),
    detail: dual(
      'Đăng nhập bằng email chủ vé để xem ví. Chúng tôi không hiển thị danh sách vé khi chưa xác minh.',
      'Sign in with the ticket owner email to view the wallet. Tickets are not listed until you are verified.',
    ),
  },
  unreachable: {
    title: dual('Không tải được vé', 'Could not load tickets'),
    detail: dual(
      'Máy chủ vé tạm thời không phản hồi. Kiểm tra API (API_BASE_URL, thường :3001) đang chạy, rồi thử lại. Dùng một origin localhost (http://localhost:3000) — không trộn 127.0.0.1 với localhost.',
      'The ticket server did not respond. Check that the API (API_BASE_URL, usually :3001) is running, then retry. Use one localhost origin (http://localhost:3000) — do not mix 127.0.0.1 with localhost.',
    ),
  },
  empty: {
    title: dual('Chưa có vé', 'No tickets yet'),
    detail: dual(
      'Bạn chưa có vé trong tài khoản này. Đổi mã lấy vé hoặc kiểm tra email xác nhận.',
      'This account has no tickets yet. Redeem a code or check the confirmation email.',
    ),
  },
  invalid: {
    title: dual('Dữ liệu vé không hợp lệ', 'Ticket data is invalid'),
    detail: dual(
      'Phản hồi từ máy chủ không đúng định dạng. Thử tải lại trang.',
      'The server response was not in the expected format. Reload the page.',
    ),
  },
} as const;

export const WALLET_COPY = localizeCatalog(
  WALLET_COPY_CATALOG,
  DEFAULT_ATTENDEE_LOCALE,
);

export function walletCopy(locale: AttendeeLocale) {
  return localizeCatalog(WALLET_COPY_CATALOG, locale);
}

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
