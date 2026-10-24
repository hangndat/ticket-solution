import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readOwnerTicketDisplayCache,
  writeOwnerTicketDisplayCache,
} from '../src/owner-ticket/display-cache';

test('display cache round-trips in sessionStorage when available', () => {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  const original = globalThis.sessionStorage;
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: sessionStorage,
    configurable: true,
  });

  writeOwnerTicketDisplayCache({
    tenantId: '11111111-1111-4111-8111-111111111111',
    ticketId: '22222222-2222-4222-8222-222222222222',
    qrPayload: 'payload',
    state: 'ACTIVE',
    cachedAt: '2026-10-25T00:00:00.000Z',
  });

  const read = readOwnerTicketDisplayCache(
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  );
  assert.equal(read?.qrPayload, 'payload');

  Object.defineProperty(globalThis, 'sessionStorage', {
    value: original,
    configurable: true,
  });
});
