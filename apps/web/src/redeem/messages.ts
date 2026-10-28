import {
  FORM_ERROR_CODES,
  IDENTITY_ERROR_CODES,
  ISSUE_ERROR_CODES,
  RESOLVE_ERROR_CODES,
} from '@ticket/contracts';
import { ATTENDEE_COPY_CATALOG } from '../attendee-copy';
import { dual, formatDual, pickDual, type DualString } from '../i18n/dual';
import {
  DEFAULT_ATTENDEE_LOCALE,
  type AttendeeLocale,
} from '../i18n/locale';
import type { RedeemDecision } from './decide';
import type { OwnerRedemptionStatus } from '@ticket/contracts';

export type RedeemUxKind =
  | 'success'
  | 'pending'
  | 'verifying'
  | 'polling'
  | 'exhausted'
  | 'used'
  | 'timeout'
  | 'invalid'
  | 'auth'
  | 'closed'
  | 'conflict'
  | 'stale'
  | 'expired'
  | 'denied'
  | 'unknown'
  | 'error';

export type RedeemUxMessage = {
  kind: RedeemUxKind;
  title: string;
  detail: string;
  retryable: boolean;
  code?: string;
};

type DualEntry = {
  kind: RedeemUxKind;
  title: DualString;
  detail: DualString;
  retryable?: boolean;
};

