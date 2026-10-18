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
    body: 'Đổi mã bằng cùng tài khoản đã đăng nhập, rồi kéo để làm mới. Danh sách trống nghĩa là chưa có vé — không phải ví giả.',
  },
  emptyOffline: {
    title: 'Chưa có vé trong bộ đệm',
    body: 'Đăng nhập khi có mạng rồi kéo để làm mới nhằm lưu vé xem offline.',
  },
  errorTitle: 'Không tải được ví',
  signInErrorTitle: 'Đăng nhập thất bại',
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
    title: 'Đang tải sự kiện',
    body: 'Đang tải danh sách đã xuất bản từ máy chủ.',
  },
  emptyPublished: {
    title: 'Chưa có sự kiện đã xuất bản',
    body: 'Tổ chức này chưa có sự kiện công khai. Không thay bằng dữ liệu demo.',
  },
  emptyDemo: {
    title: 'Không có sự kiện demo',
    body: 'Tổ chức này chưa có sự kiện mẫu.',
  },
  errorList: {
    title: 'Không tải được danh sách sự kiện',
  },
  loadingDetail: {
    title: 'Đang tải sự kiện',
    body: 'Đang tải nội dung đã xuất bản…',
  },
  errorDetail: {
    title: 'Không tải được nội dung sự kiện',
  },
} as const;
