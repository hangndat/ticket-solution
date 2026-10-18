import type { AccountDeletionRequest } from './types.ts';

/** UI never claims the account or tickets were already deleted. */
const DELETED_CLAIM_PATTERN =
  /\b(đã\s*xóa|da\s*xoa|deleted|erased|purged|removed\s+account)\b/i;

/** Internal jargon must not appear in user-visible deletion copy. */
const INTERNAL_JARGON_PATTERN =
  /\b(O06|ACK|anonymize|erasure|PolicyStatus|AWAITING_POLICY|UNDER_REVIEW|REQUESTED|COMPLETED|REJECTED|UNRESOLVED|CONFIGURED|ackMeansDeleted)\b/i;

const PROCESSING_NOTE_VI =
  'Chúng tôi xử lý yêu cầu trong vòng tối đa 30 ngày. Tài khoản không bị xóa ngay. Một số bản ghi kiểm toán có thể được giữ lại theo quy định pháp lý.';

const PROCESSING_NOTE_EN =
  'We process requests within 30 days. Your account is not wiped instantly. Some audit records may be retained when the law requires it.';

function bilingual(vi: string, en: string): string {
  return `${vi}\n\n${en}`;
}

export function accountDeletionExplainer(): {
  title: string;
  body: string;
} {
  return {
    title: 'Yêu cầu xóa tài khoản / Account deletion request',
    body: bilingual(
      `Khi bạn gửi yêu cầu, chúng tôi chỉ ghi nhận trên máy chủ. ${PROCESSING_NOTE_VI} Đăng xuất là thao tác riêng và không thay cho yêu cầu xóa.`,
      `Submitting a request only records it on our servers. ${PROCESSING_NOTE_EN} Signing out is separate and does not replace a deletion request.`,
    ),
  };
}

export function accountDeletionConfirmCopy(): {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
} {
  return {
    title: 'Xác nhận gửi yêu cầu / Confirm request',
    body: bilingual(
      'Bạn muốn gửi yêu cầu xóa tài khoản? Đây chưa phải lệnh xóa ngay. Đăng xuất vẫn là thao tác riêng.',
      'Do you want to submit an account deletion request? This does not wipe the account right away. Signing out remains a separate action.',
    ),
    confirmLabel: 'Gửi yêu cầu (không xóa ngay) / Submit (not instant wipe)',
    cancelLabel: 'Hủy / Cancel',
  };
}

/**
 * Human status for an acknowledged or loaded request.
 * Never labels the row as "đã xóa" / deleted; never exposes raw enums or IDs.
 */
export function describeAccountDeletionRequest(
  request: AccountDeletionRequest,
): { title: string; body: string } {
  const retentionNote = bilingual(PROCESSING_NOTE_VI, PROCESSING_NOTE_EN);

  switch (request.state) {
    case 'AWAITING_POLICY':
      return {
        title: 'Đã nhận yêu cầu / Request received',
        body: bilingual(
          `Yêu cầu của bạn đã được ghi nhận. ${PROCESSING_NOTE_VI}`,
          `Your request has been recorded. ${PROCESSING_NOTE_EN}`,
        ),
      };
    case 'REQUESTED':
    case 'UNDER_REVIEW':
      return {
        title: 'Đang xử lý yêu cầu / Request in progress',
        body: bilingual(
          `Yêu cầu đang được xem xét. ${PROCESSING_NOTE_VI}`,
          `Your request is under review. ${PROCESSING_NOTE_EN}`,
        ),
      };
    case 'REJECTED':
      return {
        title: 'Yêu cầu không được chấp nhận / Request not accepted',
        body: bilingual(
          'Máy chủ đã từ chối yêu cầu này. Bạn có thể liên hệ hỗ trợ nếu cần thêm thông tin.',
          'The server did not accept this request. Contact support if you need more information.',
        ),
      };
    case 'COMPLETED':
      return {
        title: 'Xử lý trên máy chủ đã kết thúc / Server processing finished',
        body: bilingual(
          `Máy chủ báo đã hoàn tất xử lý yêu cầu. ${PROCESSING_NOTE_VI} Trạng thái này không đồng nghĩa phê duyệt cửa hàng.`,
          `The server reports it finished processing the request. ${PROCESSING_NOTE_EN} This status is not store approval.`,
        ),
      };
    default: {
      const _exhaustive: never = request.state;
      void _exhaustive;
      return {
        title: 'Trạng thái yêu cầu / Request status',
        body: retentionNote,
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
