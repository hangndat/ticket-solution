import type { TicketSummary } from '@ticket/contracts';
import {
  type MeTicketsFetchScope,
  walletDisplayCacheScope,
  walletSessionScope,
} from './wallet-fetch-scope.ts';

/** Expo Router may pass a dynamic segment as `string | string[]`. */
export function normalizeTicketRouteId(
  raw: string | string[] | undefined,
): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    const decoded = decodeURIComponent(trimmed).trim();
    return decoded.length > 0 ? decoded : undefined;
  } catch {
    return trimmed;
  }
}

export function findOwnedTicket(
  tickets: TicketSummary[] | null | undefined,
  ticketId: string,
): TicketSummary | null {
  if (!tickets || tickets.length === 0) return null;
  return tickets.find((row) => row.ticketId === ticketId) ?? null;
}

export function ticketDetailVerifiedScopes(fetchScope: MeTicketsFetchScope): {
  sessionScope: string;
  cacheScope: string;
} {
  return {
    sessionScope: walletSessionScope(fetchScope),
    cacheScope: walletDisplayCacheScope(fetchScope),
  };
}
