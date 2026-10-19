'use client';

import { ProLayout } from '@ant-design/pro-components';
import type { MenuDataItem } from '@ant-design/pro-components';
import { Button, Dropdown, Select, Space, theme } from 'antd';
import type { MenuProps } from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { resolvePortalMenuKeys } from '../nav/portal-menu-keys';
import type { MeTenantItem } from '@ticket/contracts';
import { gateDeeplinkUrl } from '../oidc/config';
import type { PortalShellCapabilities } from '../nav/capabilities';
import { GateDeeplinkButton } from './gate-deeplink';
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
  const router = useRouter();
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
        <Link href="/" style={{ color: 'inherit' }} data-testid="portal-brand">
          Vemoki Portal
        </Link>
      }
      title={false}
      headerContentRender={() => (
        <Space wrap size="middle" style={{ flex: 1, marginInlineStart: 16 }}>
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
              if (resolvedTenantId) {
                router.push(`/t/${resolvedTenantId}/e/${value}`);
              }
            }}
            disabled={!resolvedTenantId || tenantEvents.length === 0}
            data-testid="event-switcher"
            allowClear
            onClear={() => {
              if (resolvedTenantId) router.push(`/t/${resolvedTenantId}`);
            }}
          />
        </Space>
      )}
      actionsRender={() => [
        caps?.showGateDeeplink ? (
          <GateDeeplinkButton
            key="gate"
            href={gateDeeplinkUrl({ PRODUCT_ORIGIN: productOrigin })}
          />
        ) : null,
        <Dropdown key="account" menu={accountMenu} trigger={['click']}>
          <Button type="text" data-testid="account-menu">{t('shell.account.menu')}</Button>
        </Dropdown>,
      ]}
      token={{
        header: {
          colorBgHeader: token.colorBgContainer,
        },
        sider: {
          colorMenuBackground: token.colorBgContainer,
        },
      }}
      contentStyle={{ padding: 24 }}
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
      <a href="#portal-main" className="portal-skip-link">{t('shell.skipNav')}</a>
      <div id="portal-main" tabIndex={-1}>
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
      </div>
    </ProLayout>
  );
}
