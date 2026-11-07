import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TicketSummary } from '@ticket/contracts';
import {
  countDistinctEvents,
  countTicketsForEventId,
  filterTicketsByEventId,
  groupTicketsByEvent,
  ticketEventDisplayName,
  walletEventSectionHeader,
  walletListSubtitle,
  sortTicketsActiveFirst,
  walletTicketCardTitle,
  eventIdentityColor,
  eventInitial,
  walletGroupA11yLabel,
  walletGroupSummary,
  walletTicketA11yLabel,
  walletTicketStatus,
  walletTicketDateBucket,
  filterWalletTickets,
  groupWalletTicketsByDate,
} from './wallet-event-grouping.ts';

function ticket(
  overrides: Partial<TicketSummary> & Pick<TicketSummary, 'eventId' | 'ticketId'>,
): TicketSummary {
  return {
    tenantId: '22222222-2222-4222-8222-222222222222',
    ticketTypeId: '33333333-3333-4333-8333-333333333333',
    sourceId: '44444444-4444-4444-8444-444444444444',
    state: 'ACTIVE',
    credentialVersion: 1,
    gateCredential: { v: 1, kind: "ticket.gate_credential", jws: "header.payload.signature" } as const,
    manualEntryCode: "ABCD-EFGH-JK",
    createdAt: '2026-10-18T00:00:00.000Z',
    ...overrides,
  };
}

test('ticketEventDisplayName prefers API eventName over demo catalog', () => {
  const row = ticket({
    ticketId: '11111111-1111-4111-8111-111111111111',
    eventId: 'demo-mfest',
    eventName: 'Sự kiện thật từ API',
  });
  assert.equal(ticketEventDisplayName(row), 'Sự kiện thật từ API');
});

test('wallet only uses ticket API name and does not inject demo dates or venue', () => {
  const row = ticket({ ticketId: '11111111-1111-4111-8111-111111111111', eventId: 'demo-mfest' });
  assert.equal(ticketEventDisplayName(row), 'Sự kiện');
  const [group] = groupTicketsByEvent([row]);
  assert.equal(group.metaLine, null);
  assert.equal(group.brandColor, undefined);
});

test('groupTicketsByEvent groups and counts per event', () => {
  const tickets = [
    ticket({
      ticketId: '11111111-1111-4111-8111-111111111111',
      eventId: 'evt-a',
      eventName: 'Alpha',
    }),
    ticket({
      ticketId: '22222222-2222-4222-8222-222222222222',
      eventId: 'evt-a',
      eventName: 'Alpha',
    }),
    ticket({
      ticketId: '33333333-3333-4333-8333-333333333333',
      eventId: 'evt-b',
      eventName: 'Beta',
    }),
  ];
  const groups = groupTicketsByEvent(tickets);
  assert.equal(groups.length, 2);
  const alpha = groups.find((g) => g.eventId === 'evt-a');
  assert.ok(alpha);
  assert.equal(alpha.tickets.length, 2);
  assert.equal(walletEventSectionHeader(alpha.eventName, alpha.tickets.length), 'Alpha · 2 vé');
});

test('filter and aggregate helpers', () => {
  const tickets = [
    ticket({
      ticketId: '11111111-1111-4111-8111-111111111111',
      eventId: 'evt-a',
    }),
    ticket({
      ticketId: '22222222-2222-4222-8222-222222222222',
      eventId: 'evt-b',
    }),
  ];
  assert.equal(countDistinctEvents(tickets), 2);
  assert.equal(walletListSubtitle(2, 2), '2 vé · 2 sự kiện');
  assert.equal(countTicketsForEventId(tickets, 'evt-a'), 1);
  assert.equal(filterTicketsByEventId(tickets, 'evt-b').length, 1);
  assert.equal(filterTicketsByEventId(tickets, '').length, 2);
});

test('wallet date filters use only valid startsAt, never ACTIVE state as a date', () => {
  const now = Date.parse('2026-11-07T00:00:00Z');
  const upcoming = T('upcoming', 'evt-a', 'ACTIVE', 'Alpha');
  upcoming.startsAt = '2026-11-08T19:00:00+07:00';
  const past = T('past', 'evt-a', 'ACTIVE', 'Alpha');
  past.startsAt = '2026-11-06T19:00:00+07:00';
  const undated = T('undated', 'evt-a', 'ACTIVE', 'Alpha');
  const malformed = T('bad', 'evt-b', 'USED', 'Beta');
  malformed.startsAt = 'not-a-date';
  assert.equal(walletTicketDateBucket(upcoming, now), 'upcoming');
  assert.equal(walletTicketDateBucket(past, now), 'past');
  assert.equal(walletTicketDateBucket(undated, now), 'undated');
  assert.deepEqual(filterWalletTickets([upcoming, past, undated, malformed], 'upcoming', now), [upcoming]);
  assert.deepEqual(filterWalletTickets([upcoming, past, undated, malformed], 'past', now), [past]);
  assert.equal(filterWalletTickets([upcoming, past, undated, malformed], 'all', now).length, 4);
  assert.deepEqual(groupWalletTicketsByDate([past, upcoming, undated], now).map((g) => g.tickets[0]?.ticketId), [past.ticketId, upcoming.ticketId, undated.ticketId]);
});


