'use client';

import Link from 'next/link';
import { useAttendeeLocale } from '../i18n';
import { walletCopy } from './types';
import {
  attendeeWalletFilterChip,
  attendeeWalletFilterCount,
  attendeeWalletFilters,
} from '../attendee-detail-surface';
import type { WalletTicketRow } from './types';

export type WalletEventFilter = {
  eventId: string;
  label: string;
  count: number;
};

export function buildWalletEventFilters(
  tickets: WalletTicketRow[],
): WalletEventFilter[] {
  const byEvent = new Map<string, WalletEventFilter>();
  for (const ticket of tickets) {
    const existing = byEvent.get(ticket.eventId);
    const label =
      ticket.eventName?.trim() ||
      `Sự kiện ${ticket.eventId.slice(0, 8)}…`;
    if (existing) {
      existing.count += 1;
      continue;
    }
    byEvent.set(ticket.eventId, {
      eventId: ticket.eventId,
      label,
      count: 1,
    });
  }
  return [...byEvent.values()].sort((a, b) =>
    a.label.localeCompare(b.label, 'vi'),
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
            {filter.label}
            <span className={attendeeWalletFilterCount}>{filter.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
