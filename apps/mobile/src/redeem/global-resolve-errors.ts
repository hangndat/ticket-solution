import {
  ISSUE_ERROR_CODES,
  RESOLVE_ERROR_CODES,
} from '@ticket/contracts';

const GENERIC_RESOLVE_FAILURE =
  'Không tra cứu được mã. Kiểm tra mã và thử lại.';

/** User-facing Vietnamese only — never pass through API `message` or HTTP text. */
export function userMessageForGlobalResolveError(code: string): string {
  switch (code) {
    case ISSUE_ERROR_CODES.RESOLVE_DISABLED:
    case RESOLVE_ERROR_CODES.RESOLVE_DISABLED:
      return 'Hiện chưa hỗ trợ tra cứu mã toàn hệ thống. Thử lại sau hoặc liên hệ tổ chức sự kiện.';
    case ISSUE_ERROR_CODES.CODE_INVALID:
      return 'Mã không hợp lệ hoặc không tìm thấy.';
    case ISSUE_ERROR_CODES.CODE_CONSUMED:
      return 'Mã đã được sử dụng.';
    case ISSUE_ERROR_CODES.CODE_DISABLED:
      return 'Mã không còn hiệu lực.';
    case ISSUE_ERROR_CODES.EVENT_CLOSED:
    case ISSUE_ERROR_CODES.REDEMPTION_WINDOW_CLOSED:
      return 'Cửa sổ đổi mã đã đóng cho sự kiện này.';
    case ISSUE_ERROR_CODES.EVENT_CANCELLED:
    case ISSUE_ERROR_CODES.EVENT_ARCHIVED:
      return 'Sự kiện không còn nhận đổi mã.';
    case ISSUE_ERROR_CODES.QUOTA_EXHAUSTED:
    case ISSUE_ERROR_CODES.ATTENDEE_LIMIT:
      return 'Mã đã hết lượt hoặc đạt giới hạn vé.';
    case ISSUE_ERROR_CODES.RESOLVE_TOKEN_REQUIRED:
    case RESOLVE_ERROR_CODES.RESOLVE_TOKEN_REQUIRED:
      return 'Cần tra cứu mã lại trước khi tiếp tục.';
    case ISSUE_ERROR_CODES.RESOLVE_TOKEN_STALE:
    case RESOLVE_ERROR_CODES.RESOLVE_TOKEN_STALE:
      return 'Phiên tra cứu đã hết hạn — tra cứu mã lại.';
    case RESOLVE_ERROR_CODES.RATE_LIMITED:
      return 'Quá nhiều lần thử. Chờ một lúc rồi thử lại.';
    case 'UNKNOWN':
      return GENERIC_RESOLVE_FAILURE;
    default:
      return GENERIC_RESOLVE_FAILURE;
  }
}
