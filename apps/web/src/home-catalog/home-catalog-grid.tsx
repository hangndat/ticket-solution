'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { Button, Input } from '@ticket/ui';
import { CatalogEventCard, FilterChip } from '@ticket/ui/client';
import {
  attendeeCatalogOwnedStrip,
  attendeeHomeCatalog,
  attendeeHomeCatalogEmpty,
  attendeeHomeCatalogEmptyAction,
  attendeeHomeCatalogFilters,
  attendeeHomeCatalogGrid,
  attendeeHomeCatalogSearch,
  attendeeHomeCatalogSearchIcon,
  attendeeHomeCatalogSearchInput,
  attendeeHomeCatalogTools,
} from '../attendee-surface';
import { publishedEventHref } from '../published/format';
import {
  catalogArtLabel,
  catalogArtTone,
  formatEventWhen,
  type HomeCatalogItem,
  type HomeCatalogTimeFilter,
  eventMatchesTimeFilter,
} from './catalog-utils';
import { isDemoCatalogTenant } from './demo-tenant';
import { fetchBoundJson, useWebActorData, type PrivateView, type WebActorIdentity } from '../oidc/client-actor-gate';
import { parseMeTicketsResponse } from '../owner-ticket/parse';
import { ownedTicketCountByEventId } from '../owner-ticket/owned-count-by-event';

export function HomeCatalogGrid({ items }: { items: HomeCatalogItem[] }) {
  const loadOwned = useCallback(async (
    identity: WebActorIdentity,
    signal: AbortSignal,
    isCurrent: () => boolean,
  ): Promise<PrivateView<Record<string, number>>> => {
    const response = await fetchBoundJson('/api/bff/tickets', identity, signal, isCurrent);
    if (response.status === 401) return { status: 'unauthenticated' };
    if (response.status >= 500) return { status: 'unreachable' };
    if (response.status !== 200) return { status: 'invalid' };
    const tickets = parseMeTicketsResponse(response.body);
    return tickets
      ? { status: 'ready', value: ownedTicketCountByEventId(tickets) }
      : { status: 'invalid' };
  }, []);
  const ownedView = useWebActorData(loadOwned);
  const ownedByEventId = ownedView.status === 'ready' ? ownedView.value : undefined;
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

  const timeOptions: { value: HomeCatalogTimeFilter; label: string }[] = [
    { value: 'upcoming', label: 'Sắp diễn ra' },
    { value: 'all', label: 'Tất cả' },
    { value: 'past', label: 'Đã qua' },
  ];

  return (
    <section
      className={attendeeHomeCatalog}
      aria-labelledby="home-catalog-title"
      data-testid="home-catalog"
    >
      <h2 id="home-catalog-title" className="sr-only">
        Danh sách sự kiện
      </h2>
      <div className={attendeeHomeCatalogTools}>
        <label className={attendeeHomeCatalogSearch}>
          <span className="sr-only">Tìm sự kiện</span>
          <span className={attendeeHomeCatalogSearchIcon} aria-hidden="true">
            ⌕
          </span>
          <Input
            type="search"
            name="q"
            className={attendeeHomeCatalogSearchInput}
            placeholder="Tìm sự kiện hoặc nhà tổ chức"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            data-testid="home-catalog-search"
          />
        </label>
        <div
          className={attendeeHomeCatalogFilters}
          role="group"
          aria-label="Lọc theo thời gian"
        >
          {timeOptions.map((option) => (
            <FilterChip
              key={option.value}
              active={timeFilter === option.value}
              onClick={() => setTimeFilter(option.value)}
              data-testid={`home-catalog-filter-${option.value}`}
            >
              {option.label}
            </FilterChip>
          ))}
        </div>
        <label className="sr-only">
          <span className="sr-only">Lọc theo thời gian</span>
          <select
            name="time"
            value={timeFilter}
            onChange={(event) =>
              setTimeFilter(event.target.value as HomeCatalogTimeFilter)
            }
            data-testid="home-catalog-time-filter"
            tabIndex={-1}
            aria-hidden="true"
          >
            {timeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div
          className={attendeeHomeCatalogEmpty}
          data-testid="home-catalog-empty"
          role="status"
        >
          <p>Không có sự kiện khớp bộ lọc. Thử đổi từ khóa hoặc khoảng thời gian.</p>
          {(query.trim() || timeFilter !== 'upcoming') && (
            <div className={attendeeHomeCatalogEmptyAction}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setTimeFilter('upcoming');
                }}
                data-testid="home-catalog-empty-reset"
              >
                Xóa bộ lọc
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div
          className={attendeeHomeCatalogGrid}
          role="list"
          data-testid="home-catalog-grid"
        >
          {filtered.map((event) => {
            const ownedCount = ownedByEventId?.[event.id];
            const showOwned =
              typeof ownedCount === 'number' && ownedCount > 0;
            const when = formatEventWhen(event);
            const place = event.location ?? event.timezone;
            const meta = `${when}${place ? ` · ${place}` : ''}`;

            return (
              <CatalogEventCard
                key={event.id}
                href={publishedEventHref({
                  tenantSlug: event.tenantSlug,
                  slug: event.slug,
                })}
                title={event.name}
                organization={event.brand.organizationName}
                meta={meta}
                actionLabel="Xem sự kiện"
                artLabel={catalogArtLabel(event.name)}
                artTone={catalogArtTone(event.id)}
                showDemoBadge={isDemoCatalogTenant(
                  event.tenantSlug,
                  event.brand.organizationName,
                )}
                testId={`home-event-${event.id}`}
                artTestId={`home-catalog-art-${event.id}`}
                ownedStrip={
                  showOwned
                    ? (
                        <Link
                          className={attendeeCatalogOwnedStrip}
                          href={`/wallet?event=${encodeURIComponent(event.id)}`}
                          prefetch={false}
                          data-testid={`home-event-owned-${event.id}`}
                        >
                          <span>Bạn có {ownedCount} vé</span>
                          <span aria-hidden="true">Xem vé →</span>
                        </Link>
                      )
                    : undefined
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
