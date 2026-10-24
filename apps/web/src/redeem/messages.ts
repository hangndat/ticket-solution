import {
  FORM_ERROR_CODES,
  IDENTITY_ERROR_CODES,
  ISSUE_ERROR_CODES,
  RESOLVE_ERROR_CODES,
} from '@ticket/contracts';
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
};

const BY_CODE: Record<
  string,
  Omit<RedeemUxMessage, 'retryable'> & { retryable?: boolean }
> = {
  [ISSUE_ERROR_CODES.QUOTA_EXHAUSTED]: {
    kind: 'exhausted',
    title: 'Hết suất',
    detail:
      'Sự kiện hoặc loại vé đã hết suất. Mã này không thể đổi thành vé mới.',
    retryable: false,
  },
  [ISSUE_ERROR_CODES.CODE_CONSUMED]: {
    kind: 'used',
    title: 'Mã đã dùng',
    detail: 'Mã đổi vé này đã được dùng trước đó và không thể dùng lại.',
    retryable: false,
  },
  [ISSUE_ERROR_CODES.CODE_DISABLED]: {
    kind: 'invalid',
    title: 'Mã bị vô hiệu',
    detail: 'Mã đổi vé đã bị tắt bởi tổ chức và không còn hiệu lực.',
    retryable: false,
  },
  [ISSUE_ERROR_CODES.CODE_INVALID]: {
    kind: 'invalid',
    title: 'Mã không hợp lệ',
    detail:
      'Không tìm thấy mã đổi vé. Kiểm tra lại mã trong email hoặc liên hệ ban tổ chức.',
    retryable: false,
  },
  [RESOLVE_ERROR_CODES.RESOLVE_DISABLED]: {
    kind: 'closed',
    title: 'Chưa hỗ trợ đổi mã một ô',
    detail:
      'Tính năng tra mã toàn hệ thống chưa bật trên môi trường này. Thử lại sau hoặc dùng liên kết sự kiện.',
    retryable: false,
  },
  [RESOLVE_ERROR_CODES.RESOLVE_TOKEN_REQUIRED]: {
    kind: 'stale',
    title: 'Phiên tra mã hết hạn',
    detail: 'Nhập mã và tra lại trước khi đổi vé.',
    retryable: true,
  },
  [RESOLVE_ERROR_CODES.RESOLVE_TOKEN_STALE]: {
    kind: 'stale',
    title: 'Phiên tra mã hết hạn',
    detail: 'Mã hoặc biểu mẫu đã đổi — nhập mã và bấm «Tiếp tục» để tải lại.',
    retryable: true,
  },
  [RESOLVE_ERROR_CODES.RATE_LIMITED]: {
    kind: 'denied',
    title: 'Thử lại sau',
    detail:
      'Quá nhiều lần tra mã. Đợi vài phút, rồi nhập mã và bấm «Tiếp tục» lại.',
    retryable: true,
  },
  [ISSUE_ERROR_CODES.EVENT_CLOSED]: {
    kind: 'closed',
    title: 'Sự kiện đã đóng',
    detail: 'Sự kiện không còn nhận đổi mã.',
    retryable: false,
  },
  [ISSUE_ERROR_CODES.REDEMPTION_WINDOW_CLOSED]: {
    kind: 'closed',
    title: 'Ngoài cửa sổ đổi mã',
    detail: 'Thời gian đổi mã chưa mở hoặc đã kết thúc.',
    retryable: false,
  },
  [ISSUE_ERROR_CODES.ATTENDEE_LIMIT]: {
    kind: 'exhausted',
    title: 'Đã đạt giới hạn vé',
    detail: 'Bạn đã nhận đủ số vé tối đa cho sự kiện này.',
    retryable: false,
  },
  [ISSUE_ERROR_CODES.EMAIL_NOT_VERIFIED]: {
    kind: 'auth',
    title: 'Cần xác minh email',
    detail:
      'Xác minh email trong mục Tài khoản, sau đó quay lại trang Đổi mã.',
    retryable: false,
  },
  [ISSUE_ERROR_CODES.IDEMPOTENCY_CONFLICT]: {
    kind: 'conflict',
    title: 'Xung đột thao tác',
    detail: 'Yêu cầu trùng khóa nhưng khác nội dung — gửi lại form để thử lần mới.',
    retryable: false,
  },
  [ISSUE_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED]: {
    kind: 'error',
    title: 'Không gửi được yêu cầu',
    detail: 'Thiếu khóa thao tác. Tải lại trang rồi thử đổi mã lại.',
    retryable: true,
  },
  [ISSUE_ERROR_CODES.RETRYABLE_CONFLICT]: {
    kind: 'polling',
    title: 'Đang xử lý',
    detail: 'Máy chủ đang xử lý yêu cầu. Đang kiểm tra lại trạng thái…',
    retryable: true,
  },
  [ISSUE_ERROR_CODES.CODE_HMAC_MISCONFIGURED]: {
    kind: 'error',
    title: 'Chưa sẵn sàng cấp vé',
    detail: 'Dịch vụ cấp vé chưa sẵn sàng — liên hệ ban tổ chức.',
    retryable: true,
  },
  [FORM_ERROR_CODES.FORM_VERSION_STALE]: {
    kind: 'stale',
    title: 'Biểu mẫu đã đổi',
    detail:
      'Biểu mẫu sự kiện đã được cập nhật. Đang tải lại — bạn cần điền và đồng ý điều khoản lại trước khi gửi.',
    retryable: false,
  },
  [FORM_ERROR_CODES.TERMS_VERSION_STALE]: {
    kind: 'stale',
    title: 'Điều khoản đã đổi',
    detail: 'Điều khoản mới đã được xuất bản. Đọc lại và đồng ý trước khi gửi.',
    retryable: false,
  },
  [FORM_ERROR_CODES.TERMS_REQUIRED]: {
    kind: 'denied',
    title: 'Cần đồng ý điều khoản',
    detail:
      'Đánh dấu ô đồng ý điều khoản sự kiện, rồi bấm «Đổi mã lấy vé» lại.',
    retryable: false,
  },
  [FORM_ERROR_CODES.FORM_REQUIRED]: {
    kind: 'denied',
    title: 'Thiếu biểu mẫu',
    detail: 'Sự kiện yêu cầu biểu mẫu — tải lại rồi điền đủ trường.',
    retryable: false,
  },
  [FORM_ERROR_CODES.FORM_INVALID]: {
    kind: 'denied',
    title: 'Biểu mẫu chưa hợp lệ',
    detail:
      'Một hoặc nhiều trường chưa đạt yêu cầu. Sửa các mục được đánh dấu đỏ rồi gửi lại.',
    retryable: false,
  },
  [FORM_ERROR_CODES.PENDING_EXPIRED]: {
    kind: 'expired',
    title: 'Yêu cầu chờ duyệt đã hết hạn',
    detail:
      'Yêu cầu đã hết hạn và không còn giữ suất. Có thể thử mã lại nếu còn hiệu lực.',
    retryable: false,
  },
  [FORM_ERROR_CODES.PENDING_LIMIT]: {
    kind: 'denied',
    title: 'Quá số yêu cầu chờ duyệt',
    detail: 'Bạn đã có quá nhiều yêu cầu chờ duyệt cho sự kiện này.',
    retryable: false,
  },
  [IDENTITY_ERROR_CODES.UNAUTHENTICATED]: {
    kind: 'auth',
    title: 'Cần đăng nhập',
    detail: 'Đăng nhập rồi quay lại đổi mã lấy vé.',
    retryable: false,
  },
  [IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED]: {
    kind: 'auth',
    title: 'Đăng nhập chưa sẵn sàng',
    detail: 'Cổng đăng nhập chưa cấu hình. Liên hệ vận hành — không thể đổi mã lúc này.',
    retryable: false,
  },
  UPSTREAM_UNAVAILABLE: {
    kind: 'timeout',
    title: 'Không kết nối được',
    detail: 'Không tới được dịch vụ cấp vé. Thử lại sau vài phút.',
    retryable: true,
  },
  CSRF_TOKEN_INVALID: {
    kind: 'auth',
    title: 'Phiên trang hết hạn',
    detail: 'Tải lại trang rồi thử lại.',
    retryable: false,
  },
  CSRF_ORIGIN_REQUIRED: {
    kind: 'auth',
    title: 'Yêu cầu bị từ chối',
    detail: 'Gửi lại từ cùng trang đổi mã (cùng nguồn).',
    retryable: false,
  },
  SCOPE_REQUIRED: {
    kind: 'invalid',
    title: 'Thiếu phạm vi sự kiện',
    detail: 'Cần chọn đúng tổ chức và sự kiện trước khi đổi mã.',
    retryable: false,
  },
  TENANT_REQUIRED: {
    kind: 'invalid',
    title: 'Thiếu tổ chức',
    detail: 'Cần chọn tổ chức để xem vé.',
    retryable: false,
  },
};

