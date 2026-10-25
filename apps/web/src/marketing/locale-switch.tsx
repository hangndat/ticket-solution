'use client';

import { useSyncExternalStore } from 'react';
import { t } from './copy';
import type { MarketingLocale } from './hosts';
import { localeSwitchHref } from './links';
import { marketingLocaleSelect } from './marketing-surface';

function subscribeHash(onStoreChange: () => void): () => void {
  window.addEventListener('hashchange', onStoreChange);
  return () => window.removeEventListener('hashchange', onStoreChange);
}

function getHashSnapshot(): string {
  return window.location.hash || '';
}

function getServerHashSnapshot(): string {
  return '';
}

/**
 * Single native locale control — preserves current hash (e.g. #interest) per PD F3.
 */
export function LocaleSwitch({
  locale,
  pageKind,
  onInk = false,
}: {
  locale: MarketingLocale;
  pageKind: 'sales' | 'privacy' | 'support';
  onInk?: boolean;
}) {
  const hash = useSyncExternalStore(
    subscribeHash,
    getHashSnapshot,
    getServerHashSnapshot,
  );

  const label = t(locale, 'nav.locale.label');

  return (
    <select
      id="mkt-locale-select"
      className={marketingLocaleSelect}
      value={locale}
      aria-label={label}
      data-header-on-ink={onInk ? '' : undefined}
      data-testid="mkt-locale-select"
      onChange={(event) => {
        const next = event.target.value as MarketingLocale;
        if (next === locale) return;
        window.location.assign(localeSwitchHref(next, pageKind, hash));
      }}
    >
      <option value="vi">{t(locale, 'nav.locale.vi')}</option>
      <option value="en">{t(locale, 'nav.locale.en')}</option>
    </select>
  );
}
