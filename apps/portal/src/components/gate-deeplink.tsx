'use client';

import { Button, Typography } from 'antd';
import { usePortalLocale } from '../i18n';

/**
 * GATE-STAY-APP: portal never mounts scanner — only deep-link to app./gate.
 */
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

export function GateStayAppNotice() {
  const { t } = usePortalLocale();
  return (
    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>{t('gateDeeplink.h_9xk8eh_2')}</Typography.Paragraph>
  );
}
