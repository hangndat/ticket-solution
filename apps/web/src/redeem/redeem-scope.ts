import { isUuid } from '../bff/ids';

export type RedeemScopeField = 'tenantId' | 'eventId';

export type RedeemScopeIssue = {
  fieldId: RedeemScopeField;
  message: string;
};

/** Client-side redeem scope — mirrors BFF fail-closed before mutate. */
export function validateRedeemScope(
  tenantId: string,
  eventId: string,
): RedeemScopeIssue | null {
  const t = tenantId.trim();
  const e = eventId.trim();
  if (!t) {
    return {
      fieldId: 'tenantId',
      message:
        'Thiếu mã tổ chức. Tải biểu mẫu từ đường dẫn sự kiện hoặc nhập mã tổ chức (UUID) trước khi gửi.',
    };
  }
  if (!isUuid(t)) {
    return {
      fieldId: 'tenantId',
      message: 'Mã tổ chức không hợp lệ — cần định dạng UUID.',
    };
  }
  if (!e) {
    return {
      fieldId: 'eventId',
      message:
        'Thiếu mã sự kiện. Tải biểu mẫu hoặc nhập mã sự kiện (UUID) trước khi gửi.',
    };
  }
  if (!isUuid(e)) {
    return {
      fieldId: 'eventId',
      message: 'Mã sự kiện không hợp lệ — cần định dạng UUID.',
    };
  }
  return null;
}
