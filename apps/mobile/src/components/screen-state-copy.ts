/**
 * Vietnamese copy for shared empty / loading / error panels on ví, scan, events.
 * Keep user-facing strings here so unit tests can assert without RN renderer.
 * Aligned to PD UX-UI revamp AC (docs/design/ux-ui-revamp).
 */

const walletCopyFirstTicketPush = {
  title: 'Nhận nhắc về vé và sự kiện?',
  body: 'Bật thông báo để nhận nhắc khi có thay đổi quan trọng. Bạn có thể tắt trong Cài đặt iPhone.',
  enableCta: 'Bật thông báo',
  dismissCta: 'Để sau',
} as const;

export const walletCopy = {
  loading: {
    title: 'Đang tải vé…',
    body: 'Đang đồng bộ ví từ máy chủ. Chưa xác nhận danh sách trống.',
  },
  emptyOnline: {
    title: 'Chưa có vé trong ví',
    body: 'Đổi mã bằng cùng tài khoản đã đăng nhập, rồi kéo để làm mới. Danh sách trống nghĩa là chưa có vé — không phải ví giả.',
  },
  emptyOffline: {
    title: 'Chưa có vé trong bộ đệm',
    body: 'Đăng nhập khi có mạng rồi kéo để làm mới nhằm lưu vé xem offline.',
  },
  errorTitle: 'Không tải được vé',
  detailMissingTitle: 'Không tìm thấy vé',
  detailMissingBody:
    'Không có vé khớp id này cho danh tính hiện tại. Kéo để làm mới Vé của tôi khi online.',
  detailProbeErrorTitle: 'Không tải được vé',
  detailProbeErrorBody:
    'Không kiểm tra được vé trên máy chủ. Thử lại khi có mạng — đây chưa phải vé thiếu.',
  signInErrorTitle: 'Không đăng nhập được',
  signInLoading: {
    title: 'Đang đăng nhập',
    body: 'Chờ xác minh đăng nhập — chưa mở ví.',
  },
  guestWalletBlockedTitle: 'Vé của tôi cần đăng nhập',
  guestWalletBlockedBody:
    'Mở tab Tài khoản để đăng nhập. Sau khi xác minh, vé sẽ hiện ở đây.',
  firstTicketPush: walletCopyFirstTicketPush,
} as const;

export const scanCopy = {
  loadingStore: {
    title: 'Đang mở quét cổng',
    body: 'Khôi phục thao tác đã lưu. Chưa cho vào.',
  },
  idle: {
    title: 'Chờ mã quét',
    body: 'Quét QR trên vé hoặc dán mã. Chỉ cho vào sau khi hệ thống (API) ghi nhận check-in.',
  },
  checking: {
    title: 'Đang kiểm tra',
    body: 'Đợi phản hồi. Không cho vào khi chưa có kết quả.',
  },
  contextHint: {
    title: 'Ngữ cảnh cổng',
    body: 'Sự kiện · phiên staff · trạng thái mạng. ID nội bộ chỉ để đối chiếu.',
  },
  eventPicker: {
    title: 'Sự kiện cổng',
    loading: 'Đang tải sự kiện…',
    empty:
      'Chưa có quyền cổng cho sự kiện nào. Liên hệ quản trị sự kiện.',
    error: 'Không tải được danh sách sự kiện. Thử lại khi có mạng.',
    sessionExpired: 'Phiên đăng nhập đã hết hạn. Đăng nhập lại.',
    invalidResponse: 'Không đọc được danh sách sự kiện. Thử lại sau.',
    switchHint: 'Đổi sự kiện đóng phiên cổng — quét online một lần để mở phiên mới.',
  },
} as const;

