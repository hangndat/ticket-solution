'use client';

import { useEffect } from 'react';
import type { MarketingLocale } from './hosts';

/** Sync <html lang/data-surface> for marketing EN/VI without root headers(). */
export function MarketingHtmlAttrs({ locale }: { locale: MarketingLocale }) {
  useEffect(() => {
    const root = document.documentElement;
    const prevLang = root.lang;
    const prevSurface = root.getAttribute('data-surface');
    root.lang = locale;
    root.setAttribute('data-surface', 'marketing');
    return () => {
      root.lang = prevLang || 'vi';
      if (prevSurface) root.setAttribute('data-surface', prevSurface);
      else root.removeAttribute('data-surface');
    };
  }, [locale]);
  return null;
}
