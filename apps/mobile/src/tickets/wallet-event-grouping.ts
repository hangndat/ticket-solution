import type { TicketSummary } from '@ticket/contracts';
import { findDemoEventById } from '../data/demo-events.ts';

/** Display name for wallet grouping and section headers (API name first). */
export function ticketEventDisplayName(ticket: TicketSummary): string {
  const fromApi = ticket.eventName?.trim();
  if (fromApi) return fromApi;
  const demo = findDemoEventById(ticket.eventId);
  if (demo?.name?.trim()) return demo.name.trim();
  return 'Sự kiện';
}

export type EventTicketGroup = {
  eventId: string;
  eventName: string;
  tickets: TicketSummary[];
};

export function groupTicketsByEvent(tickets: TicketSummary[]): EventTicketGroup[] {
  const map = new Map<string, EventTicketGroup>();
  for (const ticket of tickets) {
    const existing = map.get(ticket.eventId);
    if (existing) {
      existing.tickets.push(ticket);
      const apiName = ticket.eventName?.trim();
      if (apiName) existing.eventName = apiName;
    } else {
      map.set(ticket.eventId, {
        eventId: ticket.eventId,
        eventName: ticketEventDisplayName(ticket),
        tickets: [ticket],
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.eventName.localeCompare(b.eventName, 'vi'),
  );
}

export function countDistinctEvents(tickets: TicketSummary[]): number {
  return new Set(tickets.map((row) => row.eventId)).size;
}

export function filterTicketsByEventId(
  tickets: TicketSummary[],
  eventId: string | undefined | null,
): TicketSummary[] {
  const id = eventId?.trim();
  if (!id) return tickets;
  return tickets.filter((row) => row.eventId === id);
}

export function countTicketsForEventId(
  tickets: TicketSummary[],
  eventId: string,
): number {
  return tickets.filter((row) => row.eventId === eventId).length;
}

export function walletListSubtitle(
  ticketCount: number,
  eventCount: number,
): string {
  return `${ticketCount} vé · ${eventCount} sự kiện`;
}

export function walletEventSectionHeader(
  eventName: string,
  ticketCount: number,
): string {
  return `${eventName} · ${ticketCount} vé`;
}

export function resolveWalletFilterEventName(
  tickets: TicketSummary[],
  eventId: string,
): string {
  const match = tickets.find((row) => row.eventId === eventId);
  return match ? ticketEventDisplayName(match) : 'Sự kiện';
}