export const eventsCopy = {
  loadingList: {
    title: 'Đang tải sự kiện…',
    body: 'Đang tải danh sách đã xuất bản từ máy chủ.',
  },
  emptyPublished: {
    title: 'Chưa có sự kiện đang mở',
    body: 'Chưa có sự kiện công khai lúc này.',
  },
  errorList: {
    title: 'Không tải được danh sách',
  },
  misconfiguredTitle: 'Chưa sẵn sàng tải sự kiện',
  misconfiguredBody:
    'Không thể mở danh sách sự kiện công khai — thử lại sau hoặc kiểm tra kết nối.',
  loadingDetail: {
    title: 'Đang tải sự kiện…',
    body: 'Đang tải nội dung đã xuất bản…',
  },
  errorDetail: {
    title: 'Không tải được nội dung sự kiện',
  },
  detail: {
    aboutTitle: 'Giới thiệu',
    guideTitle: 'Hướng dẫn',
    faqTitle: 'Câu hỏi thường gặp',
    termsTitle: 'Điều khoản',
    organizerLabel: 'Đơn vị tổ chức',
    contactLabel: 'Liên hệ',
    seeMore: 'Xem thêm',
    seeLess: 'Thu gọn',
    redeemHintFallback: 'Có mã nhận vé? Đổi mã để thêm vé vào ví.',
    fixtureNote: 'Dữ liệu mẫu — không đăng ký vé từ sự kiện demo.',
  },
  heroHeadline: 'Sự kiện đang mở',
  heroSupport: 'Chọn sự kiện hoặc đổi mã để nhận vé vào ví.',
  searchPlaceholder: '⌕ Tìm tên sự kiện',
  searchAccessibilityLabel: 'Tìm tên sự kiện',
  listHeadline: 'Sự kiện',
  publishedStatusPill: 'Sắp diễn ra',
  redeemCta: 'Đổi mã',
  signInCta: 'Đăng nhập',
  accountCta: 'Tài khoản',
  goToAccountSignInCta: 'Đến tài khoản để đăng nhập',
  goToAccountCta: 'Mở tài khoản',
} as const;

export const accountCopy = {
  screenTitle: 'Tài khoản',
  staffBackToGate: 'Quay lại quét',
  signInCancelHint:
    'Đã hủy đăng nhập — bạn vẫn ở Tài khoản. Thử lại hoặc quay lại màn trước.',
  sections: {
    you: 'Bạn',
    notifications: 'Thông báo',
    privacy: 'Quyền riêng tư & dữ liệu',
  },
  guest: {
    title: 'Chưa đăng nhập',
    body: 'Đăng nhập để xem vé trên thiết bị này.',
    signInCta: 'Đăng nhập',
  },
  verified: {
    body: 'Tài khoản đang dùng trên máy.',
  },
  offlineCache: {
    body: 'Bản vé đã lưu trên thiết bị — trạng thái có thể chưa cập nhật.',
    clearRow: 'Xóa dữ liệu xem offline',
  },
  push: {
    guestHint: 'Đăng nhập để bật nhắc vé và sự kiện',
    busySaving: 'Đang lưu thiết bị…',
  },
  privacyRow: 'Chính sách quyền riêng tư',
  deleteAccountRow: 'Xóa tài khoản',
  logoutCta: 'Đăng xuất',
  logoutAccessibility: 'Đăng xuất, nút, hành động nguy hiểm',
  misconfiguredTitle: 'Chưa sẵn sàng đăng nhập',
  misconfiguredBody:
    'Bản dựng này chưa bật đăng nhập. Bạn vẫn có thể xem sự kiện công khai.',
  meErrorTitle: 'Không tải được hồ sơ',
  meProbe: {
    unauthorized: 'Phiên đăng nhập đã hết hạn. Đăng nhập lại.',
    unreachable: 'Mất kết nối mạng. Kiểm tra mạng rồi thử lại.',
    invalid: 'Không tải được hồ sơ tài khoản. Thử lại sau.',
    wrongUser:
      'Không tải được hồ sơ tài khoản. Kiểm tra kết nối rồi thử lại.',
  },
  busyLabel: 'Đang xử lý…',
} as const;

export const redeemCopy = {
  offlineTitle: 'Không có mạng',
  offlineBody: 'Không có mạng — thử lại khi có kết nối.',
  authCancelTitle: 'Không đăng nhập được',
  emptyTitle: 'Chọn sự kiện hoặc thử lại',
  authRequiredBody:
    'Cần đăng nhập để tiếp tục đổi mã.',
  authGateCta: 'Tiếp tục đăng nhập',
  screenTitle: 'Đổi mã',
  globalGuestTitle: 'Đăng nhập khi xác nhận',
  globalGuestBody:
    'Nhập hoặc dán mã trước. Đăng nhập khi tìm vé hoặc xác nhận để nhận vé vào ví.',
  codeFieldLabel: 'Mã nhận vé',
  codeFieldPlaceholder: 'Nhập hoặc dán mã',
  lookupCta: 'Tìm vé',
  lookupAgainCta: 'Tìm lại',
  confirmCta: 'Xác nhận đổi mã',
  walletCta: 'Xem vé',
  formSectionTitle: 'Thông tin bắt buộc',
  formVersionPrefix: 'Phiên bản biểu mẫu',
  formServerValidates: 'Máy chủ vẫn kiểm tra câu trả lời.',
  termsTitle: 'Điều khoản',
  termsVersionPrefix: 'Phiên bản',
  requiredSuffix: '(bắt buộc)',
  eventDetailRedeemBlockTitle: 'Bạn có mã nhận vé?',
} as const;
