import { dual, formatDual, localizeCatalog } from '../i18n/dual';
import {
  DEFAULT_ATTENDEE_LOCALE,
  type AttendeeLocale,
} from '../i18n/locale';

export const REDEEM_FORM_COPY_CATALOG = {
  pageEyebrow: dual('Nhập mã mời', 'Enter invite code'),
  pageTitle: dual('Đổi mã lấy vé', 'Redeem a code'),
  pageLead: dual('Một mã mời duy nhất.', 'One invite code.'),
  metaDescription: dual(
    'Nhập mã mời. Đăng nhập trước khi đổi mã.',
    'Enter your invite code. Sign in before redeeming.',
  ),
  retry: dual('Thử lại', 'Try again'),
  home: dual('Về trang chủ', 'Back to home'),
  login: dual('Đăng nhập', 'Sign in'),
  loginContinue: dual('Tiếp tục đăng nhập', 'Continue to sign in'),
  loginToRedeemTitle: dual('Đăng nhập để đổi mã', 'Sign in to redeem'),
  loginToRedeemDetail: dual(
    'Đăng nhập để tiếp tục. Bạn sẽ quay lại trang này sau đó.',
    'Sign in to continue. You will return to this page afterwards.',
  ),
  verifyEmailTitle: dual('Xác minh email', 'Verify your email'),
  verifyEmailDetail: dual(
    'Xác minh email trong mục Tài khoản, sau đó quay lại trang Đổi mã.',
    'Verify your email in Account, then return to Redeem.',
  ),
  guestCodeHint: dual(
    'Mã chưa được tra cứu hoặc lưu. Sau khi đăng nhập và xác minh email, hãy nhập lại mã.',
    'The code is not looked up or saved. Enter it again after signing in and verifying your email.',
  ),
  checkingSession: dual('Đang kiểm tra phiên đăng nhập…', 'Checking your session…'),
  oidcDownTitle: dual('Cần đăng nhập', 'Sign in required'),
  oidcDownDetail: dual(
    'Đăng nhập chưa sẵn sàng trên môi trường này — không thể đổi mã.',
    'Sign-in is not available in this environment — codes cannot be redeemed.',
  ),
  formTitleEnter: dual('Nhập mã đổi vé', 'Enter redemption code'),
  formTitleConfirm: dual('Đổi mã lấy vé', 'Redeem a code'),
  enterCodeHint: dual(
    'Thông tin sự kiện và loại vé sẽ hiện ở bước tiếp theo.',
    'Event and ticket type details appear in the next step.',
  ),
  leadGlobalConfirm: dual(
    'Kiểm tra thông tin sự kiện, điền biểu mẫu và đồng ý điều khoản trước khi đổi vé.',
    'Check the event details, complete the form, and accept the terms before redeeming.',
  ),
  leadScoped: dual(
    'Nhập mã và đồng ý điều khoản của sự kiện. Trạng thái chờ duyệt chưa phải vé.',
    'Enter the code and accept the event terms. A pending request is not a ticket.',
  ),
  introGlobalEnter: dual(
    'Nhập mã đổi vé — hệ thống sẽ xác định sự kiện và loại vé. Sau đó điền biểu mẫu và đồng ý điều khoản.',
    'Enter the redemption code — the event and ticket type will be identified. Then complete the form and accept the terms.',
  ),
  introGlobalConfirm: dual(
    'Xác nhận thông tin sự kiện, hoàn thành biểu mẫu và đồng ý điều khoản trước khi đổi vé.',
    'Confirm the event details, complete the form, and accept the terms before redeeming.',
  ),
  introScoped: dual(
    'Tải biểu mẫu sự kiện đã xuất bản, nhập mã và đồng ý điều khoản. Đang chờ duyệt chưa phải vé; nếu chưa rõ kết quả, bấm «Kiểm tra lại».',
    'Load the published event form, enter the code, and accept the terms. Pending review is not a ticket; if the result is unclear, tap “Check again”.',
  ),
  contextTitle: dual('Sự kiện từ mã của bạn', 'Event from your code'),
  org: dual('Tổ chức', 'Organization'),
  event: dual('Sự kiện', 'Event'),
  ticketType: dual('Loại vé', 'Ticket type'),
  otherCode: dual('Nhập mã khác', 'Enter a different code'),
  codeLabel: dual('Mã đổi vé', 'Redemption code'),
  codePlaceholder: dual('Nhập mã đổi vé', 'Enter redemption code'),
  codeHint: dual(
    'Nhập mã trong email hoặc trên vé của bạn.',
    'Enter the code from your email or ticket.',
  ),
  termsOnly: dual(
    'Sự kiện này không có trường biểu mẫu — nhập mã và đồng ý điều khoản bên dưới để đổi vé.',
    'This event has no form fields — enter the code and accept the terms below to redeem.',
  ),
  noFormTitle: dual('Chưa có biểu mẫu', 'No form yet'),
  noFormGlobal: dual(
    'Tra mã thành công sẽ hiển thị biểu mẫu tại đây.',
    'The form appears here after the code is resolved.',
  ),
  noFormScoped: dual(
    'Tải biểu mẫu bằng đường dẫn tổ chức/sự kiện, hoặc sự kiện chỉ cần mã và điều khoản.',
    'Load the form from the organization/event path, or redeem with code and terms only.',
  ),
  continue: dual('Tiếp tục', 'Continue'),
  submit: dual('Đổi mã lấy vé', 'Redeem code'),
  resolving: dual('Đang tra mã…', 'Looking up code…'),
  processing: dual('Đang xử lý…', 'Working…'),
  checkAgain: dual('Kiểm tra lại', 'Check again'),
  checkRequest: dual(
    'Kiểm tra trạng thái yêu cầu',
    'Check request status',
  ),
  refreshRequest: dual(
    'Làm mới trạng thái yêu cầu',
    'Refresh request status',
  ),
  viewWallet: dual('Xem vé của tôi', 'View my tickets'),
  myTickets: dual('Vé của tôi', 'My tickets'),
  tryOtherCode: dual('Thử mã khác', 'Try another code'),
  eventsList: dual('Về danh sách sự kiện', 'Back to events'),
  reloadRetry: dual('Tải lại và thử lại', 'Reload and retry'),
  openAccount: dual('Mở Tài khoản', 'Open Account'),
  yourTicket: dual('Vé của bạn', 'Your ticket'),
  ticketId: dual('Mã vé', 'Ticket ID'),
  status: dual('Trạng thái', 'Status'),
  requestId: dual('Mã yêu cầu', 'Request ID'),
  techDetails: dual('Chi tiết kỹ thuật', 'Technical details'),
  techDetailsClosed: dual(
    'Chi tiết kỹ thuật (đóng mặc định)',
    'Technical details (collapsed)',
  ),
  opKey: dual('Khóa thao tác', 'Operation key'),
  jsonAria: dual(
    'Phản hồi máy chủ dạng JSON — chỉ dành cho hỗ trợ kỹ thuật',
    'JSON server response — for technical support only',
  ),
  pollingTitle: dual('Đang kiểm tra lại…', 'Checking again…'),
  pollingDetail: dual(
    'Đang xác nhận kết quả đổi mã. Chưa phải vé cho đến khi có xác nhận.',
    'Confirming the redemption result. This is not a ticket until it is confirmed.',
  ),
  codeRequired: dual('Mã đổi vé là bắt buộc.', 'A redemption code is required.'),
  schema: {
    loadingForm: dual(
      'Đang tải biểu mẫu và điều khoản…',
      'Loading the form and terms…',
    ),
    loadedForm: dual(
      'Đã tải biểu mẫu mới. Điền lại và đồng ý điều khoản trước khi gửi.',
      'A new form was loaded. Fill it in and accept the terms before submitting.',
    ),
    loadedFormNoTenant: dual(
      'Đã tải biểu mẫu mới. Điền lại và đồng ý điều khoản trước khi gửi. Máy chủ chưa trả mã tổ chức — nhập «Mã tổ chức» (UUID) trong tùy chọn nâng cao trước khi đổi mã.',
      'A new form was loaded. Fill it in and accept the terms before submitting. The server did not return an organization id — enter the organization UUID in advanced options before redeeming.',
    ),
    eventNotFound: dual(
      'Không tìm thấy sự kiện đã xuất bản. Không dùng biểu mẫu demo.',
      'Published event not found. Do not use a demo form.',
    ),
    formUnreachable: dual(
      'Không tải được biểu mẫu sự kiện. Thử lại sau — không dùng bản demo.',
      'Could not load the event form. Try again later — do not use a demo form.',
    ),
    formInvalid: dual(
      'Biểu mẫu không hợp lệ hoặc thiếu mã sự kiện.',
      'The form is invalid or the event id is missing.',
    ),
    staleReloading: dual(
      'Biểu mẫu hoặc điều khoản đã đổi — đang tải lại. Bạn cần đồng ý lại trước khi gửi.',
      'The form or terms changed — reloading. You must accept again before submitting.',
    ),
    staleNeedPath: dual(
      'Biểu mẫu hoặc điều khoản đã đổi — nhập đường dẫn tổ chức/sự kiện rồi bấm «Tải biểu mẫu» và đồng ý lại.',
      'The form or terms changed — enter the organization/event path, load the form, and accept again.',
    ),
    resolvingCode: dual('Đang tra mã…', 'Looking up code…'),
    resolvedNamed: dual(
      'Đã xác định: {eventTitle} · {ticketTypeLabel}. Điền biểu mẫu và đồng ý điều khoản trước khi đổi vé.',
      'Identified: {eventTitle} · {ticketTypeLabel}. Complete the form and accept the terms before redeeming.',
    ),
  },
  waitingFormTitle: dual('Đang tải biểu mẫu', 'Loading form'),
  waitingFormDetail: dual(
    'Chờ biểu mẫu và điều khoản sự kiện tải xong, rồi đồng ý điều khoản trước khi đổi vé.',
    'Wait for the event form and terms to load, then accept the terms before redeeming.',
  ),
  ticketsLoadedTitle: dual('Vé của bạn', 'Your tickets'),
  ticketsLoadedDetail: dual(
    'Có {count} vé trong tổ chức đã chọn.',
    '{count} tickets in the selected organization.',
  ),
  ownerNotFound: dual(
    'Không tìm thấy yêu cầu (owner scope).',
    'Request not found (owner scope).',
  ),
  ownerUnread: dual(
    'Không đọc được trạng thái hiện tại.',
    'Could not read the current status.',
  ),
  schemaTitleLoading: dual('Đang tải biểu mẫu…', 'Loading form…'),
  schemaTitleReady: dual('Biểu mẫu sẵn sàng', 'Form ready'),
  schemaTitleStatus: dual('Trạng thái biểu mẫu', 'Form status'),
  schemaTitleResolving: dual('Đang tra mã…', 'Looking up code…'),
  schemaTitleResolved: dual('Đã xác định sự kiện', 'Event identified'),
  schemaTitleResolveStatus: dual('Trạng thái tra mã', 'Lookup status'),
} as const;