export function messageForApiError(
  code: string | undefined,
  fallbackMessage?: string,
  retryableHint?: boolean,
): RedeemUxMessage {
  const mapped = code ? BY_CODE[code] : undefined;
  if (mapped) {
    return {
      kind: mapped.kind,
      title: mapped.title,
      detail: mapped.detail,
      retryable: mapped.retryable ?? Boolean(retryableHint),
    };
  }
  return {
    kind: 'error',
    title: 'Không đổi được mã',
    detail: fallbackMessage?.trim() || 'Đã xảy ra lỗi. Thử lại hoặc liên hệ ban tổ chức.',
    retryable: Boolean(retryableHint),
  };
}

export function timeoutMessage(): RedeemUxMessage {
  return {
    kind: 'timeout',
    title: 'Hết thời gian chờ',
    detail:
      'Yêu cầu đổi mã quá lâu. Đang kiểm tra lại trạng thái — chưa chắc đã có vé; đừng gửi mã lần nữa nếu chưa rõ kết quả.',
    retryable: true,
  };
}

/** Network loss while outcome is unclear — never claim success; keep same idempotency-key. */
export function networkMessage(): RedeemUxMessage {
  return {
    kind: 'timeout',
    title: 'Mất kết nối mạng',
    detail:
      'Không gọi được dịch vụ. Đang / sẽ kiểm tra lại trạng thái — chưa chắc đã có vé; đừng gửi mã lần nữa nếu chưa rõ kết quả.',
    retryable: true,
  };
}

