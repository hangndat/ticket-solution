'use client';

import { Alert, Button, Card, Result, Space, Typography } from 'antd';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PortalAuthTemplate } from '../../src/components/portal-auth-template';
import { SurfaceState } from '../../src/components/surface-state';
import { usePortalLocale, type MessageKey } from '../../src/i18n';
import { PortalBrandMark } from '../../src/components/portal-brand-lockup';

const ERROR_COPY_KEYS: Record<string, MessageKey> = {
  misconfigured: 'auth.h_1l6yc4c',
  invalid_state: 'auth.h_1tfddzd',
  token_exchange: 'auth.h_179sno0',
  access_denied: 'auth.error.accessDenied',
  not_allowed: 'auth.error.notAllowed',
};

function AuthInner() {
  const { t } = usePortalLocale();
  const params = useSearchParams();
  const error = params.get('error');

  if (error) {
    return (
      <PortalAuthTemplate>
        <Result
          status="error"
          title={t('auth.h_85v7iu')}
          subTitle={
            ERROR_COPY_KEYS[error]
              ? t(ERROR_COPY_KEYS[error])
              : t('auth.error.generic', { error })
          }
          extra={
            <Button type="primary" href="/api/auth/login?return=/">
              {t('auth.h_18eyu7o')}
            </Button>
          }
        />
      </PortalAuthTemplate>
    );
  }

  return (
    <PortalAuthTemplate>
      <Card>
        <Typography.Title
          level={2}
          style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <PortalBrandMark />
          Vemoki Portal
        </Typography.Title>
        <Typography.Paragraph>{t('auth.h_1dyukbi')}</Typography.Paragraph>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('auth.h_w7m30b')}
        />
        <Space>
          <Button type="primary" size="large" href="/api/auth/login?return=/">
            {t('auth.h_1g2rg2o')}
          </Button>
        </Space>
      </Card>
    </PortalAuthTemplate>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<SurfaceState kind="loading" />}>
      <AuthInner />
    </Suspense>
  );
}
