'use client';

import { Button, Card, Typography } from 'antd';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadShellContext } from '../src/nav/load-shell-context';
import { SurfaceState } from '../src/components/surface-state';
import { usePortalLocale, type MessageKey } from '../src/i18n';

/**
 * Home: redirect to first tenant when discovery returns one; else empty org.
 */
export default function PortalHomePage() {
  const { t } = usePortalLocale();
  const router = useRouter();
  const [state, setState] = useState<
    'loading' | 'empty' | 'error' | 'redirecting'
  >('loading');
  const [messageKey, setMessageKey] = useState<MessageKey | undefined>();

  useEffect(() => {
    let cancelled = false;
    void loadShellContext().then((shell) => {
      if (cancelled) return;
      if (shell.status === 'unauthenticated') {
        window.location.href = '/api/auth/login?return=/';
        return;
      }
      if (shell.status === 'error') {
        setState('error');
        setMessageKey(shell.messageKey);
        return;
      }
      if (shell.status !== 'ready') {
        setState('loading');
        return;
      }
      const first = shell.meTenants?.items[0];
      if (first) {
        setState('redirecting');
        router.replace(`/t/${first.tenantId}`);
        return;
      }
      setState('empty');
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === 'loading' || state === 'redirecting') {
    return <SurfaceState kind="loading" />;
  }
  if (state === 'error') {
    return (
      <SurfaceState
        kind="unknown"
        description={messageKey ? t(messageKey) : undefined}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <Card>
      <Typography.Title level={3}>{t('shell.tenant.empty')}</Typography.Title>
      <Typography.Paragraph>{t('home.noOrgBody')}</Typography.Paragraph>
      <Button type="primary">
        <Link href="/account/security">{t('home.h_cb3p8s')}</Link>
      </Button>
    </Card>
  );
}
