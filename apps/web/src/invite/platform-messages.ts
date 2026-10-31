import { PLATFORM_ERROR_CODES } from '../bff/platform-contracts';
import type { ViewResult } from '../bff/me-shape';
import { dual, pickDual, type DualString } from '../i18n/dual';
import {
  DEFAULT_ATTENDEE_LOCALE,
  type AttendeeLocale,
} from '../i18n/locale';

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

type DualEntry = {
  kind: InviteUxKind;
  title: DualString;
  detail: DualString;
  retryable?: boolean;
};

const BY_CODE: Record<string, DualEntry> = {
  [PLATFORM_ERROR_CODES.INVITE_ALREADY_USED]: {
    kind: 'used',
    title: dual('Lời mời đã được dùng', 'Invite already used'),
    detail: dual(
      'Mã này đã được nhận trước đó và không thể dùng lại. Nếu bạn đã là thành viên, mở Admin; nếu không, nhờ quản trị gửi lời mời mới.',
      'This code was already accepted and cannot be reused. If you are already a member, open Admin; otherwise ask an admin to send a new invite.',
    ),
    retryable: false,
  },
  [PLATFORM_ERROR_CODES.INVITE_INVALID_OR_EXPIRED]: {
    kind: 'invalid',
    title: dual(
      'Lời mời không hợp lệ hoặc đã hết hạn',
      'Invite is invalid or expired',
    ),
    detail: dual(
      'Mã sai, đã hết hạn, hoặc email đăng nhập không khớp email được mời. Đăng nhập đúng tài khoản rồi thử lại, hoặc nhờ gửi lời mời mới.',
      'The code is wrong, expired, or the signed-in email does not match the invited email. Sign in with the correct account and try again, or ask for a new invite.',
    ),
    retryable: false,
  },
  [PLATFORM_ERROR_CODES.UNAUTHENTICATED]: {
    kind: 'auth',
    title: dual('Cần đăng nhập', 'Sign in required'),
    detail: dual(
      'Đăng nhập bằng đúng email đã được mời trước khi nhận lời mời.',
      'Sign in with the invited email before accepting the invite.',
    ),
    retryable: false,
  },
  [PLATFORM_ERROR_CODES.INVALID_INPUT]: {
    kind: 'denied',
    title: dual('Thiếu email đã xác minh', 'Verified email required'),
    detail: dual(
      'Tài khoản cần email đã xác minh. Xác minh email rồi đăng nhập lại.',
      'This account needs a verified email. Verify the email, then sign in again.',
    ),
    retryable: false,
  },
  [PLATFORM_ERROR_CODES.PERMISSION_DENIED]: {
    kind: 'denied',
    title: dual('Không đủ quyền', 'Not allowed'),
    detail: dual(
      'Phiên hiện tại không được phép nhận lời mời này.',
      'The current session is not allowed to accept this invite.',
    ),
    retryable: false,
  },
  [PLATFORM_ERROR_CODES.MEMBERSHIP_REVOKED]: {
    kind: 'denied',
    title: dual('Thành viên đã bị thu hồi', 'Membership was revoked'),
    detail: dual(
      'Tài khoản này không còn quyền trong tổ chức liên quan.',
      'This account no longer has access to the related organization.',
    ),
    retryable: false,
  },
  [PLATFORM_ERROR_CODES.TENANT_SUSPENDED]: {
    kind: 'denied',
    title: dual('Tổ chức đang tạm dừng', 'Organization is suspended'),
    detail: dual(
      'Không thể nhận lời mời khi tổ chức đang SUSPENDED.',
      'Invites cannot be accepted while the organization is SUSPENDED.',
    ),
    retryable: false,
  },
  [PLATFORM_ERROR_CODES.RATE_LIMITED]: {
    kind: 'error',
    title: dual('Quá nhiều lần thử', 'Too many attempts'),
    detail: dual('Thử lại sau vài phút.', 'Try again in a few minutes.'),
    retryable: true,
  },
  [PLATFORM_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED]: {
    kind: 'error',
    title: dual('Không gửi được yêu cầu', 'Could not send the request'),
    detail: dual(
      'Thiếu khóa thao tác. Tải lại trang rồi thử nhận invite lại.',
      'The operation key is missing. Reload the page and try accepting the invite again.',
    ),
    retryable: true,
  },
  [PLATFORM_ERROR_CODES.IDEMPOTENCY_CONFLICT]: {
    kind: 'error',
    title: dual('Xung đột thao tác', 'Request conflict'),
    detail: dual(
      'Yêu cầu trùng khóa nhưng khác nội dung — tải lại trang rồi thử lại.',
      'The same operation key was sent with different content — reload the page and try again.',
    ),
    retryable: true,
  },
  CSRF_TOKEN_INVALID: {
    kind: 'auth',
    title: dual('Phiên bảo vệ trang hết hạn', 'Page protection expired'),
    detail: dual(
      'Cookie CSRF chưa sẵn sàng hoặc không khớp. Tải lại trang nhận lời mời rồi bấm nhận lại — không coi là đã thành công.',
      'The CSRF cookie is missing or does not match. Reload the invite page and accept again — this is not success yet.',
    ),
    retryable: false,
  },
  CSRF_ORIGIN_REQUIRED: {
    kind: 'auth',
    title: dual('Yêu cầu bị từ chối', 'Request rejected'),
    detail: dual(
      'Thiếu nguồn Origin hợp lệ. Chỉ nhận lời mời từ đúng trang /invite trên cùng máy chủ — không coi là đã thành công.',
      'A valid Origin is missing. Accept invites only from the /invite page on this host — this is not success yet.',
    ),
    retryable: false,
  },
  CSRF_ORIGIN_MISMATCH: {
    kind: 'auth',
    title: dual('Yêu cầu bị từ chối', 'Request rejected'),
    detail: dual(
      'Origin không khớp máy chủ hiện tại. Hệ thống từ chối để chống giả mạo — không nhận lời mời.',
      'Origin does not match this host. The request was rejected to prevent spoofing — the invite was not accepted.',
    ),
    retryable: false,
  },
  CSRF_ORIGIN_NOT_ALLOWED: {
    kind: 'auth',
    title: dual('Yêu cầu bị từ chối', 'Request rejected'),
    detail: dual(
      'Origin không nằm trong danh sách máy chủ được phép. Không nhận lời mời từ nguồn này.',
      'Origin is not on the allowlist. Invites cannot be accepted from this source.',
    ),
    retryable: false,
  },
  UPSTREAM_UNAVAILABLE: {
    kind: 'network',
    title: dual('Không kết nối được', 'Could not connect'),
    detail: dual(
      'Không tới được dịch vụ membership. Thử lại sau vài phút.',
      'The membership service is unreachable. Try again in a few minutes.',
    ),
    retryable: true,
  },
  OIDC_MISCONFIGURED: {
    kind: 'auth',
    title: dual('Đăng nhập chưa sẵn sàng', 'Sign-in is not ready'),
    detail: dual(
      'Đăng nhập chưa sẵn sàng trên môi trường này — không thể nhận lời mời. Liên hệ vận hành.',
      'Sign-in is not available in this environment — invites cannot be accepted. Contact operations.',
    ),
    retryable: false,
  },
};

