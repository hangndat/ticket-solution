import {
  FORM_ERROR_CODES,
  IDENTITY_ERROR_CODES,
  ISSUE_ERROR_CODES,
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
    title: 'Hết suất (quota exhausted)',
    detail:
      'Quota sự kiện / loại vé / nguồn phát đã hết. Mã không thể đổi thành vé mới.',
    retryable: false,
  },
  [ISSUE_ERROR_CODES.CODE_CONSUMED]: {
    kind: 'used',
    title: 'Mã đã dùng (code consumed)',
    detail: 'Mã đổi vé này đã được tiêu thụ trước đó và không thể dùng lại.',
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
    detail: 'Không tìm thấy mã trong phạm vi tenant/event đã chọn.',
    retryable: false,
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
    title: 'Đã đạt giới hạn vé / người',
    detail: 'Bạn đã nhận đủ số vé tối đa cho sự kiện này.',
    retryable: false,
  },
  [ISSUE_ERROR_CODES.EMAIL_NOT_VERIFIED]: {
    kind: 'auth',
    title: 'Email chưa xác minh',
    detail: 'Xác minh email trên Keycloak trước khi đổi mã lấy vé.',
    retryable: false,
  },
  [ISSUE_ERROR_CODES.IDEMPOTENCY_CONFLICT]: {
    kind: 'conflict',
    title: 'Xung đột idempotency',
    detail:
      'Cùng khóa idempotency nhưng payload khác — thử lại với khóa mới (gửi form lại).',
    retryable: false,
  },
  [ISSUE_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED]: {
    kind: 'error',
    title: 'Thiếu idempotency-key',
    detail: 'BFF/API yêu cầu header idempotency-key cho mỗi lần đổi mã.',
    retryable: true,
  },
  [ISSUE_ERROR_CODES.RETRYABLE_CONFLICT]: {
    kind: 'polling',
    title: 'Đang xử lý — xung đột tạm thời',
    detail: 'Máy chủ báo xung đột có thể thử lại. Đang dò trạng thái thao tác…',
    retryable: true,
  },
  [ISSUE_ERROR_CODES.CODE_HMAC_MISCONFIGURED]: {
    kind: 'error',
    title: 'API chưa sẵn sàng cấp vé',
    detail: 'Dịch vụ issue chưa cấu hình HMAC/credential — liên hệ vận hành.',
    retryable: true,
  },
  [FORM_ERROR_CODES.FORM_VERSION_STALE]: {
    kind: 'stale',
    title: 'Form đã đổi (FORM_VERSION_STALE)',
    detail: 'Tải lại form published và điền lại. Vé đã cấp vẫn giữ kết quả cũ khi replay.',
    retryable: false,
  },
  [FORM_ERROR_CODES.TERMS_VERSION_STALE]: {
    kind: 'stale',
    title: 'Điều khoản đã đổi (TERMS_VERSION_STALE)',
    detail: 'Đọc lại điều khoản mới và đồng ý lại trước khi gửi.',
    retryable: false,
  },
  [FORM_ERROR_CODES.TERMS_REQUIRED]: {
    kind: 'denied',
    title: 'Cần đồng ý điều khoản',
    detail: 'Phải chấp nhận điều khoản published trước khi đổi mã.',
    retryable: false,
  },
  [FORM_ERROR_CODES.FORM_REQUIRED]: {
    kind: 'denied',
    title: 'Thiếu form bắt buộc',
    detail: 'Sự kiện yêu cầu form published — tải schema rồi điền đủ trường.',
    retryable: false,
  },
  [FORM_ERROR_CODES.FORM_INVALID]: {
    kind: 'denied',
    title: 'Form không hợp lệ',
    detail: 'Một hoặc nhiều trường không đạt kiểm tra phía máy chủ.',
    retryable: false,
  },
  [FORM_ERROR_CODES.PENDING_EXPIRED]: {
    kind: 'expired',
    title: 'Yêu cầu chờ duyệt đã hết hạn',
    detail: 'Pending đã hết TTL — không còn đảm bảo suất. Có thể thử mã lại nếu còn hiệu lực.',
    retryable: false,
  },
  [FORM_ERROR_CODES.PENDING_LIMIT]: {
    kind: 'denied',
    title: 'Quá số pending cho phép',
    detail: 'Bạn đã có quá nhiều yêu cầu chờ duyệt cho sự kiện này.',
    retryable: false,
  },
  [IDENTITY_ERROR_CODES.UNAUTHENTICATED]: {
    kind: 'auth',
    title: 'Chưa đăng nhập',
    detail: 'Đăng nhập Keycloak (Identity POC) rồi quay lại đổi mã.',
    retryable: false,
  },
  [IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED]: {
    kind: 'auth',
    title: 'OIDC chưa cấu hình',
    detail: 'Thiếu biến môi trường OIDC trên web BFF — fail closed.',
    retryable: false,
  },
  UPSTREAM_UNAVAILABLE: {
    kind: 'timeout',
    title: 'Không kết nối được API',
    detail: 'BFF không tới được Nest upstream. Kiểm tra API_BASE_URL / api đang chạy.',
    retryable: true,
  },
  CSRF_TOKEN_INVALID: {
    kind: 'auth',
    title: 'CSRF không hợp lệ',
    detail: 'Tải lại trang để nhận CSRF cookie rồi thử lại.',
    retryable: false,
  },
  CSRF_ORIGIN_REQUIRED: {
    kind: 'auth',
    title: 'Thiếu Origin',
    detail: 'Mutation BFF yêu cầu Origin cùng nguồn.',
    retryable: false,
  },
  SCOPE_REQUIRED: {
    kind: 'invalid',
    title: 'Thiếu phạm vi tenant/event',
    detail: 'tenantId và eventId phải là UUID hợp lệ.',
    retryable: false,
  },
  TENANT_REQUIRED: {
    kind: 'invalid',
    title: 'Thiếu tenantId',
    detail: 'tenantId (UUID) là bắt buộc cho danh sách vé.',
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
    title: code ? `Lỗi ${code}` : 'Đổi mã thất bại',
    detail: fallbackMessage?.trim() || 'API trả lỗi không xác định.',
    retryable: Boolean(retryableHint),
  };
}

