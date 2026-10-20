/** User-facing Gate scan / API messages (VI). No secrets in copy. */

export type ParseScanFailReason =
  | 'empty'
  | 'invalid_json'
  | 'unsupported_kind'
  | 'missing_ids'
  | 'missing_credential_token'
  | 'missing_gate_scope'
  | 'unrecognized';

export function messageFromParseFailure(
  reason: ParseScanFailReason,
  kind?: string,
): string {
  switch (reason) {
    case 'empty':
      return 'Chưa có mã để quét.';
    case 'invalid_json':
      return 'QR không đọc được (JSON lỗi).';
    case 'unsupported_kind':
      return `Định dạng QR không hỗ trợ (${kind ?? 'không rõ'}). Dùng QR vé chính thức (credential hoặc display).`;
    case 'missing_ids':
      return 'QR thiếu mã vé hoặc phạm vi tenant/sự kiện.';
    case 'missing_credential_token':
      return 'QR credential thiếu token — không thể gửi lên cổng. Phát hành lại QR vé.';
    case 'missing_gate_scope':
      return 'Chỉ có mã vé — chọn sự kiện cổng trước khi quét UUID thuần.';
    case 'unrecognized':
      return 'Mã không đọc được. Không cho vào.';
  }
}

export function messageScopeMismatch(field: 'event' | 'tenant'): string {
  if (field === 'event') {
    return 'Vé không thuộc sự kiện đang chọn. Đổi sự kiện cổng hoặc quét vé đúng sự kiện.';
  }
  return 'Vé không thuộc tenant của sự kiện đang chọn.';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

/**
 * Map stable API codes to staff-facing copy. Server still decides admission.
 */
export function messageFromGateApi(
  status: number,
  json: unknown,
  networkError: boolean,
): string {
  if (networkError || status === 0) {
    return 'Mất kết nối. Thử lại khi có mạng hoặc xếp hàng offline nếu đã mở phiên.';
  }
  const body = asRecord(json);
  const code = typeof body?.code === 'string' ? body.code : '';
  switch (code) {
    case 'ALREADY_CHECKED_IN':
      return 'Vé đã check-in trước đó. Cho qua theo lần ghi nhận — không tạo lượt mới.';
    case 'TICKET_NOT_FOUND':
      return 'Không tìm thấy vé trên hệ thống.';
    case 'TICKET_NOT_ACTIVE':
      return 'Vé không còn hiệu lực (đã hủy hoặc thu hồi).';
    case 'HELD_BY_OTHER_SESSION':
      return 'Vé đang được giữ bởi phiên quét khác. Chờ hoặc đối soát.';
    case 'RESERVATION_EXPIRED':
      return 'Giữ chỗ hết hạn — quét lại vé.';
    case 'CHECKIN_WINDOW_CLOSED':
      return 'Cửa sổ check-in đã đóng.';
    case 'EVENT_CANCELLED':
      return 'Sự kiện đã hủy.';
    case 'EVENT_NOT_FOUND':
      return 'Sự kiện không tồn tại hoặc không truy cập được.';
    case 'SESSION_NOT_ACTIVE':
      return 'Phiên nhân viên chưa mở hoặc đã kết thúc. Mở phiên lại khi online.';
    case 'ACCOUNT_DELETION_OPEN':
      return 'Tài khoản đang chờ xóa — không mở phiên cổng.';
    case 'PERMISSION_DENIED':
    case 'MEMBERSHIP_REQUIRED':
    case 'AUTHZ_DENIED':
      return 'Không có quyền cổng cho sự kiện này. Kiểm tra membership hoặc đăng nhập lại.';
    default:
      break;
  }
  if (status === 401 || status === 403) {
    return 'Không có quyền hoặc phiên đã hết. Đăng nhập staff lại.';
  }
  if (typeof body?.message === 'string' && body.message.trim()) {
    return body.message;
  }
  return 'Từ chối. Không cho vào.';
}
