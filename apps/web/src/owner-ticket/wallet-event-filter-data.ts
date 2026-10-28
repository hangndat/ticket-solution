import { formatDual } from '../i18n/dual';
import {
  DEFAULT_ATTENDEE_LOCALE,
  type AttendeeLocale,
} from '../i18n/locale';
import { WALLET_COPY_CATALOG, type WalletTicketRow } from './types';

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
