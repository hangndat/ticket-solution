/**
 * Vietnamese copy for shared empty / loading / error panels on ví, scan, events.
 * Keep user-facing strings here so unit tests can assert without RN renderer.
 */

export const walletCopy = {
  loading: {
    title: 'Đang tải vé',
    body: 'Đang đồng bộ ví từ máy chủ. Chưa xác nhận danh sách trống.',
  },
  emptyOnline: {
    title: 'Chưa có vé',
    body: 'Đổi mã trên web bằng cùng tài khoản Keycloak, rồi kéo để làm mới. Danh sách trống nghĩa là API trả về không có vé — không phải ví giả.',
  },
  emptyOffline: {
    title: 'Chưa có vé trong bộ đệm',
    body: 'Đăng nhập online rồi kéo để làm mới nhằm đổ bộ đệm hiển thị offline.',
  },
  errorTitle: 'Không tải được ví',
  signInErrorTitle: 'Đăng nhập thất bại',
  signInLoading: {
    title: 'Đang đăng nhập',
    body: 'Chờ Keycloak xác minh — chưa mở ví.',
  },
} as const;

export const scanCopy = {
  loadingStore: {
    title: 'Đang mở quét cổng',
    body: 'Khôi phục thao tác đã lưu. Chưa cho vào.',
  },
  idle: {
    title: 'Chờ mã quét',
    body: 'Quét QR trên vé hoặc dán mã. Chỉ cho vào sau khi API ghi nhận check-in.',
  },
  checking: {
    title: 'Đang kiểm tra cổng',
    body: 'Đợi phản hồi API. Không cho vào khi chưa có kết quả.',
  },
} as const;

export const eventsCopy = {
  loadingList: {
    title: 'Đang tải sự kiện',
    body: 'Gọi danh sách đã xuất bản. Demo bên dưới vẫn chỉ là mẫu.',
  },
  emptyPublished: {
    title: 'Chưa có sự kiện đã xuất bản',
    body: 'API trả về danh sách trống cho tenant này.',
  },
  emptyDemo: {
    title: 'Không có sự kiện demo',
    body: 'Tổ chức này chưa có sự kiện mẫu.',
  },
  errorList: {
    title: 'Lỗi danh sách sự kiện',
  },
  loadingDetail: {
    title: 'Đang tải sự kiện',
    body: 'Đang tải nội dung đã xuất bản…',
  },
  errorDetail: {
    title: 'Lỗi nội dung đã xuất bản',
  },
} as const;
