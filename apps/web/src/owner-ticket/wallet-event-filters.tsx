import Link from 'next/link';
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
  if (filters.length === 0) return null;

  return (
    <nav
      className="wallet-filters"
      aria-label="Lọc vé theo sự kiện"
      data-testid="wallet-event-filters"
    >
      <Link
        href="/wallet"
        className={
          activeEventId
            ? 'wallet-filter-chip'
            : 'wallet-filter-chip wallet-filter-chip--active'
        }
        aria-current={activeEventId ? undefined : 'true'}
        data-testid="wallet-filter-all"
      >
        Tất cả
        <span className="wallet-filter-chip__count">{totalCount}</span>
      </Link>
      {filters.map((filter) => {
        const active = activeEventId === filter.eventId;
        return (
          <Link
            key={filter.eventId}
            href={`/wallet?event=${encodeURIComponent(filter.eventId)}`}
            className={
              active
                ? 'wallet-filter-chip wallet-filter-chip--active'
                : 'wallet-filter-chip'
            }
            aria-current={active ? 'true' : undefined}
            data-testid={`wallet-filter-${filter.eventId}`}
          >
            {filter.label}
            <span className="wallet-filter-chip__count">{filter.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
