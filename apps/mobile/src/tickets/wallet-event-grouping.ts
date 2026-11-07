import type { TicketSummary } from '@ticket/contracts';
import { ticketStateLabelVi } from '../attendee/attendee-outcome-copy.ts';

/** Re-export shared brand helpers so My Tickets keeps a stable import path. */
export { eventIdentityColor, eventInitial } from '../brand/event-identity.ts';

/** Display name for wallet grouping and section headers (API name first). */
export function ticketEventDisplayName(ticket: TicketSummary): string {
  const fromApi = ticket.eventName?.trim();
  if (fromApi) return fromApi;
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
  /** Published event metadata is not part of TicketSummary yet. */
  brandColor?: string;
  /** «date · venue» only when supplied by an approved real metadata source. */
  metaLine: string | null;
};

function isUsed(t: TicketSummary): boolean {
  return t.state.trim().toUpperCase() === 'USED';
}

function finishGroup(g: EventTicketGroup): EventTicketGroup {
  return {
    ...g,
    tickets: sortTicketsActiveFirst(g.tickets),
    usableCount: g.tickets.filter((t) => !isInactive(t)).length,
    usedCount: g.tickets.filter(isUsed).length,
    metaLine: null,
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

export type WalletFilter = 'upcoming' | 'all' | 'past';

/** ACTIVE is only a ticket state; date membership requires a valid startsAt. */
export function walletTicketDateBucket(
  ticket: TicketSummary,
  nowMs = Date.now(),
): 'upcoming' | 'past' | 'undated' {
  // Ticket state takes precedence over the event date: a consumed credential
  // cannot be "upcoming" even when the event metadata is future dated.
  if (isInactive(ticket)) return 'past';
  const value = ticket.startsAt;
  if (typeof value !== 'string') return 'undated';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return 'undated';
  return ms >= nowMs ? 'upcoming' : 'past';
}

export function filterWalletTickets(
  tickets: TicketSummary[],
  filter: WalletFilter,
  nowMs = Date.now(),
): TicketSummary[] {
  if (filter === 'all') return tickets;
  const bucket = filter === 'upcoming' ? 'upcoming' : 'past';
  return tickets.filter((ticket) => walletTicketDateBucket(ticket, nowMs) === bucket);
}

export function groupWalletTicketsByDate(
  tickets: TicketSummary[],
  nowMs = Date.now(),
): Array<{ key: string; label: string; tickets: TicketSummary[] }> {
  const groups = new Map<string, { key: string; label: string; tickets: TicketSummary[] }>();
  for (const ticket of tickets) {
    const bucket = walletTicketDateBucket(ticket, nowMs);
    const date = bucket === 'undated' ? null : new Date(Date.parse(ticket.startsAt!));
    const key = date
      ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
      : 'undated';
    const label = date
      ? new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'short' }).format(date)
      : 'Chưa có ngày';
    const group = groups.get(key) ?? { key, label, tickets: [] };
    group.tickets.push(ticket);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    tickets: [...group.tickets].sort((a, b) => {
      const aTime = typeof a.startsAt === 'string' ? Date.parse(a.startsAt) : Number.NaN;
      const bTime = typeof b.startsAt === 'string' ? Date.parse(b.startsAt) : Number.NaN;
      if (!Number.isFinite(aTime)) return Number.isFinite(bTime) ? 1 : a.ticketId.localeCompare(b.ticketId);
      if (!Number.isFinite(bTime)) return -1;
      return aTime - bTime;
    }),
  })).sort((a, b) => {
    if (a.key === 'undated') return 1;
    if (b.key === 'undated') return -1;
    return Date.parse(a.tickets[0]!.startsAt!) - Date.parse(b.tickets[0]!.startsAt!);
  });
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
