import * as SecureStore from 'expo-secure-store';
import type { TicketDisplayCache } from './display-cache-types.ts';
import { parseTicketDisplayCacheJson } from './display-cache-parse.ts';
import { ticketDisplayWriteGate } from './durable-write-gate.ts';

export type { TicketDisplayCache } from './display-cache-types.ts';
export {
  parseTicketDisplayCacheJson,
  ticketDisplayCacheMatchesIdentity,
} from './display-cache-parse.ts';

const options: SecureStore.SecureStoreOptions = {
  keychainService: 'ticket-foundation.ticket-display',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function cacheKey(userId: string, tenantId: string): string {
  return `ticket.display.v1.${userId}.${tenantId}`;
}

export function currentTicketDisplayWriteEpoch(): number {
  return ticketDisplayWriteGate.current();
}

/** Bump before logout/account-switch clears so late writes cannot resurrect cache. */
export function invalidateTicketDisplayWrites(): number {
  return ticketDisplayWriteGate.invalidate();
}

/** Read offline display cache; rejects entries that do not match the verified user. */
export async function readTicketDisplayCache(
  userId: string,
  tenantId: string,
): Promise<TicketDisplayCache | null> {
  const raw = await SecureStore.getItemAsync(cacheKey(userId, tenantId), options);
  const parsed = parseTicketDisplayCacheJson(raw);
  if (!parsed) return null;
  if (parsed.userId !== userId || parsed.tenantId !== tenantId) return null;
  return parsed;
}

/**
 * Persist minimal TicketSummary[] for offline display (not offline check-in).
 * Returns false when the write epoch was invalidated before or after the
 * SecureStore write — and deletes the per-user key if our late write landed.
 * Per-user keys mean deleting A never removes B's cache entry.
 */
export async function writeTicketDisplayCache(
  cache: TicketDisplayCache,
  writeEpoch: number = ticketDisplayWriteGate.current(),
): Promise<boolean> {
  if (!ticketDisplayWriteGate.isCurrent(writeEpoch)) return false;
  await SecureStore.setItemAsync(
    cacheKey(cache.userId, cache.tenantId),
    JSON.stringify(cache),
    options,
  );
  if (!ticketDisplayWriteGate.isCurrent(writeEpoch)) {
    await SecureStore.deleteItemAsync(
      cacheKey(cache.userId, cache.tenantId),
      options,
    );
    return false;
  }
  return true;
}

export async function clearTicketDisplayCache(
  userId: string,
  tenantId: string,
): Promise<void> {
  await SecureStore.deleteItemAsync(cacheKey(userId, tenantId), options);
}
