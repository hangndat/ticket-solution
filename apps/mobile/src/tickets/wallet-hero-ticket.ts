import type { TicketSummary } from '@ticket/contracts';
import { ownerEventTimezone } from './owner-metadata.ts';

/** Old offline caches may omit the event start. Never use ticket creation time. */
export function walletEventStartMs(startsAt: string | null | undefined): number | null {
  if (typeof startsAt !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.exec(startsAt);
  if (!match) return null;
  const [, year, month, day] = match;
  const calendarDay = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    calendarDay.getUTCFullYear() !== Number(year) ||
    calendarDay.getUTCMonth() + 1 !== Number(month) ||
    calendarDay.getUTCDate() !== Number(day)
  ) return null;
  const value = Date.parse(startsAt);
  return Number.isFinite(value) ? value : null;
}

/** Earliest upcoming usable event, otherwise the most recently started one. */
export function selectHeroTicket(
  tickets: TicketSummary[],
  _offline: boolean,
  nowMs = Date.now(),
): TicketSummary | null {
  let chosen: TicketSummary | null = null;
  let chosenStart = 0;
  for (const ticket of tickets) {
    if (ticket.state.trim().toUpperCase() !== 'ACTIVE') continue;
    const start = walletEventStartMs(ticket.startsAt);
    if (start === null) continue;
    if (
      !chosen ||
      (start >= nowMs && (chosenStart < nowMs || start < chosenStart)) ||
      (start < nowMs && chosenStart < nowMs && start > chosenStart)
    ) {
      chosen = ticket;
      chosenStart = start;
    }
  }
  return chosen;
}

export function formatWalletEventStart(ticket: TicketSummary): string | null {
  const start = walletEventStartMs(ticket.startsAt);
  if (start === null) return null;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: ownerEventTimezone(ticket) ?? undefined,
  }).format(new Date(start));
}

/** Compact clock time for rows already grouped under a date heading. */
export function formatWalletEventTime(ticket: TicketSummary): string | null {
  const start = walletEventStartMs(ticket.startsAt);
  if (start === null) return null;
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: ownerEventTimezone(ticket) ?? undefined,
  }).format(new Date(start));
}

export function walletEventTimeBasis(ticket: TicketSummary): string {
  return ownerEventTimezone(ticket) ? 'giờ sự kiện' : 'giờ thiết bị';
}
