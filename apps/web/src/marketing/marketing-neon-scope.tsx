'use client';

import { useEffect } from 'react';

/** Enable scoped neon marketing tokens on <html> for sales pages only (VD-04). */
export function MarketingNeonScope({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    const root = document.documentElement;
    if (!enabled) return;
    root.setAttribute('data-vemoki-marketing', 'neon-v1');
    return () => {
      root.removeAttribute('data-vemoki-marketing');
    };
  }, [enabled]);
  return null;
}
