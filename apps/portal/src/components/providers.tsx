'use client';

import { ProConfigProvider } from '@ant-design/pro-components';
import { App, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import viVN from 'antd/locale/vi_VN';
import type { ReactNode } from 'react';
import {
  PortalLocaleProvider,
  usePortalLocale,
  type PortalLocale,
} from '../i18n';

function AntdLocaleBridge({ children }: { children: ReactNode }) {
  const { locale } = usePortalLocale();

  return (
    <ConfigProvider locale={locale === 'en' ? enUS : viVN}>
      <ProConfigProvider hashed={false}>
        <App>{children}</App>
      </ProConfigProvider>
    </ConfigProvider>
  );
}

export function PortalProviders({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: PortalLocale;
}) {
  return (
    <PortalLocaleProvider initialLocale={initialLocale}>
      <AntdLocaleBridge>{children}</AntdLocaleBridge>
    </PortalLocaleProvider>
  );
}
