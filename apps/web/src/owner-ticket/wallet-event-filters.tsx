'use client';

import Link from 'next/link';
import { formatDual, useAttendeeLocale } from '../i18n';
import {
  DEFAULT_ATTENDEE_LOCALE,
  type AttendeeLocale,
} from '../i18n/locale';
import { WALLET_COPY_CATALOG, walletCopy } from './types';
import {
  attendeeWalletFilterChip,
  attendeeWalletFilterCount,
  attendeeWalletFilters,
} from '../attendee-detail-surface';
import type { WalletTicketRow } from './types';

export type WalletEventFilter = {
  eventId: string;
  eventName?: string;
  count: number;
};

export function walletEventFilterLabel(
  filter: Pick<WalletEventFilter, 'eventId' | 'eventName'>,
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): string {
  return (
    filter.eventName?.trim() ||
    formatDual(WALLET_COPY_CATALOG.eventFallback, locale, {
      id: filter.eventId.slice(0, 8),
    })
  );
}

export function buildWalletEventFilters(
  tickets: WalletTicketRow[],
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): WalletEventFilter[] {
  const byEvent = new Map<string, WalletEventFilter>();
  for (const ticket of tickets) {
    const existing = byEvent.get(ticket.eventId);
    if (existing) {
      existing.count += 1;
      continue;
    }
    byEvent.set(ticket.eventId, {
      eventId: ticket.eventId,
      eventName: ticket.eventName?.trim() || undefined,
      count: 1,
    });
  }
  return [...byEvent.values()].sort((a, b) =>
    walletEventFilterLabel(a, locale).localeCompare(
      walletEventFilterLabel(b, locale),
      locale,
    ),
  );
}

type Props = {
  filters: WalletEventFilter[];
  activeEventId: string | null;
  totalCount: number;
};

export function WalletEventFilters({
  filters,
  activeEventId,
  totalCount,
}: Props) {
  const { locale } = useAttendeeLocale();
  const copy = walletCopy(locale);
  if (filters.length === 0) return null;

  return (
    <nav
      className={attendeeWalletFilters}
      aria-label={copy.filterAria}
      data-testid="wallet-event-filters"
    >
      <Link
        href="/wallet"
        className={attendeeWalletFilterChip(!activeEventId)}
        aria-current={activeEventId ? undefined : 'true'}
        data-testid="wallet-filter-all"
      >
        {copy.filterAll}
        <span className={attendeeWalletFilterCount}>{totalCount}</span>
      </Link>
      {filters.map((filter) => {
        const active = activeEventId === filter.eventId;
        return (
          <Link
            key={filter.eventId}
            href={`/wallet?event=${encodeURIComponent(filter.eventId)}`}
            className={attendeeWalletFilterChip(active)}
            aria-current={active ? 'true' : undefined}
            data-testid={`wallet-filter-${filter.eventId}`}
          >
            {walletEventFilterLabel(filter, locale)}
            <span className={attendeeWalletFilterCount}>{filter.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
