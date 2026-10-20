'use client';

import type { MenuDataItem } from '@ant-design/pro-components';
import { Button } from 'antd';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import { isStaffPortalTenant } from '../onboarding';
import {
  buildEventMenuItems,
  buildOrgMenuItems,
  tenantHasAnalytics,
  type PortalShellCapabilities,
} from '../nav/capabilities';
import {
  loadShellContext,
  type ShellLoadState,
} from '../nav/load-shell-context';
import { PortalProLayout } from './portal-pro-layout';
import { SurfaceState } from './surface-state';
import { usePortalLocale } from '../i18n';

function tenantFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/t\/([^/]+)/);
  return m?.[1] ?? null;
}

function eventFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/t\/[^/]+\/e\/([^/]+)/);
  return m?.[1] ?? null;
}

/** Entry routes that should start staff OIDC immediately when discovery is unauthenticated. */
function staffLoginUrlForPath(pathname: string): string | null {
  if (pathname === '/') return '/api/auth/login?return=/';
  if (pathname === '/onboarding') return '/api/auth/login?return=/onboarding';
  if (pathname.startsWith('/onboarding/')) {
    return `/api/auth/login?return=${encodeURIComponent(pathname)}`;
  }
  return null;
}

export function PortalShell({
  children,
  productOrigin,
}: {
  children: ReactNode;
  productOrigin: string;
}) {
  const { t } = usePortalLocale();
  const pathname = usePathname();
  const [shell, setShell] = useState<ShellLoadState>({ status: 'loading' });

  const pathTenantId = tenantFromPath(pathname);
  const pathEventId = eventFromPath(pathname);
  const [selectedTenantId] = useState<string | null>(pathTenantId);
  const [selectedEventId] = useState<string | null>(pathEventId);

  // Keep switcher selection aligned with the URL without an effect round-trip.
  const effectiveTenantId = pathTenantId ?? selectedTenantId;
  const effectiveEventId = pathEventId ?? selectedEventId;

  const reload = useCallback(() => {
    setShell({ status: 'loading' });
    void loadShellContext().then(setShell);
  }, []);

  useEffect(() => {
    void loadShellContext().then(setShell);
  }, []);

  const staffLoginUrl =
    shell.status === 'unauthenticated' ? staffLoginUrlForPath(pathname) : null;

  useEffect(() => {
    if (!staffLoginUrl) return;
    window.location.replace(staffLoginUrl);
  }, [staffLoginUrl]);

  const ready = shell.status === 'ready' ? shell : null;
  const caps: PortalShellCapabilities | null = ready?.caps ?? null;

  const discoveredTenants: MeTenantItem[] = useMemo(
    () => ready?.meTenants?.items ?? [],
    [ready],
  );
  const tenants: MeTenantItem[] = useMemo(
    () => discoveredTenants.filter(isStaffPortalTenant),
    [discoveredTenants],
  );
  const attendeeOnly =
    shell.status === 'ready' &&
    caps?.staffEligible !== true &&
    caps?.showPlatform !== true &&
    tenants.length === 0 &&
    discoveredTenants.some((tenant) => tenant.role === 'Attendee');
  const events: MeEventItem[] = useMemo(
    () => ready?.meEvents?.items ?? [],
    [ready],
  );

  const resolvedTenantId =
    effectiveTenantId ??
    (tenants.length === 1 ? tenants[0]!.tenantId : null);

  const activeTenant =
    tenants.find((tenant) => tenant.tenantId === resolvedTenantId) ?? null;
  const tenantEvents = useMemo(
    () => events.filter((e) => e.tenantId === resolvedTenantId),
    [events, resolvedTenantId],
  );
  const activeEvent =
    tenantEvents.find((e) => e.eventId === effectiveEventId) ?? null;

  const orgMenu = useMemo(() => {
    if (!resolvedTenantId || !activeTenant) return [];
    return buildOrgMenuItems(resolvedTenantId, activeTenant, events, t);
  }, [resolvedTenantId, activeTenant, events, t]);

  const showAnalyticsNav = Boolean(
    resolvedTenantId && tenantHasAnalytics(resolvedTenantId, events),
  );

  const activeEventId = activeEvent?.eventId ?? null;
  const activeEventPermKey = activeEvent?.permissions.join('\0') ?? '';
  const eventMenu = useMemo(() => {
    if (!resolvedTenantId || !activeEventId) return [];
    const permissions = activeEventPermKey
      ? activeEventPermKey.split('\0')
      : [];
    return buildEventMenuItems(resolvedTenantId, activeEventId, permissions, t);
  }, [resolvedTenantId, activeEventId, activeEventPermKey, t]);

  const menuData = useMemo((): MenuDataItem[] => {
    const items: MenuDataItem[] = [];
    if (orgMenu.length > 0) {
      items.push({
        key: 'nav-org',
        name: t('nav.group.org'),
        children: orgMenu.map((item) => ({
          key: item.href,
          path: item.href,
          name: item.label,
        })),
      });
    }
    const run = eventMenu.filter((item) => item.group === 'run');
    const setup = eventMenu.filter((item) => item.group === 'setup');
    if (run.length > 0 && activeEvent) {
      items.push({
        key: 'nav-event-run',
        name: activeEvent.name,
        children: run.map((item) => ({
          key: item.href,
          path: item.href,
          name: item.label,
        })),
      });
    }
    if (setup.length > 0) {
      items.push({
        key: 'nav-event-setup',
        name: t('nav.group.eventSetup'),
        children: setup.map((item) => ({
          key: item.href,
          path: item.href,
          name: item.label,
        })),
      });
    }
    if (caps?.showPlatform) {
      items.push({
        key: 'nav-platform',
        name: t('nav.group.platform'),
        children: [
          {
            key: '/platform',
            path: '/platform',
            name: 'Platform',
          },
        ],
      });
    }
    return items;
  }, [orgMenu, eventMenu, activeEvent, caps?.showPlatform, t]);

  const showSider = Boolean(
    caps?.showOrgChrome || caps?.showPlatform || showAnalyticsNav,
  );

  if (pathname.startsWith('/auth')) {
    return <>{children}</>;
  }

  if (shell.status === 'loading') {
    return <SurfaceState kind="loading" />;
  }

  if (shell.status === 'unauthenticated') {
    if (staffLoginUrl) {
      return <SurfaceState kind="loading" />;
    }
    return (
      <SurfaceState
        kind="permission-denied"
        title={t('shell.auth.requiredTitle')}
        description={t('shell.auth.staffDescription')}
        onRetry={() => {
          window.location.assign('/api/auth/login?return=/');
        }}
      />
    );
  }

  if (shell.status === 'error') {
    return (
      <SurfaceState
        kind="unknown"
        description={t(shell.messageKey)}
        onRetry={reload}
      />
    );
  }

  if (attendeeOnly) {
    return (
      <SurfaceState
        kind="permission-denied"
        title={t('shell.auth.attendeeDeniedTitle')}
        description={t('shell.auth.attendeeDeniedBody')}
        emptyAction={
          <Button type="primary" href={productOrigin}>
            {t('shell.auth.openCustomerApp')}
          </Button>
        }
      />
    );
  }

  return (
    <PortalProLayout
      productOrigin={productOrigin}
      menuData={menuData}
      showSider={showSider}
      caps={caps}
      tenants={tenants}
      tenantEvents={tenantEvents}
      resolvedTenantId={resolvedTenantId}
      effectiveEventId={effectiveEventId}
      activeTenant={activeTenant}
    >
      {children}
    </PortalProLayout>
  );
}
