'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { t } from './copy';
import type { MarketingLocale } from './hosts';
import { localeSwitchHref } from './links';
import {
  marketingLocaleGroup,
  marketingLocaleLink,
} from './marketing-surface';

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

  const viHref = localeSwitchHref('vi', pageKind, hash);
  const enHref = localeSwitchHref('en', pageKind, hash);

  return (
    <span
      className={marketingLocaleGroup}
      role="group"
      aria-label={t(locale, 'nav.locale.label')}
      data-header-on-ink={onInk ? '' : undefined}
    >
      <Link
        href={viHref}
        className={marketingLocaleLink}
        aria-current={locale === 'vi' ? 'true' : undefined}
      >
        {t(locale, 'nav.locale.vi')}
      </Link>
      <Link
        href={enHref}
        className={marketingLocaleLink}
        aria-current={locale === 'en' ? 'true' : undefined}
      >
        {t(locale, 'nav.locale.en')}
      </Link>
    </span>
  );
}
