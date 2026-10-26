'use client';

import { ProLayout } from '@ant-design/pro-components';
import type { MenuDataItem } from '@ant-design/pro-components';
import { Button, Dropdown, theme } from 'antd';
import type { MenuProps } from 'antd';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { resolvePortalMenuKeys } from '../nav/portal-menu-keys';
import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import type { PortalShellCapabilities } from '../nav/capabilities';
import { VEMOKI_COLORS } from '../theme/vemoki';
import { PortalContextStrip } from './portal-context-strip';
import { PortalDualRunBanner } from './dual-run-banner';
import { SurfaceState } from './surface-state';
import { usePortalLocale } from '../i18n';

export type PortalProLayoutProps = {
  children: ReactNode;
  productOrigin: string;
  menuData: MenuDataItem[];
  showSider: boolean;
  caps: PortalShellCapabilities | null;
  tenants: MeTenantItem[];
  events: MeEventItem[];
  tenantEvents: MeEventItem[];
  resolvedTenantId: string | null;
  effectiveEventId: string | null;
  activeTenant: MeTenantItem | null;
};

export function PortalProLayout({
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
}: PortalProLayoutProps) {
  const { t, locale, setLocale } = usePortalLocale();
  const pathname = usePathname();
  const { token } = theme.useToken();

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

  return (
    <ProLayout
      layout="mix"
      navTheme="realDark"
      siderWidth={240}
      breakpoint="lg"
      location={{ pathname }}
      route={{ path: '/', routes: menuData }}
      menuDataRender={() => menuData}
      menuItemRender={(item, dom) => {
        if (item.path) {
          return <Link href={item.path}>{dom}</Link>;
        }
        return dom;
      }}
      selectedKeys={selectedKeys}
      menuRender={showSider ? undefined : false}
      fixSiderbar
      logo={
        <Link href="/" className="portal-brand-link" data-testid="portal-brand">
          Vemoki Portal
        </Link>
      }
      title={false}
      headerContentRender={false}
      actionsRender={() => [
        <Dropdown key="account" menu={accountMenu} trigger={['click']}>
          <Button type="text" data-testid="account-menu">
            {t('shell.account.menu')}
          </Button>
        </Dropdown>,
      ]}
      token={{
        header: {
          colorBgHeader: token.colorBgContainer,
        },
        sider: {
          colorMenuBackground: VEMOKI_COLORS.siderBg,
          colorTextMenu: VEMOKI_COLORS.siderText,
          colorTextMenuSelected: VEMOKI_COLORS.siderTextActive,
          colorBgMenuItemSelected: VEMOKI_COLORS.siderItemSelected,
        },
      }}
      contentStyle={{ padding: 0 }}
      menuProps={
        {
          openKeys,
          onOpenChange: (keys: string[]) => {
            setUserOpenKeys(keys);
          },
          'data-testid': 'portal-sider',
        } as MenuProps & { 'data-testid': string }
      }
    >
      <a href="#portal-main" className="portal-skip-link">
        {t('shell.skipNav')}
      </a>
      <PortalContextStrip
        tenants={tenants}
        events={events}
        tenantEvents={tenantEvents}
        resolvedTenantId={resolvedTenantId}
        effectiveEventId={effectiveEventId}
        showGateScanHint={Boolean(caps?.showGateScanHint)}
      />
      <div
        id="portal-main"
        key={pathname}
        tabIndex={-1}
        className="portal-main-surface"
      >
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
      </div>
    </ProLayout>
  );
}
