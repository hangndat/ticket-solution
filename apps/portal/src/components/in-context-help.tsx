'use client';

import { Alert } from 'antd';
import { usePortalLocale } from '../i18n';
import type { MessageKey } from '../i18n/messages';

export function InContextHelp({
  messageKey,
  testId,
}: {
  messageKey: MessageKey;
  testId?: string;
}) {
  const { t } = usePortalLocale();
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
      data-testid={testId ?? 'in-context-help'}
      message={t(messageKey)}
    />
  );
}
