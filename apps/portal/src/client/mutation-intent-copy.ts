import type { PendingIntent } from './mutation-intent';

export function mutationIntentAlertCopy(
  state: PendingIntent['state'],
  needsReconciliation: boolean,
): { message: string; description: string } {
  if (state === 'conflict') {
    return {
      message: 'Idempotency key không còn hợp lệ',
      description: 'Key đã hết hiệu lực hoặc payload không khớp. Dừng thử lại và đối soát trạng thái tài nguyên.',
    };
  }
  if (state === 'accepted') {
    return {
      message: 'Yêu cầu đã được tiếp nhận, chờ kết quả cuối',
      description: 'HTTP 202 chỉ xác nhận đã nhận yêu cầu. Kiểm tra trạng thái job hoặc tài nguyên; chưa thể báo thành công.',
    };
  }
  return {
    message: 'Kết quả thao tác chưa xác định',
    description: needsReconciliation
      ? 'Phiên trước có thao tác chưa rõ kết quả. Kiểm tra trạng thái tài nguyên trước khi tiếp tục; danh sách không chứng minh riêng thao tác đã thành công.'
      : 'Có thể thao tác đã được ghi nhận. Thử lại cùng nút sẽ dùng cùng key và dữ liệu; nếu sửa dữ liệu, hãy kiểm tra trước khi tạo ý định mới.',
  };
}
