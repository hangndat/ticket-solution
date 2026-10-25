'use client';

import { ConfigProvider, theme as antdTheme } from 'antd';
import type { ReactNode } from 'react';
import { vemokiTheme } from '../theme/vemoki';

/**
 * ProLayout `navTheme="realDark"` applies darkAlgorithm to shell descendants.
 * Nested ConfigProvider with only `defaultAlgorithm` still merges parent dark tokens
 * unless `inherit: false` (Ant useTheme resets to defaultConfig base).
 * Wrap chrome on light surfaces so Select/Dropdown popups get light elevated/ink tokens.
 */
export function PortalContentTheme({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        inherit: false,
        algorithm: antdTheme.defaultAlgorithm,
        cssVar: { key: 'portal-light-chrome' },
        ...vemokiTheme,
      }}
    >
      {children}
    </ConfigProvider>
  );
}
