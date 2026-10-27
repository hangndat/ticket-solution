import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TicketSummary } from '@ticket/contracts';
import { applyIssuedWalletRefresh } from './apply-issued-wallet-refresh.ts';
import { ticketDetailHref } from './ticket-detail-href.ts';
import { WALLET_OWNER_SESSION_SCOPE } from './wallet-fetch-scope.ts';

const hoiAn: TicketSummary = {
  ticketId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  eventId: '33333333-3333-4333-8333-333333333333',
  ticketTypeId: '44444444-4444-4444-8444-444444444444',
  sourceId: '55555555-5555-4555-8555-555555555555',
  state: 'ACTIVE',
  credentialVersion: 1,
  createdAt: '2026-10-28T00:00:00.000Z',
};

test('ticketDetailHref opens ví detail, not the list-only route', () => {
  assert.equal(
    ticketDetailHref(hoiAn.ticketId),
    `/my-tickets/${hoiAn.ticketId}`,
  );
  assert.notEqual(ticketDetailHref(hoiAn.ticketId), '/my-tickets');
});

test('applyIssuedWalletRefresh writes session + durable cache on probe ok', async () => {
  let loaded: TicketSummary[] | null = null;
  let persisted = false;
  const ok = await applyIssuedWalletRefresh({
    userId: 'user-1',
    fetchScope: { kind: 'owner' },
    probe: { status: 'ok', body: { tickets: [hoiAn] } },
    load: async (scope, resource, loader) => {
      assert.equal(scope, WALLET_OWNER_SESSION_SCOPE);
      assert.equal(resource, 'me-tickets');
      loaded = await loader();
      return true;
    },
    persist: async () => {
      persisted = true;
      return true;
    },
    nowIso: '2026-10-28T01:00:00.000Z',
    writeEpoch: 1,
  });
  assert.equal(ok, true);
  assert.deepEqual(loaded, [hoiAn]);
  assert.equal(persisted, true);
});

test('applyIssuedWalletRefresh does not invent tickets when probe fails', async () => {
  let loadCalled = false;
  const ok = await applyIssuedWalletRefresh({
    userId: 'user-1',
    fetchScope: { kind: 'owner' },
    probe: { status: 'unreachable' },
    load: async () => {
      loadCalled = true;
      return true;
    },
    persist: async () => true,
    nowIso: '2026-10-28T01:00:00.000Z',
    writeEpoch: 1,
  });
  assert.equal(ok, false);
  assert.equal(loadCalled, false);
});
