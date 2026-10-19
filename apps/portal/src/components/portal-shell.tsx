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
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
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

const { Header, Sider, Content } = Layout;

function tenantFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/t\/([^/]+)/);
  return m?.[1] ?? null;
}

function eventFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/t\/[^/]+\/e\/([^/]+)/);
  return m?.[1] ?? null;
}

export function PortalShell({ children }: { children: ReactNode }) {
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

  const ready = shell.status === 'ready' ? shell : null;
  const caps: PortalShellCapabilities | null = ready?.caps ?? null;

  const tenants: MeTenantItem[] = useMemo(
    () => ready?.meTenants?.items ?? [],
    [ready],
  );
  const events: MeEventItem[] = useMemo(
    () => ready?.meEvents?.items ?? [],
    [ready],
  );

  const resolvedTenantId =
    effectiveTenantId ??
    (tenants.length === 1 ? tenants[0]!.tenantId : null);

  const activeTenant =
    tenants.find((t) => t.tenantId === resolvedTenantId) ?? null;
  const tenantEvents = useMemo(
    () => events.filter((e) => e.tenantId === resolvedTenantId),
    [events, resolvedTenantId],
  );
  const activeEvent =
    tenantEvents.find((e) => e.eventId === effectiveEventId) ?? null;

  const orgMenu = useMemo(() => {
    if (!resolvedTenantId || !activeTenant) return [];
    return buildOrgMenuItems(resolvedTenantId, activeTenant, events);
  }, [resolvedTenantId, activeTenant, events]);

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
    return buildEventMenuItems(resolvedTenantId, activeEventId, permissions);
  }, [resolvedTenantId, activeEventId, activeEventPermKey]);

  const siderItems = useMemo(() => {
    const items = orgMenu.map((item) => ({
      key: item.href,
      label: <Link href={item.href}>{item.label}</Link>,
    }));
    for (const item of eventMenu) {
      items.push({
        key: item.href,
        label: <Link href={item.href}>{item.label}</Link>,
      });
    }
    if (caps?.showPlatform) {
      items.push({
        key: '/platform',
        label: <Link href="/platform">Platform</Link>,
      });
    }
    return items;
  }, [orgMenu, eventMenu, caps?.showPlatform]);

  if (pathname.startsWith('/auth')) {
    return <>{children}</>;
  }

  if (shell.status === 'loading') {
    return <SurfaceState kind="loading" />;
  }

  if (shell.status === 'unauthenticated') {
    return (
      <SurfaceState
        kind="permission-denied"
        title="Cần đăng nhập"
        description="Đăng nhập nhân sự để mở portal quản trị."
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
        description={shell.message}
        onRetry={reload}
      />
    );
  }

  const accountMenu = {
    items: [
      {
        key: 'security',
        label: <Link href="/account/security">Bảo mật phiên</Link>,
      },
      {
        key: 'logout',
        label: 'Đăng xuất portal',
        onClick: () => {
          window.location.assign('/api/auth/logout');
        },
      },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <a href="#portal-main" className="portal-skip-link">
        Bỏ qua điều hướng
      </a>
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
            aria-label="Tổ chức"
            placeholder={
              tenants.length === 0 ? 'Chưa có tổ chức' : 'Chọn tổ chức'
            }
            style={{ minWidth: 200 }}
            value={resolvedTenantId ?? undefined}
            options={tenants.map((t) => ({
              value: t.tenantId,
              label: `${t.name} (${t.slug})`,
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
            aria-label="Sự kiện"
            placeholder={
              !resolvedTenantId
                ? 'Chọn tổ chức trước'
                : tenantEvents.length === 0
                  ? 'Chưa có sự kiện'
                  : 'Chọn sự kiện'
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
            <GateDeeplinkButton href={gateDeeplinkUrl()} />
          ) : null}
          <Dropdown menu={accountMenu} trigger={['click']}>
            <Button type="text" data-testid="account-menu">
              Tài khoản ▾
            </Button>
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
                          Phân tích
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
          <PortalDualRunBanner />
          {activeTenant?.status === 'SUSPENDED' ? (
            <SurfaceState kind="suspended" />
          ) : null}
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