const BY_CODE: Record<string, DualEntry> = {
  [ISSUE_ERROR_CODES.QUOTA_EXHAUSTED]: {
    kind: 'exhausted',
    title: dual('Hết suất', 'Sold out'),
    detail: dual(
      'Sự kiện hoặc loại vé đã hết suất. Mã này không thể đổi thành vé mới.',
      'This event or ticket type has no remaining quota. This code cannot issue a new ticket.',
    ),
    retryable: false,
  },
  [ISSUE_ERROR_CODES.CODE_CONSUMED]: {
    kind: 'used',
    title: dual('Mã đã dùng', 'Code already used'),
    detail: dual(
      'Mã đổi vé này đã được dùng trước đó và không thể dùng lại.',
      'This redemption code was already used and cannot be reused.',
    ),
    retryable: false,
  },
  [ISSUE_ERROR_CODES.CODE_DISABLED]: {
    kind: 'invalid',
    title: dual('Mã bị vô hiệu', 'Code disabled'),
    detail: dual(
      'Mã đổi vé đã bị tắt bởi tổ chức và không còn hiệu lực.',
      'The organizer disabled this redemption code.',
    ),
    retryable: false,
  },
  [ISSUE_ERROR_CODES.CODE_INVALID]: {
    kind: 'invalid',
    title: dual('Mã không hợp lệ', 'Invalid code'),
    detail: dual(
      'Không tìm thấy mã đổi vé. Kiểm tra lại mã trong email hoặc liên hệ ban tổ chức.',
      'Redemption code not found. Check the code in your email or contact the organizer.',
    ),
    retryable: false,
  },
  [RESOLVE_ERROR_CODES.RESOLVE_DISABLED]: {
    kind: 'closed',
    title: dual('Chưa hỗ trợ đổi mã một ô', 'Single-box redeem is unavailable'),
    detail: dual(
      'Tính năng tra mã toàn hệ thống chưa bật trên môi trường này. Thử lại sau hoặc dùng liên kết sự kiện.',
      'Global code lookup is not enabled here. Try later or use the event link.',
    ),
    retryable: false,
  },
  [RESOLVE_ERROR_CODES.RESOLVE_TOKEN_REQUIRED]: {
    kind: 'stale',
    title: dual('Phiên tra mã hết hạn', 'Lookup session expired'),
    detail: dual(
      'Nhập mã và tra lại trước khi đổi vé.',
      'Enter the code and look it up again before redeeming.',
    ),
    retryable: true,
  },
  [RESOLVE_ERROR_CODES.RESOLVE_TOKEN_STALE]: {
    kind: 'stale',
    title: dual('Phiên tra mã hết hạn', 'Lookup session expired'),
    detail: dual(
      'Mã hoặc biểu mẫu đã đổi — nhập mã và bấm «Tiếp tục» để tải lại.',
      'The code or form changed — enter the code and tap Continue to reload.',
    ),
    retryable: true,
  },
  [RESOLVE_ERROR_CODES.RATE_LIMITED]: {
    kind: 'denied',
    title: dual('Thử lại sau', 'Try again later'),
    detail: dual(
      'Quá nhiều lần tra mã. Đợi vài phút, rồi nhập mã và bấm «Tiếp tục» lại.',
      'Too many lookups. Wait a few minutes, then enter the code and tap Continue again.',
    ),
    retryable: true,
  },
  [ISSUE_ERROR_CODES.EVENT_CLOSED]: {
    kind: 'closed',
    title: dual('Sự kiện đã đóng', 'Event closed'),
    detail: dual(
      'Sự kiện không còn nhận đổi mã.',
      'This event is no longer accepting redemption codes.',
    ),
    retryable: false,
  },
  [ISSUE_ERROR_CODES.REDEMPTION_WINDOW_CLOSED]: {
    kind: 'closed',
    title: dual('Ngoài cửa sổ đổi mã', 'Outside the redemption window'),
    detail: dual(
      'Thời gian đổi mã chưa mở hoặc đã kết thúc.',
      'The redemption window has not opened or has already ended.',
    ),
    retryable: false,
  },
  [ISSUE_ERROR_CODES.ATTENDEE_LIMIT]: {
    kind: 'exhausted',
    title: dual('Đã đạt giới hạn vé', 'Ticket limit reached'),
    detail: dual(
      'Bạn đã nhận đủ số vé tối đa cho sự kiện này.',
      'You already have the maximum number of tickets for this event.',
    ),
    retryable: false,
  },
  [ISSUE_ERROR_CODES.EMAIL_NOT_VERIFIED]: {
    kind: 'auth',
    title: dual('Cần xác minh email', 'Email verification required'),
    detail: dual(
      'Xác minh email trong mục Tài khoản, sau đó quay lại trang Đổi mã.',
      'Verify your email in Account, then return to Redeem.',
    ),
    retryable: false,
  },
  [ISSUE_ERROR_CODES.IDEMPOTENCY_CONFLICT]: {
    kind: 'conflict',
    title: dual('Xung đột thao tác', 'Request conflict'),
    detail: dual(
      'Yêu cầu trùng khóa nhưng khác nội dung — gửi lại form để thử lần mới.',
      'The same operation key was sent with different content — submit the form again for a new attempt.',
    ),
    retryable: false,
  },
  [ISSUE_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED]: {
    kind: 'error',
    title: dual('Không gửi được yêu cầu', 'Could not send the request'),
    detail: dual(
      'Thiếu khóa thao tác. Tải lại trang rồi thử đổi mã lại.',
      'The operation key is missing. Reload the page and try redeeming again.',
    ),
    retryable: true,
  },
  [ISSUE_ERROR_CODES.RETRYABLE_CONFLICT]: {
    kind: 'polling',
    title: dual('Đang xử lý', 'Working'),
    detail: dual(
      'Máy chủ đang xử lý yêu cầu. Đang kiểm tra lại trạng thái…',
      'The server is processing the request. Checking status again…',
    ),
    retryable: true,
  },
  [ISSUE_ERROR_CODES.CODE_HMAC_MISCONFIGURED]: {
    kind: 'error',
    title: dual('Chưa sẵn sàng cấp vé', 'Ticketing is not ready'),
    detail: dual(
      'Dịch vụ cấp vé chưa sẵn sàng — liên hệ ban tổ chức.',
      'Ticket issuance is not ready — contact the organizer.',
    ),
    retryable: true,
  },
  [FORM_ERROR_CODES.FORM_VERSION_STALE]: {
    kind: 'stale',
    title: dual('Biểu mẫu đã đổi', 'The form changed'),
    detail: dual(
      'Biểu mẫu sự kiện đã được cập nhật. Đang tải lại — bạn cần điền và đồng ý điều khoản lại trước khi gửi.',
      'The event form was updated. Reloading — fill it in and accept the terms again before submitting.',
    ),
    retryable: false,
  },
  [FORM_ERROR_CODES.TERMS_VERSION_STALE]: {
    kind: 'stale',
    title: dual('Điều khoản đã đổi', 'The terms changed'),
    detail: dual(
      'Điều khoản mới đã được xuất bản. Đọc lại và đồng ý trước khi gửi.',
      'New terms were published. Read and accept them before submitting.',
    ),
    retryable: false,
  },
  [FORM_ERROR_CODES.TERMS_REQUIRED]: {
    kind: 'denied',
    title: dual('Cần đồng ý điều khoản', 'Terms acceptance required'),
    detail: dual(
      'Đánh dấu ô đồng ý điều khoản sự kiện, rồi bấm «Đổi mã lấy vé» lại.',
      'Check the box to accept the event terms, then tap Redeem code again.',
    ),
    retryable: false,
  },
  [FORM_ERROR_CODES.FORM_REQUIRED]: {
    kind: 'denied',
    title: dual('Thiếu biểu mẫu', 'Form required'),
    detail: dual(
      'Sự kiện yêu cầu biểu mẫu — tải lại rồi điền đủ trường.',
      'This event requires a form — reload and complete every field.',
    ),
    retryable: false,
  },
  [FORM_ERROR_CODES.FORM_INVALID]: {
    kind: 'denied',
    title: dual('Biểu mẫu chưa hợp lệ', 'The form is not valid'),
    detail: dual(
      'Một hoặc nhiều trường chưa đạt yêu cầu. Sửa các mục được đánh dấu đỏ rồi gửi lại.',
      'One or more fields are invalid. Fix the highlighted items and submit again.',
    ),
    retryable: false,
  },
  [FORM_ERROR_CODES.PENDING_EXPIRED]: {
    kind: 'expired',
    title: dual('Yêu cầu chờ duyệt đã hết hạn', 'Pending request expired'),
    detail: dual(
      'Yêu cầu đã hết hạn và không còn giữ suất. Có thể thử mã lại nếu còn hiệu lực.',
      'The request expired and no longer holds quota. You may try the code again if it is still valid.',
    ),
    retryable: false,
  },
  [FORM_ERROR_CODES.PENDING_LIMIT]: {
    kind: 'denied',
    title: dual('Quá số yêu cầu chờ duyệt', 'Too many pending requests'),
    detail: dual(
      'Bạn đã có quá nhiều yêu cầu chờ duyệt cho sự kiện này.',
      'You already have too many pending requests for this event.',
    ),
    retryable: false,
  },
  [IDENTITY_ERROR_CODES.UNAUTHENTICATED]: {
    kind: 'auth',
    title: dual('Cần đăng nhập', 'Sign in required'),
    detail: dual(
      'Đăng nhập rồi quay lại đổi mã lấy vé.',
      'Sign in, then return to redeem a code.',
    ),
    retryable: false,
  },
  [IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED]: {
    kind: 'auth',
    title: dual('Đăng nhập chưa sẵn sàng', 'Sign-in is not ready'),
    detail: dual(
      'Cổng đăng nhập chưa cấu hình. Liên hệ vận hành — không thể đổi mã lúc này.',
      'Sign-in is not configured. Contact operations — codes cannot be redeemed right now.',
    ),
    retryable: false,
  },
  UPSTREAM_UNAVAILABLE: {
    kind: 'timeout',
    title: dual('Không kết nối được', 'Could not connect'),
    detail: dual(
      'Không tới được dịch vụ cấp vé. Thử lại sau vài phút.',
      'The ticketing service is unreachable. Try again in a few minutes.',
    ),
    retryable: true,
  },
  CSRF_TOKEN_INVALID: {
    kind: 'auth',
    title: dual('Phiên trang hết hạn', 'Page session expired'),
    detail: dual(
      'Tải lại trang rồi thử lại.',
      'Reload the page and try again.',
    ),
    retryable: false,
  },
  CSRF_ORIGIN_REQUIRED: {
    kind: 'auth',
    title: dual('Yêu cầu bị từ chối', 'Request rejected'),
    detail: dual(
      'Gửi lại từ cùng trang đổi mã (cùng nguồn).',
      'Submit again from the same redeem page (same origin).',
    ),
    retryable: false,
  },
  SCOPE_REQUIRED: {
    kind: 'invalid',
    title: dual('Thiếu phạm vi sự kiện', 'Event scope required'),
    detail: dual(
      'Cần chọn đúng tổ chức và sự kiện trước khi đổi mã.',
      'Choose the correct organization and event before redeeming.',
    ),
    retryable: false,
  },
  TENANT_REQUIRED: {
    kind: 'invalid',
    title: dual('Thiếu tổ chức', 'Organization required'),
    detail: dual(
      'Cần chọn tổ chức để xem vé.',
      'Choose an organization to view tickets.',
    ),
    retryable: false,
  },
};

