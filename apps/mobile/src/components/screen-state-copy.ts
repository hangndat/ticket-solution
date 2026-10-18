/**
 * Vietnamese copy for shared empty / loading / error panels on ví, scan, events.
 * Keep user-facing strings here so unit tests can assert without RN renderer.
 * Aligned to PD UX-UI revamp AC (docs/design/ux-ui-revamp).
 */

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
  signInErrorTitle: 'Không đăng nhập được',
  signInLoading: {
    title: 'Đang đăng nhập',
    body: 'Chờ xác minh đăng nhập — chưa mở ví.',
  },
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
} as const;

export const eventsCopy = {
  loadingList: {
    title: 'Đang tải sự kiện…',
    body: 'Đang tải danh sách đã xuất bản từ máy chủ.',
  },
  emptyPublished: {
    title: 'Chưa có sự kiện đang mở',
    body: 'Chưa có sự kiện công khai lúc này. Không thay bằng dữ liệu demo.',
  },
  emptyDemo: {
    title: 'Không có sự kiện demo',
    body: 'Tổ chức này chưa có sự kiện mẫu.',
  },
  errorList: {
    title: 'Không tải được danh sách',
  },
  loadingDetail: {
    title: 'Đang tải sự kiện…',
    body: 'Đang tải nội dung đã xuất bản…',
  },
  errorDetail: {
    title: 'Không tải được nội dung sự kiện',
  },
  heroHeadline: 'Sự kiện đang mở',
  heroSupport: 'Chọn sự kiện hoặc đổi mã để nhận vé vào ví.',
  redeemCta: 'Đổi mã lấy vé',
  signInCta: 'Đăng nhập',
} as const;

export const redeemCopy = {
  offlineTitle: 'Không có mạng',
  offlineBody: 'Không có mạng — thử lại khi có kết nối.',
  authCancelTitle: 'Không đăng nhập được',
  emptyTitle: 'Chọn sự kiện hoặc thử lại',
} as const;