export function timeoutMessage(): RedeemUxMessage {
  return {
    kind: 'timeout',
    title: 'Hết thời gian chờ (timeout)',
    detail:
      'Yêu cầu đổi mã quá lâu. Đang dò trạng thái thao tác bằng cùng idempotency-key — không gửi mã lần nữa nếu chưa chắc.',
    retryable: true,
  };
}

/** Network loss while outcome is unclear — never claim success; keep same idempotency-key. */
export function networkMessage(): RedeemUxMessage {
  return {
    kind: 'timeout',
    title: 'Mất kết nối mạng',
    detail:
      'Không gọi được API (mạng/upstream). Đang / sẽ dò trạng thái bằng cùng idempotency-key — không gửi mã lần nữa nếu chưa chắc kết quả.',
    retryable: true,
  };
}

export function verifyingMessage(): RedeemUxMessage {
  return {
    kind: 'verifying',
    title: 'Đang xác minh mã…',
    detail: 'Gọi Nest POST /redemptions qua BFF (Bearer từ cookie Keycloak).',
    retryable: false,
  };
}

export function successMessage(ticketId: string, replayed: boolean): RedeemUxMessage {
  return {
    kind: 'success',
    title: replayed ? 'Vé đã cấp (idempotent replay)' : 'Đổi mã thành công',
    detail: `Ticket ${ticketId} từ API thật — không dùng mock proof.`,
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
      ? `Yêu cầu ${requestId} chưa đảm bảo suất. Hết hạn: ${expiresAt}.`
      : `Yêu cầu ${requestId} chưa đảm bảo suất cho đến khi được duyệt.`,
    retryable: false,
  };
}

export function unknownMessage(idempotencyKey: string): RedeemUxMessage {
  return {
    kind: 'unknown',
    title: 'Chưa rõ kết quả — không phải vé',
    detail: `Giữ idempotency-key ${idempotencyKey} và dò lại trạng thái. Không coi là đã cấp vé.`,
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
      return messageForApiError(undefined, 'Unexpected decision.');
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
        detail: status.reason?.trim() || 'Staff đã từ chối yêu cầu đổi mã.',
        retryable: false,
      };
    case 'EXPIRED':
      return {
        kind: 'expired',
        title: 'Yêu cầu đã hết hạn',
        detail: `Pending hết hạn lúc ${status.expiredAt}. Không còn đảm bảo suất.`,
        retryable: false,
      };
    default:
      return messageForApiError(undefined, 'Unknown owner status.');
  }
}