const GENERIC = {
  errorTitle: dual('Không đổi được mã', 'Could not redeem the code'),
  errorDetail: dual(
    'Đã xảy ra lỗi. Thử lại hoặc liên hệ ban tổ chức.',
    'Something went wrong. Try again or contact the organizer.',
  ),
  timeoutTitle: dual('Hết thời gian chờ', 'Timed out'),
  timeoutDetail: dual(
    'Yêu cầu đổi mã quá lâu. Đang kiểm tra lại trạng thái — chưa chắc đã có vé; đừng gửi mã lần nữa nếu chưa rõ kết quả.',
    'The redemption request took too long. Checking status again — a ticket is not confirmed; do not resubmit the code if the result is unclear.',
  ),
  networkTitle: dual('Mất kết nối mạng', 'Network connection lost'),
  networkDetail: dual(
    'Không gọi được dịch vụ. Đang / sẽ kiểm tra lại trạng thái — chưa chắc đã có vé; đừng gửi mã lần nữa nếu chưa rõ kết quả.',
    'The service could not be reached. Status will be checked again — a ticket is not confirmed; do not resubmit the code if the result is unclear.',
  ),
  verifyingTitle: dual('Đang xác minh mã…', 'Verifying code…'),
  verifyingDetail: dual(
    'Đang gửi yêu cầu đổi mã. Chưa phải vé.',
    'Sending the redemption request. This is not a ticket yet.',
  ),
  successReplayed: dual('Vé đã cấp trước đó', 'Ticket already issued'),
  successFresh: dual('Đổi mã thành công', 'Code redeemed'),
  successDetailReplayed: dual(
    'Vé của bạn đã sẵn sàng (mã vé {ticketId}).',
    'Your ticket is ready (ticket {ticketId}).',
  ),
  successDetailFresh: dual(
    'Vé của bạn đã được cấp — mã vé {ticketId}.',
    'Your ticket was issued — ticket {ticketId}.',
  ),
  pendingTitle: dual(
    'Đang chờ duyệt — chưa phải vé',
    'Pending review — not a ticket yet',
  ),
  pendingDetailExpiry: dual(
    'Yêu cầu đang chờ duyệt (hết hạn: {expiresAt}). Chưa có vé.',
    'The request is pending review (expires: {expiresAt}). No ticket yet.',
  ),
  pendingDetail: dual(
    'Yêu cầu đang chờ duyệt. Chưa có vé cho đến khi được chấp nhận.',
    'The request is pending review. There is no ticket until it is accepted.',
  ),
  unknownTitle: dual(
    'Chưa xác định kết quả — chưa phải vé',
    'Result is unclear — not a ticket yet',
  ),
  unknownDetailSuffix: dual(
    'Khóa thao tác đã giữ để dò an toàn.',
    'The operation key was kept for a safe retry.',
  ),
  undecided: dual(
    'Không xác định được kết quả.',
    'The result could not be determined.',
  ),
  rejectedTitle: dual('Yêu cầu bị từ chối', 'Request rejected'),
  rejectedDetail: dual(
    'Ban tổ chức đã từ chối yêu cầu đổi mã.',
    'The organizer rejected the redemption request.',
  ),
  expiredTitle: dual('Yêu cầu đã hết hạn', 'Request expired'),
  expiredDetail: dual(
    'Yêu cầu hết hạn lúc {expiredAt}. Không còn giữ suất.',
    'The request expired at {expiredAt}. Quota is no longer held.',
  ),
  statusUndecided: dual(
    'Không đọc được trạng thái yêu cầu.',
    'Could not read the request status.',
  ),
};

