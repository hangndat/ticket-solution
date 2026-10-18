'use client';

import { App, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { useEffect, useState, type ReactNode } from 'react';
import { vemokiTheme } from '../theme/vemoki';

export function PortalProviders({ children }: { children: ReactNode }) {
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
      locale={viVN}
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
