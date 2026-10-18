'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { t } from './copy';
import type { MarketingLocale } from './hosts';
import { localeSwitchHref } from './links';

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
  const [hash, setHash] = useState('');

  useEffect(() => {
    setHash(window.location.hash || '');
    const onHash = () => setHash(window.location.hash || '');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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
