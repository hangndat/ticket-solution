'use client';

import { ProLayout } from '@ant-design/pro-components';
import type { MenuDataItem } from '@ant-design/pro-components';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { resolvePortalMenuKeys } from '../nav/portal-menu-keys';
import {
  mergePortalSiderOpenKeys,
  readPersistedSiderOpenKeys,
  writePersistedSiderOpenKeys,
} from '../nav/portal-sider-open-keys';
import type { MeTenantItem } from '@ticket/contracts';
import type { PortalShellCapabilities } from '../nav/capabilities';
import { VEMOKI_COLORS } from '../theme/vemoki';
import { PortalContextStrip } from './portal-context-strip';
import { PortalDualRunBanner } from './dual-run-banner';
import { SurfaceState } from './surface-state';
import { usePortalLocale } from '../i18n';
import { PortalBrandLockup } from './portal-brand-lockup';
import { PortalContentTheme } from './portal-content-theme';

export type PortalProLayoutProps = {
  children: ReactNode;
  productOrigin: string;
  menuData: MenuDataItem[];
  showSider: boolean;
  caps: PortalShellCapabilities | null;
  tenants: MeTenantItem[];
  tenantEvents: Array<{ eventId: string; name: string; tenantId: string }>;
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
  tenantEvents,
  resolvedTenantId,
  effectiveEventId,
  activeTenant,
}: PortalProLayoutProps) {
  const { t, locale, setLocale } = usePortalLocale();
  const pathname = usePathname();

  const { selectedKeys, openKeys: pathOpenKeys } = useMemo(
    () => resolvePortalMenuKeys(pathname, menuData),
    [pathname, menuData],
  );
  const [persistedOpenKeys, setPersistedOpenKeys] = useState<string[]>([]);
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const routeSyncRef = useRef(false);

  useEffect(() => {
    setPersistedOpenKeys(readPersistedSiderOpenKeys());
  }, []);

  useEffect(() => {
    routeSyncRef.current = true;
    setPersistedOpenKeys((prev) => {
      const merged = mergePortalSiderOpenKeys(pathOpenKeys, prev);
      writePersistedSiderOpenKeys(merged);
      return merged;
    });
    const id = requestAnimationFrame(() => {
      routeSyncRef.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, [pathname, pathOpenKeys]);

  const openKeys = useMemo(
    () => mergePortalSiderOpenKeys(pathOpenKeys, persistedOpenKeys),
    [pathOpenKeys, persistedOpenKeys],
  );

  const accountMenu: MenuProps = {
    selectable: true,
    selectedKeys: [`locale-${locale}`],
    items: [
      {
        key: 'security',
        label: <Link href="/account/security">{t('shell.account.security')}</Link>,
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
      collapsed={siderCollapsed}
      onCollapse={setSiderCollapsed}
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
        <Link
          href="/"
          className={
            siderCollapsed
              ? 'portal-brand-link portal-brand-link--mark-only'
              : 'portal-brand-link'
          }
          data-testid="portal-brand"
        >
          <PortalBrandLockup />
        </Link>
      }
      title={false}
      headerContentRender={false}
      actionsRender={() => [
        <Dropdown key="account" menu={accountMenu} trigger={['click']}>
          <Button type="text" data-testid="account-menu">{t('shell.account.menu')}</Button>
        </Dropdown>,
      ]}
      token={{
        header: {
          colorBgHeader: '#ffffff',
          colorHeaderTitle: VEMOKI_COLORS.ink,
          heightLayoutHeader: 64,
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
          motion: { motionName: undefined },
          onOpenChange: (keys: string[]) => {
            if (routeSyncRef.current) return;
            const next = mergePortalSiderOpenKeys(pathOpenKeys, keys);
            setPersistedOpenKeys(next);
            writePersistedSiderOpenKeys(next);
          },
          'data-testid': 'portal-sider',
        } as MenuProps & { 'data-testid': string }
      }
    >
      <a href="#portal-main" className="portal-skip-link">{t('shell.skipNav')}</a>
      <PortalContextStrip
        tenants={tenants}
        tenantEvents={tenantEvents}
        resolvedTenantId={resolvedTenantId}
        effectiveEventId={effectiveEventId}
        showGateScanHint={Boolean(caps?.showGateScanHint)}
      />
      <div id="portal-main" tabIndex={-1} className="portal-main-surface">
        <PortalContentTheme>
          <PortalDualRunBanner productOrigin={productOrigin} />
          {activeTenant?.status === 'SUSPENDED' ? <SurfaceState kind="suspended" /> : null}
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
        </PortalContentTheme>
      </div>
    </ProLayout>
  );
}
