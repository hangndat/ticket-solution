import type { TicketSummary } from '@ticket/contracts';
import type { TicketDisplayCache } from './display-cache-types.ts';

export type { TicketDisplayCache } from './display-cache-types.ts';

function isTicketSummary(value: unknown): value is TicketSummary {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.ticketId === 'string' &&
    typeof row.tenantId === 'string' &&
    typeof row.eventId === 'string' &&
    typeof row.ticketTypeId === 'string' &&
    typeof row.sourceId === 'string' &&
    typeof row.state === 'string' &&
    typeof row.credentialVersion === 'number' &&
    typeof row.createdAt === 'string'
  );
}

/** Pure parse helper (no SecureStore) for unit tests and cache IO. */
export function parseTicketDisplayCacheJson(
  raw: string | null,
): TicketDisplayCache | null {
  if (!raw) return null;
  try {
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object') return null;
    const row = body as Record<string, unknown>;
    if (
      typeof row.userId !== 'string' ||
      typeof row.tenantId !== 'string' ||
      typeof row.syncedAt !== 'string' ||
      !Array.isArray(row.tickets) ||
      !row.tickets.every(isTicketSummary)
    ) {
      return null;
    }
    return {
      userId: row.userId,
      tenantId: row.tenantId,
      syncedAt: row.syncedAt,
      tickets: row.tickets,
    };
  } catch {
    return null;
  }
}

export function ticketDisplayCacheMatchesIdentity(
  cache: TicketDisplayCache,
  userId: string,
  tenantId: string,
): boolean {
  return cache.userId === userId && cache.tenantId === tenantId;
}
