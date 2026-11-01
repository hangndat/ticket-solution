import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SessionEpoch } from '../identity/session-boundary.ts';
import {
  decideCacheHydrate,
  decideTicketSyncApply,
} from './ticket-sync-guard.ts';

const ticket = {
  ticketId: '11111111-1111-1111-1111-111111111111',
  tenantId: '22222222-2222-2222-2222-222222222222',
  eventId: '33333333-3333-3333-3333-333333333333',
  ticketTypeId: '44444444-4444-4444-4444-444444444444',
  sourceId: '55555555-5555-5555-5555-555555555555',
  state: 'ACTIVE',
  credentialVersion: 1,
  gateCredential: { v: 1, kind: "ticket.gate_credential", jws: "header.payload.signature" } as const,
  manualEntryCode: "ABCD-EFGH-JK",
  createdAt: '2026-10-16T00:00:00.000Z',
};

const epochA: SessionEpoch = { generation: 1, userId: 'user-a' };

test('stale epoch drops apply even when probe succeeded (A→B race)', () => {
  let current = true;
  const decision = decideTicketSyncApply({
    epoch: epochA,
    isEpochCurrent: () => {
      const ok = current;
      current = false;
      return ok;
    },
    probe: { status: 'ok', body: { tickets: [ticket] } },
    cached: null,
    expectedUserId: 'user-a',
  });
  // First check passes, second after ok path fails → stale
  assert.equal(decision.action, 'stale');
});

test('unauthorized never falls back to offline cache', () => {
  const decision = decideTicketSyncApply({
    epoch: epochA,
    isEpochCurrent: () => true,
    probe: { status: 'unauthorized' },
    cached: {
      userId: 'user-a',
      tenantId: ticket.tenantId,
      syncedAt: '2026-10-16T12:00:00.000Z',
      tickets: [ticket],
    },
    expectedUserId: 'user-a',
  });
  assert.equal(decision.action, 'unauthorized');
});

test('unauthorized with credential refresh unreachable uses offline cache (no logout)', () => {
  const decision = decideTicketSyncApply({
    epoch: epochA,
    isEpochCurrent: () => true,
    probe: { status: 'unauthorized' },
    cached: {
      userId: 'user-a',
      tenantId: ticket.tenantId,
      syncedAt: '2026-10-16T12:00:00.000Z',
      tickets: [ticket],
    },
    expectedUserId: 'user-a',
    credentialRefreshUnreachable: true,
  });
  assert.equal(decision.action, 'offline-cache');
});

test('unreachable with matching cache yields offline-cache notice', () => {
  const decision = decideTicketSyncApply({
    epoch: epochA,
    isEpochCurrent: () => true,
    probe: { status: 'unreachable' },
    cached: {
      userId: 'user-a',
      tenantId: ticket.tenantId,
      syncedAt: '2026-10-16T12:00:00.000Z',
      tickets: [ticket],
    },
    expectedUserId: 'user-a',
  });
  assert.equal(decision.action, 'offline-cache');
  if (decision.action === 'offline-cache') {
    assert.equal(decision.tickets[0]?.ticketId, ticket.ticketId);
  }
});

test('unreachable with other-user cache does not apply', () => {
  const decision = decideTicketSyncApply({
    epoch: epochA,
    isEpochCurrent: () => true,
    probe: { status: 'unreachable' },
    cached: {
      userId: 'user-b',
      tenantId: ticket.tenantId,
      syncedAt: '2026-10-16T12:00:00.000Z',
      tickets: [ticket],
    },
    expectedUserId: 'user-a',
  });
  assert.equal(decision.action, 'error');
});

test('cache hydrate rejects stale epoch and other-user cache', () => {
  assert.equal(
    decideCacheHydrate({
      epoch: epochA,
      isEpochCurrent: () => false,
      cached: {
        userId: 'user-a',
        tenantId: ticket.tenantId,
        syncedAt: '2026-10-16T12:00:00.000Z',
        tickets: [ticket],
      },
      expectedUserId: 'user-a',
    }).action,
    'stale',
  );
  assert.equal(
    decideCacheHydrate({
      epoch: epochA,
      isEpochCurrent: () => true,
      cached: {
        userId: 'user-b',
        tenantId: ticket.tenantId,
        syncedAt: '2026-10-16T12:00:00.000Z',
        tickets: [ticket],
      },
      expectedUserId: 'user-a',
    }).action,
    'skip',
  );
});
