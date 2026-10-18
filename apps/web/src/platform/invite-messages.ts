import { PLATFORM_ERROR_CODES } from './contracts';
import type { ViewResult } from './shape';

export type InviteUxKind =
  | 'success'
  | 'used'
  | 'invalid'
  | 'auth'
  | 'denied'
  | 'network'
  | 'unknown'
  | 'error';

export type InviteUxMessage = {
  kind: InviteUxKind;
  title: string;
  detail: string;
  retryable: boolean;
};

const BY_CODE: Record<
  string,
  Omit<InviteUxMessage, 'retryable'> & { retryable?: boolean }
> = {
  [PLATFORM_ERROR_CODES.INVITE_ALREADY_USED]: {
    kind: 'used',
    title: 'Lời mời đã được dùng',
    detail:
      'Token này đã được nhận trước đó và không thể dùng lại. Nếu bạn đã là thành viên, mở Admin; nếu không, nhờ Owner gửi lời mời mới.',
    retryable: false,
  },
  [PLATFORM_ERROR_CODES.INVITE_INVALID_OR_EXPIRED]: {
    kind: 'invalid',
    title: 'Lời mời không hợp lệ hoặc đã hết hạn',
    detail:
      'Token sai, đã hết hạn, hoặc email đăng nhập không khớp email được mời. Đăng nhập đúng tài khoản rồi thử lại, hoặc nhờ gửi lời mời mới.',
    retryable: false,
  },
  [PLATFORM_ERROR_CODES.UNAUTHENTICATED]: {
    kind: 'auth',
    title: 'Cần đăng nhập',
    detail:
      'Đăng nhập Keycloak bằng đúng email đã được mời trước khi nhận invite.',
    retryable: false,
  },
  [PLATFORM_ERROR_CODES.INVALID_INPUT]: {
    kind: 'denied',
    title: 'Thiếu email đã xác minh',
    detail:
      'Tài khoản cần email đã xác minh trên Keycloak. Xác minh email rồi đăng nhập lại.',
    retryable: false,
  },
  [PLATFORM_ERROR_CODES.PERMISSION_DENIED]: {
    kind: 'denied',
    title: 'Không đủ quyền',
    detail: 'Phiên hiện tại không được phép nhận lời mời này.',
    retryable: false,
  },
  [PLATFORM_ERROR_CODES.MEMBERSHIP_REVOKED]: {
    kind: 'denied',
    title: 'Thành viên đã bị thu hồi',
    detail: 'Tài khoản này không còn quyền trong tổ chức liên quan.',
    retryable: false,
  },
  [PLATFORM_ERROR_CODES.TENANT_SUSPENDED]: {
    kind: 'denied',
    title: 'Tổ chức đang tạm dừng',
    detail: 'Không thể nhận lời mời khi tổ chức đang SUSPENDED.',
    retryable: false,
  },
  [PLATFORM_ERROR_CODES.RATE_LIMITED]: {
    kind: 'error',
    title: 'Quá nhiều lần thử',
    detail: 'Thử lại sau vài phút.',
    retryable: true,
  },
  [PLATFORM_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED]: {
    kind: 'error',
    title: 'Không gửi được yêu cầu',
    detail: 'Thiếu khóa thao tác. Tải lại trang rồi thử nhận invite lại.',
    retryable: true,
  },
  [PLATFORM_ERROR_CODES.IDEMPOTENCY_CONFLICT]: {
    kind: 'error',
    title: 'Xung đột thao tác',
    detail: 'Yêu cầu trùng khóa nhưng khác nội dung — tải lại trang rồi thử lại.',
    retryable: true,
  },
  CSRF_TOKEN_INVALID: {
    kind: 'auth',
    title: 'Phiên bảo vệ trang hết hạn',
    detail:
      'Cookie CSRF chưa sẵn sàng hoặc không khớp. Tải lại trang nhận lời mời rồi bấm nhận lại — không coi là đã thành công.',
    retryable: false,
  },
  CSRF_ORIGIN_REQUIRED: {
    kind: 'auth',
    title: 'Yêu cầu bị từ chối',
    detail:
      'Thiếu nguồn Origin hợp lệ. Chỉ nhận lời mời từ đúng trang /invite trên cùng máy chủ — không coi là đã thành công.',
    retryable: false,
  },
  CSRF_ORIGIN_MISMATCH: {
    kind: 'auth',
    title: 'Yêu cầu bị từ chối',
    detail:
      'Origin không khớp máy chủ hiện tại. Hệ thống từ chối để chống giả mạo — không nhận lời mời.',
    retryable: false,
  },
  CSRF_ORIGIN_NOT_ALLOWED: {
    kind: 'auth',
    title: 'Yêu cầu bị từ chối',
    detail:
      'Origin không nằm trong danh sách máy chủ được phép. Không nhận lời mời từ nguồn này.',
    retryable: false,
  },
  UPSTREAM_UNAVAILABLE: {
    kind: 'network',
    title: 'Không kết nối được',
    detail: 'Không tới được dịch vụ membership. Thử lại sau vài phút.',
    retryable: true,
  },
  OIDC_MISCONFIGURED: {
    kind: 'auth',
    title: 'Đăng nhập chưa sẵn sàng',
    detail: 'OIDC chưa cấu hình — không mock session. Liên hệ vận hành.',
    retryable: false,
  },
};

export const INVITE_UNKNOWN =
  'Kết quả nhận lời mời chưa rõ. Không coi là đã thành công — kiểm tra lại hoặc thử lại sau.';

export function messageForInviteError(
  code: string | undefined,
  fallbackMessage?: string,
  retryableHint?: boolean,
): InviteUxMessage {
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
    title: 'Không nhận được lời mời',
    detail:
      fallbackMessage?.trim() ||
      'Đã xảy ra lỗi. Thử lại hoặc nhờ Owner gửi lời mời mới.',
    retryable: Boolean(retryableHint),
  };
}

export function messageForInviteView(
  view: ViewResult<{ tenantId: string; membershipId: string; status: string }>,
): InviteUxMessage {
  if (view.kind === 'ok') {
    return {
      kind: 'success',
      title: 'Đã nhận lời mời',
      detail: `Thành viên ${view.value.membershipId} · tổ chức ${view.value.tenantId} · trạng thái ${view.value.status}.`,
      retryable: false,
    };
  }
  if (view.kind === 'rejected') {
    return messageForInviteError(view.code, view.message);
  }
  return {
    kind: 'unknown',
    title: 'Kết quả chưa rõ',
    detail: view.message || INVITE_UNKNOWN,
    retryable: true,
  };
}

export function inviteNetworkMessage(): InviteUxMessage {
  return {
    kind: 'network',
    title: 'Mất kết nối mạng',
    detail:
      'Không gọi được dịch vụ. Không coi là đã nhận invite — thử lại khi có mạng.',
    retryable: true,
  };
}
