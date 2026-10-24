'use client';

import dynamic from 'next/dynamic';
import type { MarketingLocale } from './hosts';

const InterestForm = dynamic(
  () => import('./interest-form').then((m) => m.InterestForm),
  { ssr: false },
);

export function InterestFormIsland({
  locale,
  demo,
}: {
  locale: MarketingLocale;
  demo: string;
}) {
  return <InterestForm locale={locale} demo={demo} />;
}
