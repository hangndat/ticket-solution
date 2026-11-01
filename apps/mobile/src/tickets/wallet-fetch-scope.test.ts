import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  WALLET_OWNER_CACHE_SCOPE,
  WALLET_OWNER_SESSION_SCOPE,
  groupTicketsByTenantId,
  meTicketsFetchScopeKey,
  normalizeMeTicketsFetchScope,
  walletDisplayCacheScope,
  walletFetchScopeFromEnv,
  walletSessionScope,
} from './wallet-fetch-scope.ts';

/** Object.is-based dep compare — same contract as React useCallback/useEffect. */
function depsChanged(prev: unknown[], next: unknown[]): boolean {
  if (prev.length !== next.length) return true;
  return prev.some((value, index) => !Object.is(value, next[index]));
}

const ticketA = {
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

const ticketB = {
  ...ticketA,
  ticketId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  tenantId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
};

test('walletFetchScopeFromEnv uses owner when EXPO_PUBLIC_TENANT_ID unset', () => {
  const previous = process.env.EXPO_PUBLIC_TENANT_ID;
  delete process.env.EXPO_PUBLIC_TENANT_ID;
  assert.deepEqual(walletFetchScopeFromEnv(), { kind: 'owner' });
  if (previous === undefined) delete process.env.EXPO_PUBLIC_TENANT_ID;
  else process.env.EXPO_PUBLIC_TENANT_ID = previous;
});

test('walletFetchScopeFromEnv allocates a new object each call (#610 hazard)', () => {
  const previous = process.env.EXPO_PUBLIC_TENANT_ID;
  delete process.env.EXPO_PUBLIC_TENANT_ID;
  const a = walletFetchScopeFromEnv();
  const b = walletFetchScopeFromEnv();
  assert.deepEqual(a, b);
  assert.notEqual(a, b);
  if (previous === undefined) delete process.env.EXPO_PUBLIC_TENANT_ID;
  else process.env.EXPO_PUBLIC_TENANT_ID = previous;
});

test('meTicketsFetchScopeKey is stable across fresh scope objects (#610)', () => {
  const previous = process.env.EXPO_PUBLIC_TENANT_ID;
  delete process.env.EXPO_PUBLIC_TENANT_ID;
  const userId = 'user-1';
  const sessionScope = WALLET_OWNER_SESSION_SCOPE;
  const cacheScope = WALLET_OWNER_CACHE_SCOPE;

  let objectDepChanges = 0;
  let keyDepChanges = 0;
  let prevObjectDeps: unknown[] | null = null;
  let prevKeyDeps: unknown[] | null = null;

  // Simulate VerifiedWallet re-renders that re-call walletFetchScopeFromEnv().
  for (let render = 0; render < 5; render += 1) {
    const fetchScope = walletFetchScopeFromEnv();
    const objectDeps = [cacheScope, fetchScope, sessionScope, userId];
    const keyDeps = [
      cacheScope,
      meTicketsFetchScopeKey(fetchScope),
      sessionScope,
      userId,
    ];
    if (prevObjectDeps && depsChanged(prevObjectDeps, objectDeps)) {
      objectDepChanges += 1;
    }
    if (prevKeyDeps && depsChanged(prevKeyDeps, keyDeps)) {
      keyDepChanges += 1;
    }
    prevObjectDeps = objectDeps;
    prevKeyDeps = keyDeps;
  }

  assert.equal(objectDepChanges, 4, 'raw object in deps thrash every re-render');
  assert.equal(keyDepChanges, 0, 'value key keeps refresh deps stable');
  assert.equal(meTicketsFetchScopeKey({ kind: 'owner' }), 'owner');
  assert.equal(
    meTicketsFetchScopeKey({ kind: 'tenant', tenantId: ticketA.tenantId }),
    `tenant:${ticketA.tenantId}`,
  );

  if (previous === undefined) delete process.env.EXPO_PUBLIC_TENANT_ID;
  else process.env.EXPO_PUBLIC_TENANT_ID = previous;
});

test('wallet session and cache scopes distinguish owner vs tenant filter', () => {
  const tenant = { kind: 'tenant' as const, tenantId: ticketA.tenantId };
  assert.equal(walletSessionScope(tenant), ticketA.tenantId);
  assert.equal(walletDisplayCacheScope(tenant), ticketA.tenantId);
  assert.equal(walletSessionScope({ kind: 'owner' }), WALLET_OWNER_SESSION_SCOPE);
  assert.equal(
    walletDisplayCacheScope({ kind: 'owner' }),
    WALLET_OWNER_CACHE_SCOPE,
  );
});

test('normalizeMeTicketsFetchScope rejects empty tenant filter', () => {
  assert.equal(normalizeMeTicketsFetchScope(''), null);
  assert.equal(normalizeMeTicketsFetchScope('  '), null);
  assert.deepEqual(normalizeMeTicketsFetchScope(ticketA.tenantId), {
    kind: 'tenant',
    tenantId: ticketA.tenantId,
  });
});

test('groupTicketsByTenantId groups rows without inventing tenant ids', () => {
  const grouped = groupTicketsByTenantId([ticketA, ticketB, ticketA]);
  assert.equal(grouped.size, 2);
  assert.equal(grouped.get(ticketA.tenantId)?.length, 2);
  assert.equal(grouped.get(ticketB.tenantId)?.length, 1);
});