export type SchemaNoticeKey = keyof typeof REDEEM_FORM_COPY_CATALOG.schema;

export function redeemFormCopy(locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE) {
  return localizeCatalog(REDEEM_FORM_COPY_CATALOG, locale);
}

export function schemaNoticeKind(
  key: SchemaNoticeKey,
): 'loading' | 'error' | 'empty' {
  if (key === 'loadingForm' || key === 'resolvingCode' || key === 'staleReloading') {
    return 'loading';
  }
  if (
    key === 'eventNotFound' ||
    key === 'formUnreachable' ||
    key === 'formInvalid'
  ) {
    return 'error';
  }
  return 'empty';
}

export function schemaNoticeChrome(
  key: SchemaNoticeKey,
  copy: ReturnType<typeof redeemFormCopy>,
  surface: 'published' | 'global',
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
  vars?: Record<string, string>,
): { kind: 'loading' | 'error' | 'empty'; title: string; detail: string } {
  const kind = schemaNoticeKind(key);
  const template = REDEEM_FORM_COPY_CATALOG.schema[key];
  const detail = vars
    ? formatDual(template, locale, vars)
    : copy.schema[key];
  if (surface === 'global') {
    const title =
      key === 'resolvingCode' ||
      key === 'loadingForm' ||
      key === 'staleReloading'
        ? copy.schemaTitleResolving
        : key === 'loadedForm' ||
            key === 'loadedFormNoTenant' ||
            key === 'resolvedNamed'
          ? copy.schemaTitleResolved
          : copy.schemaTitleResolveStatus;
    return { kind, title, detail };
  }
  const title =
    key === 'loadingForm' ||
    key === 'staleReloading' ||
    key === 'resolvingCode'
      ? copy.schemaTitleLoading
      : key === 'loadedForm' || key === 'loadedFormNoTenant'
        ? copy.schemaTitleReady
        : copy.schemaTitleStatus;
  return { kind, title, detail };
}
