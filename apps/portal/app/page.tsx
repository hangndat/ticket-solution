'use client';

import { Alert, Button, Card, Flex, Result, Spin, Typography } from 'antd';
import Link from 'next/link';
import { useEffect } from 'react';
import { useActorState as useState } from '../src/client/use-actor-state';
import { loadShellContext } from '../src/nav/load-shell-context';
import { usePortalLocale, type MessageKey } from '../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../src/prep/surface-copy';
import { resolveOnboardingSurface } from '../src/onboarding';
import { resolveHomeEntry } from '../src/nav/home-entry';
import { usePortalUserId } from '../src/views/use-portal-user-id';

function redirectFromHome(path: string) {
  window.location.replace(path);
}

/**
 * Home: redirect to PENDING wait / first-run / first tenant; else empty + signup CTA.
 */
export default function PortalHomePage() {
  const { t } = usePortalLocale();
  const identity = usePortalUserId();
  const [state, setState] = useState<
    'loading' | 'empty' | 'error' | 'redirecting' | 'customer'
  >('loading');
  const [messageKey, setMessageKey] = useState<MessageKey | undefined>();

  const identityUserId = identity.status === 'ready' ? identity.userId : null;

  useEffect(() => {
    if (identity.status === 'loading') {
      return;
    }
    if (identity.status === 'unauthenticated') {
      redirectFromHome('/api/auth/login?return=/');
      return;
    }

    let cancelled = false;
    void loadShellContext().then((shell) => {
      if (cancelled) return;
      if (shell.status === 'unauthenticated') {
        redirectFromHome('/api/auth/login?return=/');
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
      const surface = resolveOnboardingSurface({
        tenants: shell.meTenants?.items,
        userId: identityUserId,
        eventCountForTenant: (tenantId) =>
          shell.meEvents?.items.filter((e) => e.tenantId === tenantId).length ??
          0,
      });
      if (surface.kind === 'customer') {
        setState('customer');
        return;
      }
      if (surface.kind === 'signup') {
        setState('empty');
        return;
      }
      setState('redirecting');
      const destination = resolveHomeEntry(
        surface,
        shell.meTenants?.items ?? [],
        shell.meEvents?.items ?? [],
      );
      if (destination) {
        redirectFromHome(destination);
      } else {
        setState('empty');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [identity.status, identityUserId]);

  if (state === 'loading' || state === 'redirecting') {
    return (
    <Flex
      vertical
      align="center"
      gap="middle"
      role="status"
      aria-busy="true"
      aria-label={t(SURFACE_MESSAGE_KEYS.loading)}
      suppressHydrationWarning
      style={{ padding: 48 }}
    >
      <Spin size="large" />
      <span>{t(SURFACE_MESSAGE_KEYS.loading)}</span>
    </Flex>
  );
  }
  if (state === 'customer') {
    return (
      <Result status="403" title={t('shell.auth.attendeeDeniedTitle')} subTitle={t('shell.auth.attendeeDeniedBody')} />
    );
  }
  if (state === 'error') {
    return (
      <Alert
        type="warning"
        showIcon
        message={t(SURFACE_MESSAGE_KEYS.unknownTitle)}
        description={messageKey ? t(messageKey) : undefined}
        action={
          <Button size="small" onClick={() => window.location.reload()}>
            {t(SURFACE_MESSAGE_KEYS.recheck)}
          </Button>
        }
        style={{ margin: 24 }}
      />
    );
  }

  return (
    <Card>
      <Typography.Title level={3}>{t('shell.tenant.empty')}</Typography.Title>
      <Typography.Paragraph>{t('home.noOrgBody')}</Typography.Paragraph>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link prefetch={false} href="/onboarding">
          <Button type="primary">{t('home.startOnboarding')}</Button>
        </Link>
        <Link prefetch={false} href="/account/security">
          <Button>{t('home.h_cb3p8s')}</Button>
        </Link>
      </div>
    </Card>
  );
}
