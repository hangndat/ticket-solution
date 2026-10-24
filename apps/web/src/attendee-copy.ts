/**
 * Attendee consumer copy — aligned with COPY-GUIDE (VD-03 / VD-04).
 * Single source for cross-route labels; do not invent alternate phrasing in pages.
 */
export const ATTENDEE_COPY = {
  browseEvents: 'Khám phá sự kiện',
  walletTitle: 'Vé của tôi',
  redeemEyebrow: 'Nhập mã mời',
  redeemTitle: 'Đổi mã lấy vé',
  emailVerification: 'Xác minh email để nhận vé',
  offlineCachedQr: 'Bản vé đã lưu · Trạng thái có thể chưa cập nhật',
  unknownIssuance:
    'Chưa xác định kết quả. Kiểm tra lại vé của bạn trước khi thử lại.',
  eventForbidden: {
    title: 'Sự kiện không công khai',
    detail:
      'Bạn không có quyền xem sự kiện này. Liên hệ ban tổ chức nếu bạn có mã mời.',
  },
} as const;
