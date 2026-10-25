'use client';

import { ConfigProvider, theme as antdTheme } from 'antd';
import type { ReactNode } from 'react';
import { vemokiTheme } from '../theme/vemoki';

/**
 * ProLayout `navTheme="realDark"` enables darkAlgorithm for all descendants.
 * Ops surfaces stay on the light paper palette (alerts, forms, tables).
 */
export function PortalContentTheme({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        ...vemokiTheme,
        algorithm: antdTheme.defaultAlgorithm,
      }}
    >
      {children}
    </ConfigProvider>
  );
}
