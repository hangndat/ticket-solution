'use client';

import { ProConfigProvider } from '@ant-design/pro-components';
import { App, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import viVN from 'antd/locale/vi_VN';
import { useEffect, useState, type ReactNode } from 'react';
import {
  PortalLocaleProvider,
  usePortalLocale,
  type PortalLocale,
} from '../i18n';
import { vemokiTheme } from '../theme/vemoki';

function AntdLocaleBridge({ children }: { children: ReactNode }) {
  const { locale } = usePortalLocale();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return (
    <ConfigProvider
      locale={locale === 'en' ? enUS : viVN}
      theme={{
        ...vemokiTheme,
        token: {
          ...vemokiTheme.token,
          ...(reducedMotion
            ? {
                motionDurationFast: '0s',
                motionDurationMid: '0s',
                motionDurationSlow: '0s',
              }
            : {}),
        },
      }}
    >
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
