import { dual, localizeCatalog } from '../i18n/dual';
import {
  DEFAULT_ATTENDEE_LOCALE,
  type AttendeeLocale,
} from '../i18n/locale';

export const GUEST_CLAIM_COPY_CATALOG = {
  title: dual('Nhận lời mời sự kiện', 'Accept an event invite'),
  metaDescription: dual(
    'Nhận lời mời sự kiện sau khi đăng nhập — email đã xác minh phải khớp lời mời.',
    'Accept an event invite after signing in — the verified email must match the invite.',
  ),
  intro: dual(
    'Lời mời nhận vé được gửi qua email. Email đã xác minh phải khớp lời mời.',
    'Ticket invites are sent by email. The verified email must match the invite.',
  ),
  home: dual('← Trang chủ', '← Home'),
  support: dual(
    'Đăng nhập bằng đúng email đã được mời và đã xác minh. Sau đó hoàn tất biểu mẫu và đồng ý điều khoản để nhận lời mời.',
    'Sign in with the invited, verified email. Then complete the form and accept the terms to claim the invite.',
  ),
  loginInvited: dual(
    'Đăng nhập bằng email được mời',
    'Sign in with the invited email',
  ),
  loginInvitedAuth: dual(
    'Đăng nhập bằng email đã được mời',
    'Sign in with the invited email',
  ),
  emptyTitle: dual('Mở liên kết trong email', 'Open the link in your email'),
  emptyDetail: dual(
    'Liên kết lời mời cần đầy đủ thông tin sự kiện. Hãy mở lại email mời để tiếp tục.',
    'The invite link must include the event details. Open the invite email again to continue.',
  ),
  redeem: dual('Đổi mã', 'Redeem a code'),
  wallet: dual('Vé của tôi', 'My tickets'),
  viewWallet: dual('Xem vé của tôi', 'View my tickets'),
  loadingTitle: dual('Đang tải sự kiện…', 'Loading event…'),
  loadingDetail: dual(
    'Đang kiểm tra biểu mẫu và điều khoản đã xuất bản.',
    'Checking the published form and terms.',
  ),
  schemaErrorTitle: dual('Không thể mở lời mời', 'Could not open the invite'),
  schemaNotFound: dual(
    'Không tìm thấy sự kiện đã xuất bản. Mở lại liên kết trong email.',
    'The published event was not found. Open the link in your email again.',
  ),
  schemaMismatch: dual(
    'Thông tin lời mời không khớp sự kiện đã xuất bản hoặc chưa thể tải biểu mẫu.',
    'The invite does not match the published event, or the form could not be loaded.',
  ),
  busyTitle: dual('Đang xử lý…', 'Working…'),
  busyDetail: dual(
    'Đang chờ phản hồi từ máy chủ — chưa có kết quả nhận lời mời.',
    'Waiting for the server — the invite is not claimed yet.',
  ),
  invitedEventFallback: dual('Sự kiện được mời', 'Invited event'),
  eventSectionAria: dual('Sự kiện trong lời mời', 'Event in this invite'),
  termsConsent: dual(
    'Tôi đồng ý với điều khoản sự kiện',
    'I agree to the event terms',
  ),
  termsSummary: dual('Điều khoản sự kiện', 'Event terms'),
  termsBodyAria: dual(
    'Nội dung điều khoản sự kiện',
    'Event terms content',
  ),
  submit: dual('Nhận vé mời', 'Claim invite'),
  sending: dual('Đang gửi…', 'Sending…'),
  missingToken: {
    title: dual('Thiếu mã lời mời', 'Invite code missing'),
    detail: dual(
      'Mở liên kết lời mời để lấy mã — không dán mã vào địa chỉ trang.',
      'Open the invite link to load the code — do not paste the code into the address bar.',
    ),
  },
  missingScope: {
    title: dual('Thiếu thông tin sự kiện', 'Event details missing'),
    detail: dual(
      'Cần mã tổ chức và mã sự kiện kèm theo lời mời.',
      'The invite must include the organization and event ids.',
    ),
  },
  noForm: {
    title: dual('Chưa có biểu mẫu', 'No form yet'),
    detail: dual(
      'Tải biểu mẫu sự kiện đã xuất bản trước khi nhận lời mời.',
      'Load the published event form before claiming the invite.',
    ),
  },
  formInvalid: {
    title: dual('Biểu mẫu chưa hợp lệ', 'Form is not valid'),
    detail: dual(
      'Sửa các trường được đánh dấu rồi thử lại.',
      'Fix the highlighted fields and try again.',
    ),
  },
  auth: {
    title: dual('Cần đăng nhập', 'Sign in required'),
    detail: dual(
      'Đăng nhập bằng email đã được mời rồi quay lại nhận lời mời — intent được giữ trên thiết bị này.',
      'Sign in with the invited email, then return to claim the invite — this device keeps the intent.',
    ),
  },
  pendingNotTicket: dual(
    'Chưa phải vé — kiểm tra lại khi có cập nhật.',
    'This is not a ticket yet — check again when there is an update.',
  ),
  checkStatus: dual('Kiểm tra trạng thái', 'Check status'),
  resubmit: dual('Gửi lại cùng yêu cầu', 'Resubmit the same request'),
  unreadStatus: {
    title: dual('Chưa đọc được trạng thái', 'Could not read status'),
    unauthorized: dual(
      'Đăng nhập lại bằng email được mời để xem trạng thái yêu cầu.',
      'Sign in again with the invited email to view the request status.',
    ),
    retry: dual(
      'Chưa xác nhận được trạng thái mới. Thử kiểm tra lại sau.',
      'The new status is not confirmed. Try checking again later.',
    ),
  },
} as const;

export function guestClaimCopy(
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
) {
  return localizeCatalog(GUEST_CLAIM_COPY_CATALOG, locale);
}
