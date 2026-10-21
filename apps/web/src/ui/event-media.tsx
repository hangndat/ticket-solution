'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  demoMediaForEventId,
  demoMediaForTenantSlug,
  sanitizeMediaUrl,
} from '../demo-media';
import { publishedEventHref } from '../published/format';
import { PUBLIC_EVENT_COPY } from '../published/copy';
import { eventArtTone } from './event-art-tone';
import { SafeEventImage } from './safe-event-image';

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

export function catalogArtTone(eventId: string): 'default' | 'green' | 'gold' {
  return eventArtTone(eventId);
}

function formatEventWhen(event: HomeCatalogItem): string {
  if (!event.startsAt) return PUBLIC_EVENT_COPY.noStartsAt;
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: event.timezone,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(event.startsAt));
  } catch {
    return event.startsAt;
  }
}

function eventMatchesTimeFilter(
  event: HomeCatalogItem,
  filter: HomeCatalogTimeFilter,
): boolean {
  if (filter === 'all') return true;
  if (!event.startsAt) return filter === 'upcoming';
  const start = Date.parse(event.startsAt);
  if (Number.isNaN(start)) return filter === 'upcoming';
  const now = Date.now();
  if (filter === 'upcoming') return start >= now;
  return start < now;
}

export type HomeCatalogTimeFilter = 'all' | 'upcoming' | 'past';

export type HomeCatalogItem = {
  id: string;
  tenantSlug: string;
  slug: string;
  name: string;
  timezone: string;
  startsAt: string | null;
  location: string | null;
  brand: {
    organizationName: string;
    bannerUrl?: string | null;
    logoUrl?: string | null;
  };
};

export function catalogArtLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '·';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function CatalogEventCard({
  event,
  ownedCount,
}: {
  event: HomeCatalogItem;
  ownedCount?: number;
}) {
  const tone = catalogArtTone(event.id);
  const when = formatEventWhen(event);
  const place = event.location ?? event.timezone;
  const artLabel = catalogArtLabel(event.name);

  const showOwned = typeof ownedCount === 'number' && ownedCount > 0;

  return (
    <article className="home-catalog-card">
      <Link
        className="home-catalog-card__link"
        href={publishedEventHref({
          tenantSlug: event.tenantSlug,
          slug: event.slug,
        })}
        data-testid={`home-event-${event.id}`}
      >
        <div
          className={`home-catalog-card__art home-catalog-card__art--${tone}`}
          data-testid={`home-catalog-art-${event.id}`}
          aria-hidden="true"
        >
          <span className="home-catalog-card__art-fallback">{artLabel}</span>
        </div>
        <div className="home-catalog-card__info">
          <span className="eyebrow">{event.brand.organizationName}</span>
          <h2 className="home-catalog-card__title">{event.name}</h2>
          <p className="home-catalog-card__meta">
            {when}
            {place ? ` · ${place}` : ''}
          </p>
          <span className="home-catalog-card__action">
            Xem sự kiện <span aria-hidden="true">↗</span>
          </span>
        </div>
      </Link>
      {showOwned ? (
        <Link
          className="home-catalog-card__owned"
          href={`/wallet?event=${encodeURIComponent(event.id)}`}
          data-testid={`home-event-owned-${event.id}`}
        >
          <span>
            Bạn có {ownedCount} vé
          </span>
          <span aria-hidden="true">Xem vé →</span>
        </Link>
      ) : null}
    </article>
  );
}

export function HomeCatalogGrid({
  items,
  ownedByEventId,
}: {
  items: HomeCatalogItem[];
  ownedByEventId?: Record<string, number>;
}) {
  const [query, setQuery] = useState('');
  const [timeFilter, setTimeFilter] =
    useState<HomeCatalogTimeFilter>('upcoming');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((event) => {
      if (!eventMatchesTimeFilter(event, timeFilter)) return false;
      if (!q) return true;
      const haystack = [
        event.name,
        event.brand.organizationName,
        event.location ?? '',
        event.tenantSlug,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query, timeFilter]);

  return (
    <section
      className="home-catalog"
      aria-labelledby="home-catalog-title"
      data-testid="home-catalog"
    >
      <h2 id="home-catalog-title" className="visually-hidden">
        Danh sách sự kiện
      </h2>
      <div className="home-catalog-tools">
        <label className="home-catalog-search">
          <span className="visually-hidden">Tìm sự kiện</span>
          <input
            type="search"
            name="q"
            placeholder="Tìm sự kiện hoặc nhà tổ chức"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            data-testid="home-catalog-search"
          />
        </label>
        <label className="home-catalog-filter">
          <span className="visually-hidden">Lọc theo thời gian</span>
          <select
            name="time"
            value={timeFilter}
            onChange={(event) =>
              setTimeFilter(event.target.value as HomeCatalogTimeFilter)
            }
            data-testid="home-catalog-time-filter"
          >
            <option value="upcoming">Sắp diễn ra</option>
            <option value="all">Tất cả</option>
            <option value="past">Đã qua</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="home-catalog-empty" data-testid="home-catalog-empty" role="status">
          Không có sự kiện khớp bộ lọc. Thử đổi từ khóa hoặc khoảng thời gian.
        </p>
      ) : (
        <div
          className="home-catalog-grid"
          role="list"
          data-testid="home-catalog-grid"
        >
          {filtered.map((event) => (
            <CatalogEventCard
              event={event}
              key={event.id}
              ownedCount={ownedByEventId?.[event.id]}
            />
          ))}
        </div>
      )}
    </section>
  );
}
