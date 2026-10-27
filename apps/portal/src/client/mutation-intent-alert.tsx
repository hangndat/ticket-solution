'use client';

import { Alert, Button, Modal, Space } from 'antd';
import { usePortalLocale } from '../i18n';
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
  const { t, locale } = usePortalLocale();
  if (!pending) return null;
  const conflict = pending.state === 'conflict';
  const copy = mutationIntentAlertCopy(pending.state, needsReconciliation, locale);
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
          <Button size="small" onClick={onCheck}>{t('surface.action.recheck')}</Button>
          <Button size="small" danger onClick={() => Modal.confirm({
            title: t('intent.newTitle'),
            content: t('intent.newBody'),
            okText: t('intent.newOk'),
            cancelText: t('events.h_rft49v'),
            onOk: onStartNew,
          })}>{t('intent.new')}</Button>
        </Space>
      }
    />
  );
}
