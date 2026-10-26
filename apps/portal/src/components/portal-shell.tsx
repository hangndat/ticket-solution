'use client';

import { Alert, Button, Drawer, Dropdown, Flex, Layout, Menu, Result, Select, Spin, Typography, message, theme } from 'antd';
import type { MenuProps } from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
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
import { usePortalLocale } from '../i18n';
import { SURFACE_MESSAGE_KEYS } from '../prep/surface-copy';
import {
  PORTAL_FORBIDDEN_EVENT,
  forbiddenScopeAffectsPath,
  forbiddenScopeFromBffPath,
  type ForbiddenScope,
} from '../client/portal-fetch';
import {
  canAccessPortalPath,
  canAccessTenantRoute,
  firstAllowedEventPath,
  firstAllowedTenantPath,
} from '../nav/capability-policy';
import { createContextRequestGate } from '../nav/context-request-gate';
import {
  confirmDiscardIfDirty,
  installUnsavedNavigation,
} from '../nav/unsaved-changes';
import {
  resolvePortalMenuKeys,
  type PortalMenuGroup,
} from '../nav/portal-menu-keys';
import {
  eventSwitchDestination,
  tenantSwitchDestination,
} from '../nav/context-destination';
import { isPortalDualRunBannerEnabled } from '../dual-run/allowlist';

const { Header, Sider, Content } = Layout;

/** Align with portal context-strip layout (`globals.css` @1024). */
const NARROW_NAV_MEDIA = '(max-width: 1023px)';