export function verifyingMessage(): RedeemUxMessage {
  return {
    kind: 'verifying',
    title: 'Đang xác minh mã…',
    detail: 'Đang gửi yêu cầu đổi mã. Chưa phải vé.',
    retryable: false,
  };
}

export function successMessage(ticketId: string, replayed: boolean): RedeemUxMessage {
  return {
    kind: 'success',
    title: replayed ? 'Vé đã cấp trước đó' : 'Đổi mã thành công',
    detail: replayed
      ? `Vé của bạn đã sẵn sàng (mã vé ${ticketId}).`
      : `Vé của bạn đã được cấp — mã vé ${ticketId}.`,
    retryable: false,
  };
}

export function pendingMessage(
  requestId: string,
  expiresAt?: string,
): RedeemUxMessage {
  return {
    kind: 'pending',
    title: 'Đang chờ duyệt — chưa phải vé',
    detail: expiresAt
      ? `Yêu cầu đang chờ duyệt (hết hạn: ${expiresAt}). Chưa có vé.`
      : 'Yêu cầu đang chờ duyệt. Chưa có vé cho đến khi được chấp nhận.',
    retryable: false,
  };
}

export function unknownMessage(idempotencyKey: string): RedeemUxMessage {
  void idempotencyKey;
  return {
    kind: 'unknown',
    title: 'Chưa rõ kết quả — chưa phải vé',
    detail:
      'Chưa xác nhận đã cấp vé. Bấm «Kiểm tra lại» — không hiện vé giả. Khóa thao tác đã giữ để dò an toàn.',
    retryable: true,
  };
}

export function messageForDecision(decision: RedeemDecision): RedeemUxMessage {
  switch (decision.kind) {
    case 'issued':
      return successMessage(decision.ticketId, decision.replayed);
    case 'pending':
      return pendingMessage(decision.requestId, decision.expiresAt);
    case 'unknown':
      return unknownMessage(decision.idempotencyKey);
    case 'stale':
      return messageForApiError(decision.code, decision.message);
    case 'expired':
      return messageForApiError(decision.code, decision.message);
    case 'field_errors':
      return messageForApiError(decision.code, decision.message);
    case 'denied':
      return messageForApiError(decision.code, decision.message);
    default:
      return messageForApiError(undefined, 'Không xác định được kết quả.');
  }
}

export function messageForOwnerStatus(
  status: OwnerRedemptionStatus,
): RedeemUxMessage {
  switch (status.status) {
    case 'PENDING_REVIEW':
      return pendingMessage(
        status.requestId,
        status.expiresAt ?? undefined,
      );
    case 'ISSUED':
      return successMessage(status.ticketId, false);
    case 'REJECTED':
      return {
        kind: 'denied',
        title: 'Yêu cầu bị từ chối',
        detail: status.reason?.trim() || 'Ban tổ chức đã từ chối yêu cầu đổi mã.',
        retryable: false,
      };
    case 'EXPIRED':
      return {
        kind: 'expired',
        title: 'Yêu cầu đã hết hạn',
        detail: `Yêu cầu hết hạn lúc ${status.expiredAt}. Không còn giữ suất.`,
        retryable: false,
      };
    default:
      return messageForApiError(undefined, 'Không đọc được trạng thái yêu cầu.');
  }
}
