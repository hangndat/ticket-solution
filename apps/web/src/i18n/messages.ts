import type { AttendeeLocale } from './locale';

export const VI = {
  'locale.label': 'Ngôn ngữ',
  'locale.vi': 'VI',
  'locale.en': 'EN',
  'nav.skip': 'Bỏ qua đến nội dung',
  'nav.brandHome': 'trang chủ',
  'nav.primary': 'Điều hướng chính',
  'nav.menu': 'Menu',
  'nav.menuClose': 'Đóng',
  'nav.menuTitle': 'Menu điều hướng',
  'nav.account': 'Tài khoản',
  'nav.events': 'Khám phá',
  'nav.redeem': 'Đổi mã',
  'nav.login': 'Đăng nhập',
  'nav.wallet': 'Vé của tôi',
  'footer.tagline': 'Sự kiện & vé',
  'footer.nav': 'Liên kết chân trang',
  'home.browse': 'Khám phá sự kiện',
  'home.intro': 'Tìm sự kiện và xem thông tin tham dự.',
  'home.redeemCta': 'Có mã mời? Đổi mã lấy vé',
  'copy.offlineQrBanner':
    'Mất kết nối · QR trên màn hình có thể chưa cập nhật trạng thái mới nhất.',
  'copy.unknownIssuance':
    'Chưa xác định kết quả. Vui lòng kiểm tra vé trước khi thử lại.',
} as const;

export const EN: { [K in keyof typeof VI]: string } = {
  'locale.label': 'Language',
  'locale.vi': 'VI',
  'locale.en': 'EN',
  'nav.skip': 'Skip to content',
  'nav.brandHome': 'home',
  'nav.primary': 'Primary',
  'nav.menu': 'Menu',
  'nav.menuClose': 'Close',
  'nav.menuTitle': 'Navigation menu',
  'nav.account': 'Account',
  'nav.events': 'Explore',
  'nav.redeem': 'Redeem',
  'nav.login': 'Sign in',
  'nav.wallet': 'My tickets',
  'footer.tagline': 'Events & tickets',
  'footer.nav': 'Footer links',
  'home.browse': 'Explore events',
  'home.intro': 'Find an event and view attendance details.',
  'home.redeemCta': 'Have an invite code? Redeem it for a ticket',
  'copy.offlineQrBanner':
    'Offline · The on-screen QR may not show the latest status.',
  'copy.unknownIssuance':
    'Result is not confirmed yet. Check your tickets before retrying.',
};

export type MessageKey = keyof typeof VI;

export const DICTS: Record<AttendeeLocale, Record<MessageKey, string>> = {
  vi: VI,
  en: EN,
};
