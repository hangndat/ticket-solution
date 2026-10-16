import * as SecureStore from 'expo-secure-store';
import type { TicketDisplayCache } from './display-cache-types.ts';
import { parseTicketDisplayCacheJson } from './display-cache-parse.ts';

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

/** Persist minimal TicketSummary[] for offline display (not offline check-in). */
export async function writeTicketDisplayCache(
  cache: TicketDisplayCache,
): Promise<void> {
  await SecureStore.setItemAsync(
    cacheKey(cache.userId, cache.tenantId),
    JSON.stringify(cache),
    options,
  );
}

export async function clearTicketDisplayCache(
  userId: string,
  tenantId: string,
): Promise<void> {
  await SecureStore.deleteItemAsync(cacheKey(userId, tenantId), options);
}
