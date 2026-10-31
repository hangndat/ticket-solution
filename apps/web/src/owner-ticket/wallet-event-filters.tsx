'use client';

import Link from 'next/link';
import { useAttendeeLocale } from '../i18n';
import { walletCopy } from './types';
import {
  attendeeWalletFilterChip,
  attendeeWalletFilterCount,
  attendeeWalletFilters,
} from '../attendee-detail-surface';
import { walletEventFilterLabel, type WalletEventFilter } from './wallet-event-filter-data';

export { buildWalletEventFilters, walletEventFilterLabel } from './wallet-event-filter-data';

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
        prefetch={false}
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
            prefetch={false}
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
