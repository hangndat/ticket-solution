'use client';

import { Button } from '@ticket/ui';
import { useAttendeeLocale } from '../i18n';
import { SurfaceState } from '../ui/surface-state';
import { rateLimitCopy } from './copy';

export function RateLimitState({ kind, retryHref }: {
  kind: 'homePartialRateLimited' | 'homeRateLimited' | 'detailRateLimited';
  retryHref: string;
}) {
  const { locale } = useAttendeeLocale();
  const copy = rateLimitCopy(locale);
  const testId = kind === 'homePartialRateLimited' ? 'home-events-partial-rate-limited'
    : kind === 'homeRateLimited' ? 'home-events-rate-limited' : 'event-rate-limited';
  return <SurfaceState kind="error" {...copy[kind]} testId={testId}
    action={<form action={retryHref}><Button type="submit" variant="brand">{copy.retry}</Button></form>} />;
}