test('sortTicketsActiveFirst sinks used tickets, stable otherwise', () => {
  const mk = (id: string, state: string) =>
    ({ ticketId: id, state, eventId: 'e', tenantId: 't', ticketTypeId: 'x', sourceId: 's', credentialVersion: 1, createdAt: '' }) as never;
  const out = sortTicketsActiveFirst([mk('a', 'USED'), mk('b', 'ACTIVE'), mk('c', 'ACTIVE')]);
  assert.deepEqual(out.map((t: { ticketId: string }) => t.ticketId), ['b', 'c', 'a']);
  assert.equal(walletTicketCardTitle(mk('abcdef123456', 'ACTIVE')), 'Vé · ABCDEF12');
});


const T = (id: string, eventId: string, state: string, eventName?: string) =>
  ticket({ ticketId: id.padEnd(36, '0'), eventId, state, eventName });

test('2 tickets, 1 used: usable first, counts, summary, statuses', () => {
  const [g] = groupTicketsByEvent([
    T('aaaa1111', 'evt-a', 'USED', 'Alpha'),
    T('bbbb2222', 'evt-a', 'ACTIVE', 'Alpha'),
  ]);
  assert.deepEqual(g.tickets.map((t) => t.state), ['ACTIVE', 'USED']);
  assert.equal(g.usableCount, 1);
  assert.equal(g.usedCount, 1);
  assert.equal(walletGroupSummary(g), '1 vé còn dùng được');
  assert.equal(walletTicketStatus(g.tickets[0]).label, 'Hợp lệ');
  assert.equal(walletTicketStatus(g.tickets[0]).tone, 'usable');
  assert.deepEqual(walletTicketStatus(g.tickets[1]), { tone: 'used', label: 'Đã sử dụng' });
  assert.equal(walletTicketStatus(g.tickets[0], { offline: true }).tone, 'sync');
  assert.equal(
    walletGroupA11yLabel(g),
    'Alpha, 2 vé, 1 vé còn dùng được',
  );
  assert.equal(
    walletTicketA11yLabel(g.eventName, g.tickets[1], walletTicketStatus(g.tickets[1])),
    'Alpha, Vé · AAAA1111, Đã sử dụng, mở vé',
  );
});

test('2 events, 1 ticket each: no summary, distinct identity colors/initials', () => {
  const groups = groupTicketsByEvent([
    T('aaaa1111', 'demo-mfest', 'ACTIVE'),
    T('bbbb2222', 'demo-studio-night', 'ACTIVE'),
  ]);
  assert.equal(groups.length, 2);
  for (const g of groups) assert.equal(walletGroupSummary(g), null);
  const colors = groups.map((g) => eventIdentityColor(g.eventId, g.brandColor));
  assert.ok(colors.every((color) => /^#[0-9A-F]{6}$/i.test(color)));
  assert.ok(groups.every((g) => g.metaLine === null));
});

test('events without brand color get a stable palette color', () => {
  assert.equal(eventIdentityColor('evt-x'), eventIdentityColor('evt-x'));
  assert.equal(eventIdentityColor('evt-x', 'not-a-color'), eventIdentityColor('evt-x'));
  assert.equal(eventIdentityColor('evt-x', '#112233'), '#112233');
  assert.equal(eventInitial('  đêm nhạc'), 'Đ');
  assert.equal(eventInitial(''), 'S');
});

test('10 tickets across 3 events: all-used group sinks and summarises', () => {
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => T(`a${i}`, 'evt-a', i < 2 ? 'USED' : 'ACTIVE', 'Alpha')),
    ...Array.from({ length: 3 }, (_, i) => T(`b${i}`, 'evt-b', 'USED', 'Beta')),
    T('c0', 'evt-c', 'ACTIVE', 'Gamma'),
  ];
  const groups = groupTicketsByEvent(rows);
  assert.deepEqual(groups.map((g) => g.eventName), ['Alpha', 'Gamma', 'Beta']);
  assert.equal(groups[0].usableCount, 4);
  assert.equal(walletGroupSummary(groups[0]), '4 vé còn dùng được');
  assert.equal(walletGroupSummary(groups[2]), 'Tất cả vé đã dùng hoặc hết hiệu lực');
});
