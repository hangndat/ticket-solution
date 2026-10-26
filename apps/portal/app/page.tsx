'use client';

import { Button, Card, Typography } from 'antd';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { loadShellContext } from '../src/nav/load-shell-context';
import { SurfaceState } from '../src/components/surface-state';
import { usePortalLocale, type MessageKey } from '../src/i18n';
import {
  isStaffPortalTenant,
  resolveOnboardingSurface,
} from '../src/onboarding';
import { firstAllowedTenantPath } from '../src/nav/capability-policy';
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
      const events = shell.meEvents?.items ?? [];
      const allowedDestination = [
        surface.tenant,
        ...(shell.meTenants?.items ?? []).filter(
          (tenant) =>
            isStaffPortalTenant(tenant) &&
            tenant.tenantId !== surface.tenant.tenantId,
        ),
      ]
        .map((tenant) => firstAllowedTenantPath(tenant, events))
        .find((path) => path !== null);
      if (
        surface.kind === 'pending-activation' ||
        surface.kind === 'first-run'
      ) {
        if (
          surface.kind === 'first-run' &&
          surface.tenant.tenantPermissions.length === 0
        ) {
          if (allowedDestination) {
            redirectFromHome(allowedDestination);
            return;
          }
          setState('empty');
          return;
        }
        redirectFromHome(`/onboarding/${surface.tenant.tenantId}`);
        return;
      }
      if (allowedDestination) {
        redirectFromHome(allowedDestination);
      } else {
        setState('empty');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [identity.status, identityUserId]);

  if (state === 'loading' || state === 'redirecting') {
    return <SurfaceState kind="loading" />;
  }
  if (state === 'customer') {
    return (
      <SurfaceState
        kind="permission-denied"
        title={t('shell.auth.attendeeDeniedTitle')}
        description={t('shell.auth.attendeeDeniedBody')}
      />
    );
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href="/onboarding">
          <Button type="primary">{t('home.startOnboarding')}</Button>
        </Link>
        <Link href="/account/security">
          <Button>{t('home.h_cb3p8s')}</Button>
        </Link>
      </div>
    </Card>
  );
}