function subscribeNarrowNav(onChange: () => void): () => void {
  const mq = window.matchMedia(NARROW_NAV_MEDIA);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getNarrowNavSnapshot(): boolean {
  return window.matchMedia(NARROW_NAV_MEDIA).matches;
}

function useNarrowNavLayout(): boolean {
  return useSyncExternalStore(
    subscribeNarrowNav,
    getNarrowNavSnapshot,
    () => false,
  );
}

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

type PortalShellChromeProps = {
  children: ReactNode;
  productOrigin: string;
  menuData: PortalMenuGroup[];
  showSider: boolean;
  caps: PortalShellCapabilities | null;
  tenants: MeTenantItem[];
  events: MeEventItem[];
  tenantEvents: MeEventItem[];
  resolvedTenantId: string | null;
  effectiveEventId: string | null;
  activeTenant: MeTenantItem | null;
};

function PortalShellChrome({
  children,
  productOrigin,
  menuData,
  showSider,
  caps,
  tenants,
  events,
  tenantEvents,
  resolvedTenantId,
  effectiveEventId,
  activeTenant,
}: PortalShellChromeProps) {
  const { t, locale, setLocale } = usePortalLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { token } = theme.useToken();
  const narrowNav = useNarrowNavLayout();
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const useDrawerNav = showSider && narrowNav;

  const { selectedKeys, openKeys: pathOpenKeys } = useMemo(
    () => resolvePortalMenuKeys(pathname, menuData),
    [pathname, menuData],
  );
  const [userOpenKeys, setUserOpenKeys] = useState<string[]>([]);
  const openKeys = useMemo(() => {
    const merged = new Set(userOpenKeys);
    for (const key of pathOpenKeys) merged.add(key);
    return [...merged];
  }, [userOpenKeys, pathOpenKeys]);

  const menuItems: MenuProps['items'] = useMemo(
    () =>
      menuData.map((group) => ({
        key: group.key,
        label: group.name,
        children: group.children.map((child) => ({
          key: child.key,
          label: <Link href={child.path}>{child.name}</Link>,
        })),
      })),
    [menuData],
  );

  const closeNavDrawer = useCallback(() => setNavDrawerOpen(false), []);

  const capabilityNavMenu = (
    <Menu
      mode="inline"
      theme="dark"
      items={menuItems}
      selectedKeys={selectedKeys}
      openKeys={openKeys}
      onOpenChange={(keys) => setUserOpenKeys(keys as string[])}
      onClick={closeNavDrawer}
      data-testid="portal-sider"
    />
  );

  const accountMenu: MenuProps = {
    selectable: true,
    selectedKeys: [`locale-${locale}`],
    items: [
      {
        key: 'security',
        label: (
          <Link href="/account/security">{t('shell.account.security')}</Link>
        ),
      },
      {
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

  const selectableTenants = tenants.filter((tenant) =>
    firstAllowedTenantPath(tenant, events),
  );
  const selectableEvents = tenantEvents.filter((event) =>
    firstAllowedEventPath(event),
  );
  const canClearEvent = Boolean(
    activeTenant &&
      (canAccessTenantRoute(
        'overview',
        activeTenant.tenantPermissions,
        tenantEvents.map((event) => event.permissions),
      ) ||
        canAccessTenantRoute(
          'analytics',
          activeTenant.tenantPermissions,
          tenantEvents.map((event) => event.permissions),
        )),
  );
  const tenantLabelId = 'portal-context-tenant-label';
  const eventLabelId = 'portal-context-event-label';
  const showGateScanHint = Boolean(caps?.showGateScanHint);
  const dualRunEnabled = isPortalDualRunBannerEnabled();
  const legacyAdmin = `${productOrigin}/admin`;

  return (
    <>
      {useDrawerNav ? (
        <Drawer
          id="portal-nav-drawer"
          rootClassName="portal-shell-nav-drawer"
          getContainer={() => document.body}
          title={t('shell.nav.drawerTitle')}
          placement="left"
          size={240}
          push={false}
          open={navDrawerOpen}
          onClose={closeNavDrawer}
          destroyOnClose={false}
          styles={{ body: { padding: 0 } }}
        >
          {capabilityNavMenu}
        </Drawer>
      ) : null}
      <Layout className="portal-app-shell" style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 16,
          background: token.colorBgContainer,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
          }}
        >
          {useDrawerNav ? (
            <Button
              type="text"
              aria-expanded={navDrawerOpen}
              aria-controls="portal-nav-drawer"
              aria-haspopup="dialog"
              aria-label={t('shell.nav.open')}
              onClick={() => setNavDrawerOpen(true)}
              data-testid="portal-nav-trigger"
            >
              ☰
            </Button>
          ) : null}
          <Link
            href="/"
            className="portal-brand-link"
            data-testid="portal-brand"
          >
            Vemoki Portal
          </Link>
        </div>
        <Dropdown menu={accountMenu} trigger={['click']}>
          <Button type="text" data-testid="account-menu">
            {t('shell.account.menu')}
          </Button>
        </Dropdown>
      </Header>
      <Layout>
        {showSider && !useDrawerNav ? (
          <Sider
            className="portal-desktop-sider"
            theme="dark"
            width={240}
            collapsible={false}
            trigger={null}
            style={{ minHeight: 'calc(100vh - 64px)' }}
          >
            {capabilityNavMenu}
          </Sider>
        ) : null}
        <Layout>
          <Content style={{ padding: 0 }}>
            <a href="#portal-main" className="portal-skip-link">
              {t('shell.skipNav')}
            </a>
            <div
              className="portal-context-strip"
              data-testid="portal-context-strip"
            >
              <div className="portal-context-strip__row">
                <div className="portal-context-strip__field">
                  <label
                    id={tenantLabelId}
                    className="portal-context-strip__label"
                  >
                    {t('shell.tenant.label')}
                  </label>
                  <Select
                    aria-labelledby={tenantLabelId}
                    placeholder={
                      selectableTenants.length === 0
                        ? t('shell.tenant.empty')
                        : t('shell.tenant.placeholder')
                    }
                    value={resolvedTenantId ?? undefined}
                    options={selectableTenants.map((tenant) => ({
                      value: tenant.tenantId,
                      label: `${tenant.name} (${tenant.slug})`,
                      title: `${tenant.name} (${tenant.slug})`,
                    }))}
                    onChange={(value) => {
                      const tenant = tenants.find(
                        (item) => item.tenantId === value,
                      );
                      const destination =
                        tenant &&
                        tenantSwitchDestination(pathname, tenant, events);
                      if (
                        destination &&
                        confirmDiscardIfDirty(t('shell.unsaved.confirm'))
                      ) {
                        if (!destination.preserved)
                          void message.info(t('shell.context.fallback'));
                        router.push(destination.path);
                      }
                    }}
                    disabled={selectableTenants.length === 0}
                    data-testid="tenant-switcher"
                  />
                </div>
                <div className="portal-context-strip__field">
                  <label
                    id={eventLabelId}
                    className="portal-context-strip__label"
                  >
                    {t('nav.org.events')}
                  </label>
                  <Select
                    aria-labelledby={eventLabelId}
                    placeholder={
                      !resolvedTenantId
                        ? t('shell.event.selectTenantFirst')
                        : selectableEvents.length === 0
                          ? t('shell.event.empty')
                          : t('shell.event.placeholder')
                    }
                    value={effectiveEventId ?? undefined}
                    options={selectableEvents.map((e) => ({
                      value: e.eventId,
                      label: e.name,
                      title: e.name,
                    }))}
                    onChange={(value) => {
                      if (resolvedTenantId) {
                        const event = tenantEvents.find(
                          (item) => item.eventId === value,
                        );
                        const destination =
                          event && eventSwitchDestination(pathname, event);
                        if (
                          destination &&
                          confirmDiscardIfDirty(t('shell.unsaved.confirm'))
                        ) {
                          if (!destination.preserved)
                            void message.info(t('shell.context.fallback'));
                          router.push(destination.path);
                        }
                      }
                    }}
                    disabled={
                      !resolvedTenantId || selectableEvents.length === 0
                    }
                    data-testid="event-switcher"
                    allowClear={canClearEvent}
                    onClear={() => {
                      if (
                        !activeTenant ||
                        !confirmDiscardIfDirty(t('shell.unsaved.confirm'))
                      )
                        return;
                      const base = `/t/${activeTenant.tenantId}`;
                      const destination = canAccessTenantRoute(
                        'overview',
                        activeTenant.tenantPermissions,
                        tenantEvents.map((event) => event.permissions),
                      )
                        ? base
                        : `${base}/analytics`;
                      router.push(destination);
                    }}
                  />
                </div>
                {showGateScanHint ? (
                  <Typography.Text
                    type="secondary"
                    className="portal-context-strip__hint"
                    data-testid="gate-ios-scan-hint"
                  >
                    {t('gateDeeplink.h_iosHint')}
                  </Typography.Text>
                ) : null}
              </div>
            </div>
            <div
              id="portal-main"
              key={pathname}
              tabIndex={-1}
              className="portal-main-surface"
            >
              {dualRunEnabled ? (
                <Alert
                  type="info"
                  showIcon
                  banner
                  data-testid="portal-dual-run-banner"
                  style={{ marginBottom: 16 }}
                  message={t('dualRun.h_ekkubx')}
                  description={
                    <>
                      {t('dualRun.h_16lfg67_2')}
                      <a href={legacyAdmin} rel="noopener noreferrer">
                        {legacyAdmin}
                      </a>
                      {t('dualRun.h_l9n5m3')}
                    </>
                  }
                />
              ) : null}
              {activeTenant?.status === 'SUSPENDED' ? (
                <Alert
        type="error"
        showIcon
        banner
        message={t(SURFACE_MESSAGE_KEYS.suspendedTitle)}
        description={t(SURFACE_MESSAGE_KEYS.suspendedDescription)}
      />
              ) : null}
              {activeTenant?.status === 'PENDING' ? (
                <Result
        status="info"
        title={t(SURFACE_MESSAGE_KEYS.pendingActivationTitle)}
        subTitle={t(SURFACE_MESSAGE_KEYS.pendingActivationDescription)}
        extra={
                    <Link href={`/onboarding/${activeTenant.tenantId}`}>
                      <Button type="link">
                        {t('onboarding.pending.openWait')}
                      </Button>
                    </Link>
                  }
      />
              ) : null}
              {children}
            </div>
          </Content>
        </Layout>
      </Layout>
    </Layout>
    </>
  );
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
  const [forbiddenScopes, setForbiddenScopes] = useState<ForbiddenScope[]>([]);
  const requestGate = useRef(createContextRequestGate());

  useEffect(() => installUnsavedNavigation(), []);

  useEffect(() => {
    const deny = (event: Event) => {
      const scope = forbiddenScopeFromBffPath(
        (event as CustomEvent<string>).detail,
      );
      if (!scope) return;
      setForbiddenScopes((previous) =>
        previous.some(
          (item) =>
            item.tenantId === scope.tenantId && item.eventId === scope.eventId,
        )
          ? previous
          : [...previous, scope],
      );
    };
    window.addEventListener(PORTAL_FORBIDDEN_EVENT, deny);
    return () => window.removeEventListener(PORTAL_FORBIDDEN_EVENT, deny);
  }, []);

  const pathTenantId = tenantFromPath(pathname);
  const pathEventId = eventFromPath(pathname);
  const effectiveTenantId = pathTenantId;
  const effectiveEventId = pathEventId;

  const reload = useCallback(() => {
    const request = requestGate.current.begin('shell');
    setShell({ status: 'loading' });
    void loadShellContext().then((result) => {
      if (request.isCurrent()) setShell(result);
    });
  }, []);

  useEffect(() => {
    const gate = requestGate.current;
    let active = true;
    queueMicrotask(() => {
      if (active) reload();
    });
    return () => {
      active = false;
      gate.invalidate();
    };
  }, [reload]);

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
    effectiveTenantId ?? (tenants.length === 1 ? tenants[0]!.tenantId : null);

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

  const menuData = useMemo((): PortalMenuGroup[] => {
    const items: PortalMenuGroup[] = [];
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

  const routeForbidden = !canAccessPortalPath(pathname, {
    tenantId: activeTenant?.tenantId ?? null,
    tenantPermissions: activeTenant?.tenantPermissions ?? [],
    eventId: activeEvent?.eventId ?? null,
    eventPermissions: activeEvent?.permissions ?? [],
    tenantEventPermissions: tenantEvents.map((event) => event.permissions),
  });
  const bffForbidden = forbiddenScopes.some((scope) =>
    forbiddenScopeAffectsPath(scope, pathname),
  );
  const recoveryPath = tenants
    .filter(
      (tenant) =>
        !forbiddenScopes.some(
          (scope) =>
            scope.tenantId === tenant.tenantId && scope.eventId === null,
        ),
    )
    .map((tenant) =>
      firstAllowedTenantPath(
        tenant,
        events.filter(
          (event) =>
            !forbiddenScopes.some(
              (scope) =>
                scope.tenantId === event.tenantId &&
                scope.eventId === event.eventId,
            ),
        ),
      ),
    )
    .find((destination) => destination !== null && destination !== pathname);

  if (pathname.startsWith('/auth')) {
    return <>{children}</>;
  }

  if (shell.status === 'loading') {
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

  if (shell.status === 'unauthenticated') {
    if (staffLoginUrl) {
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
    return (
      <Result
        status="403"
        title={t('shell.auth.requiredTitle')}
        subTitle={t('shell.auth.staffDescription')}
        extra={
          <Button type="primary" onClick={() => {
          window.location.assign('/api/auth/login?return=/');
        }}>
            {t(SURFACE_MESSAGE_KEYS.permissionGoAllowed)}
          </Button>
        }
      />
    );
  }

  if (shell.status === 'error') {
    return (
      <Alert
        type="warning"
        showIcon
        message={t(SURFACE_MESSAGE_KEYS.unknownTitle)}
        description={t(shell.messageKey)}
        action={
          <Button size="small" onClick={reload}>
            {t(SURFACE_MESSAGE_KEYS.recheck)}
          </Button>
        }
        style={{ margin: 24 }}
      />
    );
  }

  if (attendeeOnly) {
    return (
      <Result status="403" title={t('shell.auth.attendeeDeniedTitle')} subTitle={t('shell.auth.attendeeDeniedBody')} extra={
          <Button type="primary" href={productOrigin}>
            {t('shell.auth.openCustomerApp')}
          </Button>
        } />
    );
  }

  if (bffForbidden || routeForbidden) {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t(SURFACE_MESSAGE_KEYS.permissionDefaultDescription)}
        extra={
          <Button type="primary" onClick={() => {
          if (recoveryPath) {
            window.location.assign(recoveryPath);
          } else {
            window.location.reload();
          }
        }}>
            {t(SURFACE_MESSAGE_KEYS.permissionGoAllowed)}
          </Button>
        }
      />
    );
  }

  return (
    <PortalShellChrome
      productOrigin={productOrigin}
      menuData={menuData}
      showSider={showSider}
      caps={caps}
      tenants={tenants}
      events={events}
      tenantEvents={tenantEvents}
      resolvedTenantId={resolvedTenantId}
      effectiveEventId={effectiveEventId}
      activeTenant={activeTenant}
    >
      {children}
    </PortalShellChrome>
  );
}