function resolveEntry(
  code: string | undefined,
  locale: AttendeeLocale,
  fallbackMessage?: string,
  retryableHint?: boolean,
): RedeemUxMessage {
  const mapped = code ? BY_CODE[code] : undefined;
  if (mapped) {
    return {
      kind: mapped.kind,
      title: pickDual(mapped.title, locale),
      detail: pickDual(mapped.detail, locale),
      retryable: mapped.retryable ?? Boolean(retryableHint),
      code,
    };
  }
  return {
    kind: 'error',
    title: pickDual(GENERIC.errorTitle, locale),
    detail:
      fallbackMessage?.trim() || pickDual(GENERIC.errorDetail, locale),
    retryable: Boolean(retryableHint),
    code,
  };
}

export function messageForApiError(
  code: string | undefined,
  fallbackMessage?: string,
  retryableHint?: boolean,
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): RedeemUxMessage {
  return resolveEntry(code, locale, fallbackMessage, retryableHint);
}

export function timeoutMessage(
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): RedeemUxMessage {
  return {
    kind: 'timeout',
    title: pickDual(GENERIC.timeoutTitle, locale),
    detail: pickDual(GENERIC.timeoutDetail, locale),
    retryable: true,
  };
}

/** Network loss while outcome is unclear — never claim success; keep same idempotency-key. */
export function networkMessage(
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): RedeemUxMessage {
  return {
    kind: 'timeout',
    title: pickDual(GENERIC.networkTitle, locale),
    detail: pickDual(GENERIC.networkDetail, locale),
    retryable: true,
  };
}

