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
    'Đây là lời mời tham gia tổ chức — khác lời mời nhận vé sự kiện. Mở liên kết mời, đăng nhập nếu cần, rồi xác nhận mã. Email đăng nhập phải khớp email được mời; giao diện không tự cấp quyền quản trị.',
    'This is an organization membership invite — not an event ticket invite. Open the invite link, sign in if needed, then confirm the code. The signed-in email must match the invited email; this screen does not grant admin rights by itself.',
  ),
  support: dual(
    'Đăng nhập bằng đúng email đã được mời. Máy chủ kiểm tra hết hạn, dùng một lần và khớp email — giao diện không tự cấp quyền Owner.',
    'Sign in with the invited email. The server checks expiry, single use, and email match — this screen does not grant Owner rights by itself.',
  ),
  login: dual('Đăng nhập', 'Sign in'),
  tokenLabel: dual('Mã lời mời', 'Invite code'),
  tokenHint: dual(
    'Mở link mời (mã nằm sau # trên URL) — tránh dán mã dạng ?token= trên thanh địa chỉ.',
    'Open the invite link (the code is after # in the URL) — avoid pasting ?token= in the address bar.',
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
