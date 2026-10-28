import type { TicketSummary } from '@ticket/contracts';
import { ticketStateLabelVi } from '../attendee/attendee-outcome-copy.ts';
import { eventDate, findDemoEventById } from '../data/demo-events.ts';

/** Display name for wallet grouping and section headers (API name first). */
export function ticketEventDisplayName(ticket: TicketSummary): string {
  const fromApi = ticket.eventName?.trim();
  if (fromApi) return fromApi;
  const demo = findDemoEventById(ticket.eventId);
  if (demo?.name?.trim()) return demo.name.trim();
  return 'Sự kiện';
}

function isInactive(t: TicketSummary): boolean {
  return ['USED', 'EXPIRED', 'REVOKED'].includes(t.state.trim().toUpperCase());
}

export type EventTicketGroup = {
  eventId: string;
  eventName: string;
  tickets: TicketSummary[];
  /** Tickets still valid for entry (not used / expired / revoked). */
  usableCount: number;
  /** Tickets already used (gate-consumed). */
  usedCount: number;
  /** Event's own brand color when known (demo catalog), else undefined. */
  brandColor?: string;
  /** «date · venue» line when the catalog knows it; null otherwise. */
  metaLine: string | null;
};

function isUsed(t: TicketSummary): boolean {
  return t.state.trim().toUpperCase() === 'USED';
}

function finishGroup(g: EventTicketGroup): EventTicketGroup {
  const demo = findDemoEventById(g.eventId);
  const parts = demo
    ? [eventDate(demo), demo.location?.trim() || null].filter(Boolean)
    : [];
  return {
    ...g,
    tickets: sortTicketsActiveFirst(g.tickets),
    usableCount: g.tickets.filter((t) => !isInactive(t)).length,
    usedCount: g.tickets.filter(isUsed).length,
    brandColor: demo?.brand.primaryColor,
    metaLine: parts.length ? parts.join(' · ') : null,
  };
}

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
        usableCount: 0,
        usedCount: 0,
        metaLine: null,
      });
    }
  }
  const groups = [...map.values()].map(finishGroup);
  const allDone = (g: EventTicketGroup) =>
    g.tickets.every(isInactive);
  return groups.sort(
    (a, b) =>
      Number(allDone(a)) - Number(allDone(b)) ||
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

/** Valid tickets first; used / expired / revoked sink (stable within each band). */
export function sortTicketsActiveFirst(tickets: TicketSummary[]): TicketSummary[] {
  const rank = (t: TicketSummary) => (isInactive(t) ? 1 : 0);
  return tickets
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i)
    .map(({ t }) => t);
}

/** Card title under an event section header: short ticket code, not the event again. */
export function walletTicketCardTitle(ticket: TicketSummary): string {
  return `Vé · ${ticket.ticketId.slice(0, 8).toUpperCase()}`;
}

/** Deep, white-text-safe identity hues for events that ship no brand color. */
const EVENT_IDENTITY_PALETTE = [
  '#245B47',
  '#59428A',
  '#8A3B2E',
  '#1F5A7A',
  '#7A5A12',
  '#8A2F5E',
] as const;

/** Stable per-event accent: the event's own brand color, else a hash of its id. */
export function eventIdentityColor(
  eventId: string,
  brandColor?: string | null,
): string {
  const own = brandColor?.trim();
  if (own && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(own)) return own;
  let h = 0;
  for (let i = 0; i < eventId.length; i += 1) {
    h = (h * 31 + eventId.charCodeAt(i)) >>> 0;
  }
  return EVENT_IDENTITY_PALETTE[h % EVENT_IDENTITY_PALETTE.length];
}

/** One-letter monogram for the identity block. */
export function eventInitial(eventName: string): string {
  const ch = [...eventName.trim()][0];
  return ch ? ch.toLocaleUpperCase('vi') : 'S';
}

export type WalletTicketTone = 'usable' | 'used' | 'inactive' | 'sync' | 'pending';

export type WalletTicketStatus = { tone: WalletTicketTone; label: string };

/** List-row status chip: green usable, grey used/inactive, amber when shown offline. */
export function walletTicketStatus(
  ticket: TicketSummary,
  opts: { offline?: boolean } = {},
): WalletTicketStatus {
  const state = ticket.state.trim().toUpperCase();
  if (state === 'ACTIVE') {
    return opts.offline
      ? { tone: 'sync', label: 'Hợp lệ · offline' }
      : { tone: 'usable', label: 'Hợp lệ' };
  }
  if (state === 'USED') return { tone: 'used', label: 'Đã sử dụng' };
  if (state === 'EXPIRED') return { tone: 'inactive', label: 'Hết hạn' };
  if (state === 'REVOKED') return { tone: 'inactive', label: 'Đã thu hồi' };
  return { tone: 'pending', label: ticketStateLabelVi(ticket.state) };
}

/** Count chip text, e.g. «2 vé». */
export function walletGroupCountChip(count: number): string {
  return `${count} vé`;
}

/** Only when it adds info: some (not all, not none) tickets are usable. */
export function walletGroupSummary(g: EventTicketGroup): string | null {
  if (g.tickets.length < 2 || g.usableCount === g.tickets.length) return null;
  if (g.usableCount === 0) return 'Tất cả vé đã dùng hoặc hết hiệu lực';
  return `${g.usableCount} vé còn dùng được`;
}

export function walletGroupA11yLabel(g: EventTicketGroup): string {
  const summary = walletGroupSummary(g);
  return [g.eventName, g.metaLine, walletGroupCountChip(g.tickets.length), summary]
    .filter(Boolean)
    .join(', ');
}

export function walletTicketA11yLabel(
  eventName: string,
  ticket: TicketSummary,
  status: WalletTicketStatus,
): string {
  return `${eventName}, ${walletTicketCardTitle(ticket)}, ${status.label}, mở vé`;
}
