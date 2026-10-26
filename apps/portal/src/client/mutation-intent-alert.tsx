'use client';

import { Alert, Button, Modal, Space } from 'antd';
import type { PendingIntent } from './mutation-intent';

type Props = {
  pending: PendingIntent | null;
  needsReconciliation: boolean;
  onCheck: () => void;
  onStartNew: () => void;
};

/** The read-side check helps the operator reconcile; it never silently clears an unknown intent. */
export function MutationIntentAlert({ pending, needsReconciliation, onCheck, onStartNew }: Props) {
  if (!pending) return null;
  const conflict = pending.state === 'conflict';
  const accepted = pending.state === 'accepted';
  return (
    <Alert
      type={conflict ? 'error' : 'warning'}
      showIcon
      role="status"
      message={conflict ? 'Idempotency key không còn hợp lệ' : accepted ? 'Yêu cầu đã được tiếp nhận, chờ kết quả cuối' : 'Kết quả thao tác chưa xác định'}
      description={needsReconciliation
        ? 'Phiên trước có thao tác chưa rõ kết quả. Kiểm tra trạng thái tài nguyên trước khi tiếp tục; danh sách không chứng minh riêng thao tác đã thành công.'
        : accepted
          ? 'HTTP 202 chỉ xác nhận đã nhận yêu cầu. Kiểm tra trạng thái job hoặc tài nguyên; chưa thể báo thành công.'
        : conflict
          ? 'Key đã hết hiệu lực hoặc payload không khớp. Dừng thử lại và đối soát trạng thái tài nguyên.'
          : 'Có thể thao tác đã được ghi nhận. Thử lại cùng nút sẽ dùng cùng key và dữ liệu; nếu sửa dữ liệu, hãy kiểm tra trước khi tạo ý định mới.'}
      action={
        <Space wrap>
          <Button size="small" onClick={onCheck}>Kiểm tra lại</Button>
          <Button size="small" danger onClick={() => Modal.confirm({
            title: 'Tạo ý định mới?',
            content: 'Thao tác trước có thể đã thành công. Hãy kiểm tra trạng thái trước; tiếp tục có nguy cơ tạo thao tác trùng.',
            okText: 'Tôi đã kiểm tra, tạo mới',
            cancelText: 'Quay lại',
            onOk: onStartNew,
          })}>Tạo ý định mới</Button>
        </Space>
      }
    />
  );
}
