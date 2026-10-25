'use client';

import { ConfigProvider, theme as antdTheme } from 'antd';
import { useEffect, useState, type ReactNode } from 'react';
import { vemokiTheme } from '../theme/vemoki';

/**
 * ProLayout may apply its theme to shell descendants.
 * Nested ConfigProvider with only `defaultAlgorithm` still merges parent tokens
 * unless `inherit: false` (Ant useTheme resets to defaultConfig base).
 * Wrap chrome on light surfaces so Select/Dropdown popups get light elevated/ink tokens.
 */
export function PortalContentTheme({ children }: { children: ReactNode }) {
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
      theme={{
        inherit: false,
        algorithm: antdTheme.defaultAlgorithm,
        cssVar: { key: 'portal-light-chrome' },
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
      {children}
    </ConfigProvider>
  );
}
