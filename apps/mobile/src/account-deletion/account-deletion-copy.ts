import type { AccountDeletionRequest } from './types.ts';

/** UI never claims ACK means the account or tickets were deleted. */
const DELETED_CLAIM_PATTERN =
  /\b(đã\s*xóa|da\s*xoa|deleted|erased|purged|removed\s+account)\b/i;

export function accountDeletionExplainer(): {
  title: string;
  body: string;
} {
  return {
    title: 'Yêu cầu xóa tài khoản',
    body:
      'Gửi yêu cầu chỉ ghi nhận trên máy chủ. O06 đã chốt: tài khoản được anonymize trong ≤30 ngày sau khi yêu cầu được xử lý — bước này không xóa ngay identity/vé/audit. ACK ≠ erasure hoàn tất.',
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
    body:
      'Bạn xác nhận muốn ghi nhận yêu cầu xóa tài khoản? Đây không phải lệnh xóa ngay. Đăng xuất vẫn là hành động riêng.',
    confirmLabel: 'Gửi yêu cầu (không xóa ngay)',
    cancelLabel: 'Hủy',
  };
}

/**
 * Human status for an acknowledged or loaded request.
 * Never labels the row as "đã xóa" / deleted.
 */
export function describeAccountDeletionRequest(
  request: AccountDeletionRequest,
): { title: string; body: string } {
  const policyNote =
    request.policyStatus === 'UNRESOLVED'
      ? 'PolicyStatus UNRESOLVED — retention/anonymize chưa cấu hình trên máy chủ.'
      : 'PolicyStatus CONFIGURED — O06: anonymize ≤30 ngày; ACK vẫn ≠ xóa ngay.';

  switch (request.state) {
    case 'AWAITING_POLICY':
      return {
        title: 'Yêu cầu đã được ghi nhận',
        body: `requestId ${request.requestId}\nstate AWAITING_POLICY · requestedAt ${request.requestedAt}\n${policyNote}\nACK ≠ erasure — identity/vé/audit vẫn còn trên máy chủ.`,
      };
    case 'REQUESTED':
    case 'UNDER_REVIEW':
      return {
        title: 'Yêu cầu đang được xem xét',
        body: `requestId ${request.requestId}\nstate ${request.state} · requestedAt ${request.requestedAt}\n${policyNote}\nChưa phải chứng nhận erasure hoàn tất.`,
      };
    case 'REJECTED':
      return {
        title: 'Yêu cầu bị từ chối',
        body: `requestId ${request.requestId}\nstate REJECTED · requestedAt ${request.requestedAt}`,
      };
    case 'COMPLETED':
      // GET may eventually return this after O06; never present ACK as this.
      return {
        title: 'Trạng thái máy chủ: COMPLETED',
        body: `requestId ${request.requestId}\nrequestedAt ${request.requestedAt}\n${policyNote}\nKhông suy ra store approval chỉ từ request; kiểm tra quy trình xóa thật riêng.`,
      };
    default: {
      const _exhaustive: never = request.state;
      return {
        title: 'Trạng thái yêu cầu',
        body: String(_exhaustive),
      };
    }
  }
}

/** Guard for copy / UI labels — fail tests if we invent a deleted claim. */
export function assertsNoDeletedClaim(text: string): boolean {
  return !DELETED_CLAIM_PATTERN.test(text);
}
