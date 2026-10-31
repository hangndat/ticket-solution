'use client';

import Link from 'next/link';
import { CatalogHeroBand } from '@ticket/ui';
import { useAttendeeLocale } from './locale-context';

export function HomeHero() {
  const { t } = useAttendeeLocale();
  return (
    <CatalogHeroBand
      titleId="home-title"
      title={t('home.browse')}
      intro={t('home.intro')}
    >
      <Link href="/redeem" className="font-semibold text-signal hover:underline">
        {t('home.redeemCta')}
      </Link>
    </CatalogHeroBand>
  );
}
