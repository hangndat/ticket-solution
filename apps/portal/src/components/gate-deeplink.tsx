'use client';

import { Typography } from 'antd';
import { usePortalLocale } from '../i18n';

/** D-6: staff scan only on Vemoki iOS app — portal never mounts scanner or links to web /gate. */
export function GateIosScanHint() {
  const { t } = usePortalLocale();
  return (
    <Typography.Text type="secondary" data-testid="gate-ios-scan-hint">
      {t('gateDeeplink.h_iosHint')}
    </Typography.Text>
  );
}

export function GateStayAppNotice() {
  const { t } = usePortalLocale();
  return (
    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
      {t('gateDeeplink.h_9xk8eh_2')}
    </Typography.Paragraph>
  );
}
