'use client';

import { ConfigProvider, theme as antdTheme } from 'antd';
import type { ReactNode } from 'react';
import { vemokiTheme } from '../theme/vemoki';

/**
 * ProLayout `navTheme="realDark"` applies darkAlgorithm to shell descendants.
 * Wrap chrome that sits on light surfaces (context strip, account menu, main ops UI)
 * so Ant Select/Dropdown popups inherit light tokens from ConfigProvider.
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
