'use client';

import { Button, Card, Descriptions, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { loadShellContext } from '../../../src/nav/load-shell-context';
import { SurfaceState } from '../../../src/components/surface-state';
import { usePortalLocale, type MessageKey } from '../../../src/i18n';

export default function AccountSecurityPage() {
  const { t } = usePortalLocale();
  const [kind, setKind] = useState<'loading' | 'ready' | 'error'>('loading');
  const [staffOk, setStaffOk] = useState(false);
  const [platformOk, setPlatformOk] = useState(false);
  const [messageKey, setMessageKey] = useState<MessageKey | undefined>();

  useEffect(() => {
    void loadShellContext().then((shell) => {
      if (shell.status === 'unauthenticated') {
        window.location.href = '/api/auth/login?return=/account/security';
        return;
      }
      if (shell.status === 'error') {
        setKind('error');
        setMessageKey(shell.messageKey);
        return;
      }
      if (shell.status !== 'ready') return;
      setStaffOk(shell.meTenants !== null || shell.meEvents !== null);
      setPlatformOk(shell.platformMe?.operator === true);
      setKind('ready');
    });
  }, []);

  if (kind === 'loading') return <SurfaceState kind="loading" />;
  if (kind === 'error') {
    return (
      <SurfaceState
        kind="error"
        description={messageKey ? t(messageKey) : undefined}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <Card>
      <Typography.Title level={3} style={{ marginTop: 0 }}>{t('shell.account.security')}</Typography.Title>
      <Typography.Paragraph type="secondary">{t('account.h_19guouj')}</Typography.Paragraph>
      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label={t('account.h_ya8g97')}>
          {staffOk ? t('account.h_1a6mmbo') : t('account.h_1cuqgz1')}
        </Descriptions.Item>
        <Descriptions.Item label={t('account.h_17x4t4d')}>
          {platformOk ? t('account.h_1med0c4') : t('account.h_j89qdq')}
        </Descriptions.Item>
        <Descriptions.Item label="Cookie">
          {t('account.cookieAttrs')}
        </Descriptions.Item>
      </Descriptions>
      <Space style={{ marginTop: 24 }} wrap>
        <Button danger href="/api/auth/logout" data-testid="logout-staff">{t('account.h_11eq8uu')}</Button>
        <Button href="/api/auth/platform/logout" data-testid="logout-platform">{t('account.h_21w6fq')}</Button>
      </Space>
    </Card>
  );
}
