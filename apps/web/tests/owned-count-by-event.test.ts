import assert from 'node:assert/strict';
import test from 'node:test';
import { ownedTicketCountByEventId } from '../src/owner-ticket/owned-count-by-event';

test('ownedTicketCountByEventId aggregates by eventId', () => {
  const counts = ownedTicketCountByEventId([
    {
      ticketId: 'a',
      tenantId: 't',
      eventId: 'e1',
      ticketTypeId: 'tt',
      sourceId: 's',
      state: 'ISSUED',
      credentialVersion: 1,
      createdAt: '2026-01-01',
    },
    {
      ticketId: 'b',
      tenantId: 't',
      eventId: 'e1',
      ticketTypeId: 'tt',
      sourceId: 's',
      state: 'ISSUED',
      credentialVersion: 1,
      createdAt: '2026-01-01',
    },
    {
      ticketId: 'c',
      tenantId: 't',
      eventId: 'e2',
      ticketTypeId: 'tt',
      sourceId: 's',
      state: 'ISSUED',
      credentialVersion: 1,
      createdAt: '2026-01-01',
    },
  ]);
  assert.deepEqual(counts, { e1: 2, e2: 1 });
});
