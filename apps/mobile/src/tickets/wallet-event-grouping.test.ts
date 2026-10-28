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

import { sortTicketsActiveFirst, walletTicketCardTitle } from './wallet-event-grouping.ts';

test('sortTicketsActiveFirst sinks used tickets, stable otherwise', () => {
  const mk = (id: string, state: string) =>
    ({ ticketId: id, state, eventId: 'e', tenantId: 't', ticketTypeId: 'x', sourceId: 's', credentialVersion: 1, createdAt: '' }) as never;
  const out = sortTicketsActiveFirst([mk('a', 'USED'), mk('b', 'ACTIVE'), mk('c', 'ACTIVE')]);
  assert.deepEqual(out.map((t: { ticketId: string }) => t.ticketId), ['b', 'c', 'a']);
  assert.equal(walletTicketCardTitle(mk('abcdef123456', 'ACTIVE')), 'Vé · ABCDEF12');
});
