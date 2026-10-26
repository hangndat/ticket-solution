'use client';

import { Alert, Button, Modal, Space } from 'antd';
import type { PendingIntent } from './mutation-intent';
import { mutationIntentAlertCopy } from './mutation-intent-copy';
import styles from './mutation-intent-alert.module.css';

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
  const copy = mutationIntentAlertCopy(pending.state, needsReconciliation);
  return (
    <Alert
      className={styles.intentAlert}
      type={conflict ? 'error' : 'warning'}
      showIcon
      role="status"
      message={copy.message}
      description={copy.description}
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
