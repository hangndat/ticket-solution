import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TicketDisplayCache } from './display-cache-types.ts';
import { WALLET_OWNER_CACHE_SCOPE } from './wallet-fetch-scope.ts';
import { clearWalletLogoutCaches } from './wallet-logout-cache.ts';

const key = (userId: string, scope: string) => `${userId}:${scope}`;
const aggregate = (userId: string, tenantIds: string[]): TicketDisplayCache => ({
  userId,
  tenantId: WALLET_OWNER_CACHE_SCOPE,
  syncedAt: '2026-11-07T00:00:00Z',
  tickets: tenantIds.map((tenantId) => ({ tenantId }) as TicketDisplayCache['tickets'][number]),
});

test('Account logout without wallet scope clears owner aggregate and its tenant slices for that owner only', async () => {
  const bytes = new Map<string, TicketDisplayCache>([
    [key('alice', WALLET_OWNER_CACHE_SCOPE), aggregate('alice', ['tenant-1', 'tenant-2'])],
    [key('alice', 'tenant-1'), aggregate('alice', [])],
    [key('alice', 'tenant-2'), aggregate('alice', [])],
    [key('bob', WALLET_OWNER_CACHE_SCOPE), aggregate('bob', ['tenant-1'])],
    [key('bob', 'tenant-1'), aggregate('bob', [])],
  ]);
  const cleared: string[] = [];
  await clearWalletLogoutCaches({ userId: 'alice' }, {
    read: async (userId, scope) => bytes.get(key(userId, scope)) ?? null,
    clear: async (userId, scope) => {
      cleared.push(key(userId, scope));
      bytes.delete(key(userId, scope));
    },
  });
  assert.deepEqual(cleared, [
    key('alice', WALLET_OWNER_CACHE_SCOPE),
    key('alice', 'tenant-1'),
    key('alice', 'tenant-2'),
  ]);
  assert.equal(bytes.has(key('bob', WALLET_OWNER_CACHE_SCOPE)), true);
  assert.equal(bytes.has(key('bob', 'tenant-1')), true);
});

test('logout clears explicit tenant cache without an owner aggregate and deduplicates known scopes', async () => {
  const cleared: string[] = [];
  await clearWalletLogoutCaches({
    userId: 'alice',
    tenantId: 'tenant-1',
    walletScope: { kind: 'tenant', tenantId: 'tenant-1' },
    ticketTenantIds: ['tenant-1', ' tenant-2 ', ''],
  }, {
    read: async () => null,
    clear: async (userId, scope) => { cleared.push(key(userId, scope)); },
  });
  assert.deepEqual(cleared, [
    key('alice', WALLET_OWNER_CACHE_SCOPE),
    key('alice', 'tenant-1'),
    key('alice', 'tenant-2'),
  ]);
});

test('read and delete failures still attempt every known key and fail logout', async () => {
  const cleared: string[] = [];
  await assert.rejects(clearWalletLogoutCaches({
    userId: 'alice', tenantId: 'tenant-1',
  }, {
    read: async () => { throw new Error('read failed'); },
    clear: async (userId, scope) => {
      cleared.push(key(userId, scope));
      if (scope === WALLET_OWNER_CACHE_SCOPE) throw new Error('delete failed');
    },
  }), /Chưa xóa hết dữ liệu vé/);
  assert.deepEqual(cleared, [key('alice', WALLET_OWNER_CACHE_SCOPE), key('alice', 'tenant-1')]);
});
