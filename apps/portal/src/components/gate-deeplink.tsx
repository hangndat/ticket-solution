'use client';

import { Button, Typography } from 'antd';
import { usePortalLocale } from '../i18n';

/** Launch UAT / Epic #1008: contingency web gate deeplink on app host. */
export function GateDeeplinkButton(props: {
  href: string;
  label?: string;
}) {
  const { t } = usePortalLocale();
  return (
    <Button
      type="default"
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="gate-deeplink"
    >
      {props.label ?? t('gateDeeplink.h_4pqjik')}
    </Button>
  );
}

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
