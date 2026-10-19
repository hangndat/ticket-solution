'use client';

import {
  Breadcrumb,
  Button,
  Dropdown,
  Layout,
  Menu,
  Select,
  Space,
  Typography,
  theme,
} from 'antd';
import type { MenuProps } from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import { isStaffPortalTenant } from '../onboarding';
import { gateDeeplinkUrl } from '../oidc/config';
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
import { PortalDualRunBanner } from './dual-run-banner';
import { GateDeeplinkButton } from './gate-deeplink';
import { SurfaceState } from './surface-state';
import { usePortalLocale } from '../i18n';

const { Header, Sider, Content } = Layout;

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
  const { t, locale, setLocale } = usePortalLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const [shell, setShell] = useState<ShellLoadState>({ status: 'loading' });

  const pathTenantId = tenantFromPath(pathname);
  const pathEventId = eventFromPath(pathname);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(
    pathTenantId,
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    pathEventId,
  );

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

  const siderItems = useMemo(() => {
    const link = (href: string, label: string) => ({
      key: href,
      label: <Link href={href}>{label}</Link>,
    });
    const items: NonNullable<MenuProps['items']> = [];
    if (orgMenu.length > 0) {
      items.push({
        type: 'group',
        key: 'nav-org',
        label: t('nav.group.org'),
        children: orgMenu.map((item) => link(item.href, item.label)),
      });
    }
    const run = eventMenu.filter((item) => item.group === 'run');
    const setup = eventMenu.filter((item) => item.group === 'setup');
    if (run.length > 0 && activeEvent) {
      items.push({
        type: 'group',
        key: 'nav-event-run',
        label: activeEvent.name,
        children: run.map((item) => link(item.href, item.label)),
      });
    }
    if (setup.length > 0) {
      items.push({
        type: 'group',
        key: 'nav-event-setup',
        label: t('nav.group.eventSetup'),
        children: setup.map((item) => link(item.href, item.label)),
      });
    }
    if (caps?.showPlatform) {
      items.push({
        type: 'group',
        key: 'nav-platform',
        label: t('nav.group.platform'),
        children: [link('/platform', 'Platform')],
      });
    }
    return items;
  }, [orgMenu, eventMenu, activeEvent, caps?.showPlatform, t]);

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

  const accountMenu = {
    selectable: true,
    selectedKeys: [`locale-${locale}`],
    items: [
      {
        key: 'security',
        label: <Link href="/account/security">{t('shell.account.security')}</Link>,
      },
      {
        // PD PS3 / AC-C1: Language submenu under account ▾ (VI | EN).
        key: 'language',
        label: t('locale.label'),
        children: [
          {
            key: 'locale-vi',
            label: (
              <span data-testid="portal-locale-vi">
                {`${locale === 'vi' ? '✓ ' : ''}${t('locale.vi')}`}
              </span>
            ),
            onClick: () => setLocale('vi'),
          },
          {
            key: 'locale-en',
            label: (
              <span data-testid="portal-locale-en">
                {`${locale === 'en' ? '✓ ' : ''}${t('locale.en')}`}
              </span>
            ),
            onClick: () => setLocale('en'),
          },
        ],
      },
      {
        key: 'logout',
        label: t('shell.account.logout'),
        onClick: () => {
          window.location.assign('/api/auth/logout');
        },
      },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <a href="#portal-main" className="portal-skip-link">{t('shell.skipNav')}</a>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          paddingInline: 20,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Typography.Title
          level={4}
          style={{ margin: 0, whiteSpace: 'nowrap' }}
          data-testid="portal-brand"
        >
          <Link href="/" style={{ color: 'inherit' }}>
            Vemoki Portal
          </Link>
        </Typography.Title>

        <Space wrap size="middle" style={{ flex: 1 }}>
          <Select
            aria-label={t('shell.tenant.label')}
            placeholder={
              tenants.length === 0 ? t('shell.tenant.empty') : t('shell.tenant.placeholder')
            }
            style={{ minWidth: 200 }}
            value={resolvedTenantId ?? undefined}
            options={tenants.map((tenant) => ({
              value: tenant.tenantId,
              label: `${tenant.name} (${tenant.slug})`,
            }))}
            onChange={(value) => {
              setSelectedTenantId(value);
              setSelectedEventId(null);
              router.push(`/t/${value}`);
            }}
            disabled={tenants.length === 0}
            data-testid="tenant-switcher"
          />
          <Select
            aria-label={t('nav.org.events')}
            placeholder={
              !resolvedTenantId
                ? t('shell.event.selectTenantFirst')
                : tenantEvents.length === 0
                  ? t('shell.event.empty')
                  : t('shell.event.placeholder')
            }
            style={{ minWidth: 200 }}
            value={effectiveEventId ?? undefined}
            options={tenantEvents.map((e) => ({
              value: e.eventId,
              label: e.name,
            }))}
            onChange={(value) => {
              setSelectedEventId(value);
              if (resolvedTenantId) {
                router.push(`/t/${resolvedTenantId}/e/${value}`);
              }
            }}
            disabled={!resolvedTenantId || tenantEvents.length === 0}
            data-testid="event-switcher"
            allowClear
            onClear={() => setSelectedEventId(null)}
          />
        </Space>

        <Space>
          {caps?.showGateDeeplink ? (
            <GateDeeplinkButton
              href={gateDeeplinkUrl({ PRODUCT_ORIGIN: productOrigin })}
            />
          ) : null}
          <Dropdown menu={accountMenu} trigger={['click']}>
            <Button type="text" data-testid="account-menu">{t('shell.account.menu')}</Button>
          </Dropdown>
        </Space>
      </Header>

      <Layout>
        {caps?.showOrgChrome || caps?.showPlatform || showAnalyticsNav ? (
          <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            breakpoint="lg"
            width={240}
            style={{ background: token.colorBgContainer }}
          >
            <Menu
              mode="inline"
              selectedKeys={[pathname]}
              items={siderItems}
              style={{ borderInlineEnd: 0, minHeight: '100%' }}
              data-testid="portal-sider"
            />
          </Sider>
        ) : null}

        <Content
          id="portal-main"
          style={{ padding: 24, minHeight: 280 }}
          tabIndex={-1}
        >
          <Breadcrumb
            style={{ marginBottom: 16 }}
            items={[
              { title: <Link href="/">Portal</Link> },
              ...(activeTenant
                ? [
                    {
                      title: (
                        <Link href={`/t/${activeTenant.tenantId}`}>
                          {activeTenant.name}
                        </Link>
                      ),
                    },
                  ]
                : []),
              ...(pathname.includes('/analytics') && activeTenant
                ? [
                    {
                      title: (
                        <Link href={`/t/${activeTenant.tenantId}/analytics`}>
                          {t('nav.org.analytics')}
                        </Link>
                      ),
                    },
                  ]
                : []),
              ...(activeEvent
                ? [
                    {
                      title: (
                        <Link
                          href={`/t/${activeEvent.tenantId}/e/${activeEvent.eventId}`}
                        >
                          {activeEvent.name}
                        </Link>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <PortalDualRunBanner productOrigin={productOrigin} />
          {activeTenant?.status === 'SUSPENDED' ? (
            <SurfaceState kind="suspended" />
          ) : null}
          {activeTenant?.status === 'PENDING' ? (
            <SurfaceState
              kind="pending-activation"
              emptyAction={
                <Link href={`/onboarding/${activeTenant.tenantId}`}>
                  <Button type="link">{t('onboarding.pending.openWait')}</Button>
                </Link>
              }
            />
          ) : null}
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
