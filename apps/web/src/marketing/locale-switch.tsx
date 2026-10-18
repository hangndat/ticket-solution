'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { t } from './copy';
import type { MarketingLocale } from './hosts';
import { localeSwitchHref } from './links';

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
 * VI|EN switcher — preserves current hash (e.g. #interest) per PD F3.
 */
export function LocaleSwitch({
  locale,
  pageKind,
}: {
  locale: MarketingLocale;
  pageKind: 'sales' | 'privacy' | 'support';
}) {
  const hash = useSyncExternalStore(
    subscribeHash,
    getHashSnapshot,
    getServerHashSnapshot,
  );

  return (
    <span
      className="mkt-locale"
      role="group"
      aria-label={t(locale, 'nav.locale.label')}
    >
      <Link
        href={localeSwitchHref('vi', pageKind, hash)}
        aria-current={locale === 'vi' ? 'true' : undefined}
      >
        {t(locale, 'nav.locale.vi')}
      </Link>
      <span aria-hidden="true">|</span>
      <Link
        href={localeSwitchHref('en', pageKind, hash)}
        aria-current={locale === 'en' ? 'true' : undefined}
      >
        {t(locale, 'nav.locale.en')}
      </Link>
    </span>
  );
}
