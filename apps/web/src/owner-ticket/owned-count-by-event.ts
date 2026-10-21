import type { WalletTicketRow } from './types';

/** Ticket counts per eventId for catalog owned strip (full wallet, not paginated). */
export function ownedTicketCountByEventId(
  tickets: readonly WalletTicketRow[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ticket of tickets) {
    const id = ticket.eventId?.trim();
    if (!id) continue;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}
