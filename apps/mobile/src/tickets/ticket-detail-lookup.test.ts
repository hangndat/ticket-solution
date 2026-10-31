import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  WALLET_OWNER_CACHE_SCOPE,
  WALLET_OWNER_SESSION_SCOPE,
} from './wallet-fetch-scope.ts';
import {
  findOwnedTicket,
  normalizeTicketRouteId,
  ticketDetailFromMeTicketsProbe,
  ticketDetailVerifiedScopes,
} from './ticket-detail-lookup.ts';

const hoiAn = {
  ticketId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  eventId: '33333333-3333-4333-8333-333333333333',
  ticketTypeId: '44444444-4444-4444-8444-444444444444',
  sourceId: '55555555-5555-4555-8555-555555555555',
  state: 'ACTIVE',
  credentialVersion: 1,
  createdAt: '2026-10-28T00:00:00.000Z',
};

test('normalizeTicketRouteId unwraps array and decodeURIComponent', () => {
  assert.equal(normalizeTicketRouteId(undefined), undefined);
  assert.equal(normalizeTicketRouteId(''), undefined);
  assert.equal(normalizeTicketRouteId(['  ', hoiAn.ticketId]), undefined);
  assert.equal(normalizeTicketRouteId([hoiAn.ticketId]), hoiAn.ticketId);
  assert.equal(
    normalizeTicketRouteId(encodeURIComponent(hoiAn.ticketId)),
    hoiAn.ticketId,
  );
});

test('findOwnedTicket matches ticketId only, not source/redemption id', () => {
  assert.equal(findOwnedTicket([hoiAn], hoiAn.sourceId), null);
  assert.deepEqual(findOwnedTicket([hoiAn], hoiAn.ticketId), hoiAn);
});

test('verified owner-wide detail uses list session/cache keys, not last bind tenant', () => {
  const scopes = ticketDetailVerifiedScopes({ kind: 'owner' });
  assert.equal(scopes.sessionScope, WALLET_OWNER_SESSION_SCOPE);
  assert.equal(scopes.cacheScope, WALLET_OWNER_CACHE_SCOPE);
  const boundOtherTenant = '99999999-9999-4999-8999-999999999999';
  assert.notEqual(scopes.sessionScope, boundOtherTenant);
  assert.notEqual(scopes.cacheScope, boundOtherTenant);
});

test('probe ok without the id is missing; probe fail is error not missing', () => {
  assert.equal(
    ticketDetailFromMeTicketsProbe(
      { status: 'ok', body: { tickets: [hoiAn] } },
      hoiAn.ticketId,
    ).status,
    'ready',
  );
  assert.equal(
    ticketDetailFromMeTicketsProbe(
      { status: 'ok', body: { tickets: [hoiAn] } },
      '99999999-9999-4999-8999-999999999999',
    ).status,
    'missing',
  );
  assert.deepEqual(
    ticketDetailFromMeTicketsProbe({ status: 'unreachable' }, hoiAn.ticketId),
    { status: 'error', reason: 'unreachable' },
  );
  assert.deepEqual(
    ticketDetailFromMeTicketsProbe({ status: 'unauthorized' }, hoiAn.ticketId),
    { status: 'error', reason: 'unauthorized' },
  );
  assert.deepEqual(
    ticketDetailFromMeTicketsProbe({ status: 'invalid' }, hoiAn.ticketId),
    { status: 'error', reason: 'invalid' },
  );
});

test('verified tenant-scoped detail keeps env tenant keys', () => {
  const tenantId = '22222222-2222-4222-8222-222222222222';
  const scopes = ticketDetailVerifiedScopes({ kind: 'tenant', tenantId });
  assert.equal(scopes.sessionScope, tenantId);
  assert.equal(scopes.cacheScope, tenantId);
});