const GENERIC = {
  unknown: dual(
    'Kết quả nhận lời mời chưa rõ. Không coi là đã thành công — kiểm tra lại hoặc thử lại sau.',
    'The invite result is unclear. This is not success — check again or try later.',
  ),
  errorTitle: dual('Không nhận được lời mời', 'Could not accept the invite'),
  errorDetail: dual(
    'Đã xảy ra lỗi. Thử lại hoặc nhờ Owner gửi lời mời mới.',
    'Something went wrong. Try again or ask an Owner to send a new invite.',
  ),
  successTitle: dual('Đã nhận lời mời', 'Invite accepted'),
  successDetail: dual(
    'Bạn đã tham gia tổ chức. Mở Admin để tiếp tục — không tự cấp quyền Owner.',
    'You joined the organization. Open Admin to continue — this does not grant Owner rights by itself.',
  ),
  unclearTitle: dual('Kết quả chưa rõ', 'Result is unclear'),
  networkTitle: dual('Mất kết nối mạng', 'Network connection lost'),
  networkDetail: dual(
    'Không gọi được dịch vụ. Không coi là đã nhận lời mời — thử lại khi có mạng.',
    'The service could not be reached. The invite is not accepted — try again when you are online.',
  ),
};

export const INVITE_UNKNOWN = pickDual(GENERIC.unknown, DEFAULT_ATTENDEE_LOCALE);

export function messageForInviteError(
  code: string | undefined,
  fallbackMessage?: string,
  retryableHint?: boolean,
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): InviteUxMessage {
  const mapped = code ? BY_CODE[code] : undefined;
  if (mapped) {
    return {
      kind: mapped.kind,
      title: pickDual(mapped.title, locale),
      detail: pickDual(mapped.detail, locale),
      retryable: mapped.retryable ?? Boolean(retryableHint),
    };
  }
  return {
    kind: 'error',
    title: pickDual(GENERIC.errorTitle, locale),
    detail:
      fallbackMessage?.trim() || pickDual(GENERIC.errorDetail, locale),
    retryable: Boolean(retryableHint),
  };
}

export function messageForInviteView(
  view: ViewResult<{ tenantId: string; membershipId: string; status: string }>,
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): InviteUxMessage {
  if (view.kind === 'ok') {
    return {
      kind: 'success',
      title: pickDual(GENERIC.successTitle, locale),
      detail: pickDual(GENERIC.successDetail, locale),
      retryable: false,
    };
  }
  if (view.kind === 'rejected') {
    return messageForInviteError(view.code, view.message, undefined, locale);
  }
  return {
    kind: 'unknown',
    title: pickDual(GENERIC.unclearTitle, locale),
    detail: view.message || pickDual(GENERIC.unknown, locale),
    retryable: true,
  };
}

export function inviteNetworkMessage(
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): InviteUxMessage {
  return {
    kind: 'network',
    title: pickDual(GENERIC.networkTitle, locale),
    detail: pickDual(GENERIC.networkDetail, locale),
    retryable: true,
  };
}
