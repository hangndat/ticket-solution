import type { AccountDeletionRequest } from './types.ts';

/** UI never claims the account or tickets were already deleted. */
const DELETED_CLAIM_PATTERN =
  /\b(đã\s*xóa|da\s*xoa|deleted|erased|purged|removed\s+account)\b/i;

/** Internal jargon must not appear in user-visible deletion copy. */
const INTERNAL_JARGON_PATTERN =
  /\b(O06|ACK|anonymize|erasure|PolicyStatus|AWAITING_POLICY|UNDER_REVIEW|REQUESTED|COMPLETED|REJECTED|UNRESOLVED|CONFIGURED|ackMeansDeleted)\b/i;

const PROCESSING_NOTE_VI =
  'Chúng tôi xử lý yêu cầu trong vòng tối đa 30 ngày. Tài khoản không bị xóa ngay. Một số bản ghi kiểm toán có thể được giữ lại theo quy định pháp lý.';

export function accountDeletionExplainer(): {
  title: string;
  body: string;
} {
  return {
    title: 'Yêu cầu xóa tài khoản',
    body: `Khi bạn gửi yêu cầu, chúng tôi chỉ ghi nhận trên máy chủ. ${PROCESSING_NOTE_VI} Đăng xuất là thao tác riêng và không thay cho yêu cầu xóa.`,
  };
}

export function accountDeletionConfirmCopy(): {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
} {
  return {
    title: 'Xác nhận gửi yêu cầu',
    body: 'Bạn muốn gửi yêu cầu xóa tài khoản? Đây chưa phải lệnh xóa ngay. Đăng xuất vẫn là thao tác riêng.',
    confirmLabel: 'Gửi yêu cầu (không xóa ngay)',
    cancelLabel: 'Hủy',
  };
}

/**
 * Human status for an acknowledged or loaded request.
 * Never labels the row as "đã xóa" / deleted; never exposes raw enums or IDs.
 */
export function describeAccountDeletionRequest(
  request: AccountDeletionRequest,
): { title: string; body: string } {
  switch (request.state) {
    case 'AWAITING_POLICY':
      return {
        title: 'Đã nhận yêu cầu',
        body: `Yêu cầu của bạn đã được ghi nhận. ${PROCESSING_NOTE_VI}`,
      };
    case 'REQUESTED':
    case 'UNDER_REVIEW':
      return {
        title: 'Đang xử lý yêu cầu',
        body: `Yêu cầu đang được xem xét. ${PROCESSING_NOTE_VI}`,
      };
    case 'REJECTED':
      return {
        title: 'Yêu cầu không được chấp nhận',
        body: 'Máy chủ đã từ chối yêu cầu này. Bạn có thể liên hệ hỗ trợ nếu cần thêm thông tin.',
      };
    case 'COMPLETED':
      return {
        title: 'Xử lý trên máy chủ đã kết thúc',
        body: `Máy chủ báo đã hoàn tất xử lý yêu cầu. ${PROCESSING_NOTE_VI} Trạng thái này không đồng nghĩa phê duyệt cửa hàng.`,
      };
    default: {
      const _exhaustive: never = request.state;
      void _exhaustive;
      return {
        title: 'Trạng thái yêu cầu',
        body: PROCESSING_NOTE_VI,
      };
    }
  }
}

/** Guard for copy / UI labels — fail tests if we invent a deleted claim. */
export function assertsNoDeletedClaim(text: string): boolean {
  return !DELETED_CLAIM_PATTERN.test(text);
}

/** Guard: user-facing copy must stay free of internal ADR / protocol jargon. */
export function assertsNoInternalJargon(text: string): boolean {
  return !INTERNAL_JARGON_PATTERN.test(text);
}
