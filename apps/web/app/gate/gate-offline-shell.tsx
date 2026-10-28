'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  readBrowserOnline,
  resolveGateLinkState,
  type GateLinkState,
} from '../../src/gate/connectivity';
import { GateOfflineBanner } from './offline-banner';

type Props = {
  children: ReactNode;
  /** When true, parent form already renders its own banner (avoid duplicate). */
  suppressBanner?: boolean;
};

/**
 * Page-level offline detection so the VI banner appears even when OIDC
 * blocks GateForm (fail-closed auth chrome still warns staff).
 */
export function GateOfflineShell({ children, suppressBanner = false }: Props) {
  const [browserOnline, setBrowserOnline] = useState(() => readBrowserOnline());
  const link: GateLinkState = resolveGateLinkState({
    browserOnline,
    apiUnreachable: false,
  });

  useEffect(() => {
    function sync() {
      setBrowserOnline(readBrowserOnline(window.navigator));
    }
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    const timer = window.setInterval(sync, 1000);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div data-testid="gate-offline-shell" data-browser-online={browserOnline ? '1' : '0'}>
      {!suppressBanner ? <GateOfflineBanner link={link} /> : null}
      {children}
    </div>
  );
}
