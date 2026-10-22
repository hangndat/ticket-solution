'use client';

import {
  demoMediaForEventId,
  demoMediaForTenantSlug,
  sanitizeMediaUrl,
} from '../demo-media';
import { eventArtTone } from './event-art-tone';
import { SafeEventImage } from './safe-event-image';

/** Server-safe tone helper — re-exported for catalog cards (F01 boundary). */
export { eventArtTone };

export {
  HomeCatalogGrid,
  type HomeCatalogItem,
  type HomeCatalogTimeFilter,
  catalogArtLabel,
  catalogArtTone,
} from '../home-catalog';

type SharedLookup = {
  eventId?: string | null;
  tenantSlug?: string | null;
};

function resolveDemoPack(eventId?: string | null, tenantSlug?: string | null) {
  return demoMediaForEventId(eventId) ?? demoMediaForTenantSlug(tenantSlug);
}

/**
 * Event banner: prefer explicit URL → bundled demo pack.
 * Fail-closed — never shows a broken image placeholder.
 */
export function EventBanner({
  eventId,
  tenantSlug,
  bannerUrl,
  className = 'event-banner',
  testId = 'event-banner',
  alt = 'Ảnh banner sự kiện',
}: SharedLookup & {
  bannerUrl?: string | null;
  className?: string;
  testId?: string;
  alt?: string;
}) {
  const pack = resolveDemoPack(eventId, tenantSlug);
  const src =
    sanitizeMediaUrl(bannerUrl) ?? pack?.bannerUrl ?? null;

  return (
    <SafeEventImage
      src={src}
      alt={alt}
      className={className}
      width={1200}
      height={630}
      testId={testId}
    />
  );
}

/**
 * Event / org logo lockup for cards and event chrome.
 */
export function EventLogo({
  eventId,
  tenantSlug,
  logoUrl,
  className = 'event-logo',
  testId = 'event-logo',
  alt = 'Logo sự kiện',
}: SharedLookup & {
  logoUrl?: string | null;
  className?: string;
  testId?: string;
  alt?: string;
}) {
  const pack = resolveDemoPack(eventId, tenantSlug);
  const src = sanitizeMediaUrl(logoUrl) ?? pack?.logoUrl ?? null;

  return (
    <SafeEventImage
      src={src}
      alt={alt}
      className={className}
      width={760}
      height={200}
      testId={testId}
    />
  );
}

/** Compact stack: banner + logo for event cards / detail hero. */
export function EventMediaHeader({
  eventId,
  tenantSlug,
  bannerUrl,
  logoUrl,
  className = 'event-media',
  testId = 'event-media',
}: SharedLookup & {
  bannerUrl?: string | null;
  logoUrl?: string | null;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={className} data-testid={testId}>
      <EventBanner
        eventId={eventId}
        tenantSlug={tenantSlug}
        bannerUrl={bannerUrl}
        testId={`${testId}-banner`}
      />
      <EventLogo
        eventId={eventId}
        tenantSlug={tenantSlug}
        logoUrl={logoUrl}
        testId={`${testId}-logo`}
      />
    </div>
  );
}
