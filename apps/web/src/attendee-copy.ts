/**
 * Attendee consumer copy — aligned with COPY-GUIDE (VD-03 / VD-04).
 * Dual-language catalog; ATTENDEE_COPY is the VI default (O04).
 */
import { dual, localizeCatalog } from './i18n/dual';
import {
  DEFAULT_ATTENDEE_LOCALE,
  type AttendeeLocale,
} from './i18n/locale';

export const ATTENDEE_COPY_CATALOG = {
  browseEvents: dual('Khám phá sự kiện', 'Explore events'),
  walletTitle: dual('Vé của tôi', 'My tickets'),
  redeemEyebrow: dual('Nhập mã mời', 'Enter invite code'),
  redeemTitle: dual('Đổi mã lấy vé', 'Redeem a code'),
  emailVerification: dual(
    'Xác minh email để nhận vé',
    'Verify your email to receive a ticket',
  ),
  offlineQrBanner: dual(
    'Mất kết nối · QR trên màn hình có thể chưa cập nhật trạng thái mới nhất.',
    'Offline · The on-screen QR may not show the latest status.',
  ),
  unknownIssuance: dual(
    'Chưa xác định kết quả. Vui lòng kiểm tra vé trước khi thử lại.',
    'Result is not confirmed yet. Check your tickets before retrying.',
  ),
  eventForbidden: {
    title: dual('Sự kiện không công khai', 'This event is not public'),
    detail: dual(
      'Bạn không có quyền xem sự kiện này. Liên hệ ban tổ chức nếu bạn có mã mời.',
      'You cannot view this event. Contact the organizer if you have an invite code.',
    ),
  },
} as const;

export const ATTENDEE_COPY = localizeCatalog(
  ATTENDEE_COPY_CATALOG,
  DEFAULT_ATTENDEE_LOCALE,
);

export function attendeeCopy(locale: AttendeeLocale) {
  return localizeCatalog(ATTENDEE_COPY_CATALOG, locale);
}
