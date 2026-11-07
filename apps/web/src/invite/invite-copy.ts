import { dual, localizeCatalog } from '../i18n/dual';
import {
  DEFAULT_ATTENDEE_LOCALE,
  type AttendeeLocale,
} from '../i18n/locale';

export const INVITE_PAGE_COPY_CATALOG = {
  title: dual('Nhận lời mời thành viên', 'Accept a membership invite'),
  metaDescription: dual(
    'Nhận lời mời tham gia tổ chức — đăng nhập đúng email đã được mời.',
    'Accept an organization invite — sign in with the invited email.',
  ),
  intro: dual(
    'Tham gia tổ chức bằng email được mời. Đây không phải lời mời nhận vé sự kiện.',
    'Join the organization with the invited email. This is not an event ticket invite.',
  ),
  support: dual(
    'Đăng nhập bằng đúng email đã được mời. Máy chủ kiểm tra hết hạn, dùng một lần và khớp email — giao diện không tự cấp quyền Owner.',
    'Sign in with the invited email. The server checks expiry, single use, and email match — this screen does not grant Owner rights by itself.',
  ),
  login: dual('Đăng nhập', 'Sign in'),
  tokenLabel: dual('Mã lời mời', 'Invite code'),
  tokenHint: dual(
    'Mã lời mời được giữ riêng tư và chỉ gửi tới máy chủ để kiểm tra.',
    'Your invite code stays private and is sent only to the server for verification.',
  ),
  emptyTitle: dual('Chưa có mã lời mời', 'No invite code yet'),
  emptyDetail: dual(
    'Mở link mời hoặc dán mã vào ô trên sau khi đăng nhập đúng email.',
    'Open the invite link or paste the code above after signing in with the invited email.',
  ),
  submit: dual('Nhận lời mời', 'Accept invite'),
  preparing: dual('Đang chuẩn bị…', 'Preparing…'),
  accepting: dual('Đang nhận…', 'Accepting…'),
  loadingTitle: dual('Đang nhận lời mời…', 'Accepting invite…'),
  loadingDetail: dual(
    'Máy chủ đang kiểm tra hết hạn, dùng một lần và khớp email — chưa coi là thành công.',
    'The server is checking expiry, single use, and email match — this is not success yet.',
  ),
  openPortal: dual('Mở portal quản trị', 'Open admin portal'),
  home: dual('← Trang chủ', '← Home'),
} as const;

export function invitePageCopy(
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
) {
  return localizeCatalog(INVITE_PAGE_COPY_CATALOG, locale);
}
