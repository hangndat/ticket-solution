import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseTicketDisplayCacheJson,
  ticketDisplayCacheMatchesIdentity,
} from './display-cache-parse.ts';
import { buildDisplayQrPayload } from './display-payload.ts';
import { encodeQrModules } from './qr-matrix.ts';

const ticket = {
  ticketId: '11111111-1111-1111-1111-111111111111',
  tenantId: '22222222-2222-2222-2222-222222222222',
  eventId: '33333333-3333-3333-3333-333333333333',
  ticketTypeId: '44444444-4444-4444-4444-444444444444',
  sourceId: '55555555-5555-5555-5555-555555555555',
  state: 'ACTIVE',
  credentialVersion: 1,
  createdAt: '2026-10-16T00:00:00.000Z',
};

test('display cache JSON rejects other users and malformed payloads', () => {
  const ok = {
    userId: 'user-a',
    tenantId: ticket.tenantId,
    syncedAt: '2026-10-16T12:00:00.000Z',
    tickets: [ticket],
  };
  const parsed = parseTicketDisplayCacheJson(JSON.stringify(ok));
  assert.ok(parsed);
  assert.equal(
    ticketDisplayCacheMatchesIdentity(parsed, 'user-a', ticket.tenantId),
    true,
  );
  assert.equal(
    ticketDisplayCacheMatchesIdentity(parsed, 'user-b', ticket.tenantId),
    false,
  );
  assert.equal(parseTicketDisplayCacheJson('{"tickets":[]}'), null);
  assert.equal(parseTicketDisplayCacheJson(null), null);
});

test('display QR payload is TicketSummary fields, not a forged JWS', () => {
  const payload = buildDisplayQrPayload(ticket);
  const parsed = JSON.parse(payload) as Record<string, unknown>;
  assert.equal(parsed.kind, 'ticket.display');
  assert.equal(parsed.ticketId, ticket.ticketId);
  assert.equal(parsed.credentialVersion, 1);
  // Compact JWS is three base64url segments; display payload is JSON.
  assert.equal(payload.split('.').length === 3 && !payload.startsWith('{'), false);
  assert.equal(payload.startsWith('{'), true);
});

test('QR matrix encodes display payload without inventing modules', () => {
  const modules = encodeQrModules(buildDisplayQrPayload(ticket));
  assert.ok(modules.length >= 21);
  assert.equal(modules.length, modules[0]?.length);
  assert.ok(modules.some((row) => row.some(Boolean)));
});
