'use client';

import { App, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import viVN from 'antd/locale/vi_VN';
import { useEffect, useState, type ReactNode } from 'react';
import {
  PortalLocaleProvider,
  usePortalLocale,
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
      <App>{children}</App>
    </ConfigProvider>
  );
}

export function PortalProviders({ children }: { children: ReactNode }) {
  return (
    <PortalLocaleProvider>
      <AntdLocaleBridge>{children}</AntdLocaleBridge>
    </PortalLocaleProvider>
  );
}