export function verifyingMessage(
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): RedeemUxMessage {
  return {
    kind: 'verifying',
    title: pickDual(GENERIC.verifyingTitle, locale),
    detail: pickDual(GENERIC.verifyingDetail, locale),
    retryable: false,
  };
}

export function successMessage(
  ticketId: string,
  replayed: boolean,
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): RedeemUxMessage {
  return {
    kind: 'success',
    title: pickDual(
      replayed ? GENERIC.successReplayed : GENERIC.successFresh,
      locale,
    ),
    detail: formatDual(
      replayed ? GENERIC.successDetailReplayed : GENERIC.successDetailFresh,
      locale,
      { ticketId },
    ),
    retryable: false,
  };
}

export function pendingMessage(
  requestId: string,
  expiresAt?: string,
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): RedeemUxMessage {
  void requestId;
  return {
    kind: 'pending',
    title: pickDual(GENERIC.pendingTitle, locale),
    detail: expiresAt
      ? formatDual(GENERIC.pendingDetailExpiry, locale, { expiresAt })
      : pickDual(GENERIC.pendingDetail, locale),
    retryable: false,
  };
}

export function unknownMessage(
  idempotencyKey: string,
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): RedeemUxMessage {
  void idempotencyKey;
  return {
    kind: 'unknown',
    title: pickDual(GENERIC.unknownTitle, locale),
    detail: `${pickDual(ATTENDEE_COPY_CATALOG.unknownIssuance, locale)} ${pickDual(GENERIC.unknownDetailSuffix, locale)}`,
    retryable: true,
  };
}

export function messageForDecision(
  decision: RedeemDecision,
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): RedeemUxMessage {
  switch (decision.kind) {
    case 'issued':
      return successMessage(decision.ticketId, decision.replayed, locale);
    case 'pending':
      return pendingMessage(decision.requestId, decision.expiresAt, locale);
    case 'unknown':
      return unknownMessage(decision.idempotencyKey, locale);
    case 'stale':
      return messageForApiError(decision.code, decision.message, undefined, locale);
    case 'expired':
      return messageForApiError(decision.code, decision.message, undefined, locale);
    case 'field_errors':
      return messageForApiError(decision.code, decision.message, undefined, locale);
    case 'denied':
      return messageForApiError(decision.code, decision.message, undefined, locale);
    default:
      return messageForApiError(
        undefined,
        pickDual(GENERIC.undecided, locale),
        undefined,
        locale,
      );
  }
}

export function messageForOwnerStatus(
  status: OwnerRedemptionStatus,
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): RedeemUxMessage {
  switch (status.status) {
    case 'PENDING_REVIEW':
      return pendingMessage(
        status.requestId,
        status.expiresAt ?? undefined,
        locale,
      );
    case 'ISSUED':
      return successMessage(status.ticketId, false, locale);
    case 'REJECTED':
      return {
        kind: 'denied',
        title: pickDual(GENERIC.rejectedTitle, locale),
        detail:
          status.reason?.trim() || pickDual(GENERIC.rejectedDetail, locale),
        retryable: false,
      };
    case 'EXPIRED':
      return {
        kind: 'expired',
        title: pickDual(GENERIC.expiredTitle, locale),
        detail: formatDual(GENERIC.expiredDetail, locale, {
          expiredAt: status.expiredAt,
        }),
        retryable: false,
      };
    default:
      return messageForApiError(
        undefined,
        pickDual(GENERIC.statusUndecided, locale),
        undefined,
        locale,
      );
  }
}
