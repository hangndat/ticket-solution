import type { OwnerRedemptionStatus } from '@ticket/contracts';

export type FetchOwnerRedemptionResult =
  | { status: 'ok'; body: OwnerRedemptionStatus }
  | { status: 'not-found' }
  | { status: 'unauthorized' }
  | { status: 'unreachable' }
  | { status: 'invalid' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isOwnerRedemptionStatus(
  value: unknown,
): value is OwnerRedemptionStatus {
  if (!isRecord(value) || typeof value.status !== 'string') return false;
  if (typeof value.requestId !== 'string' || typeof value.eventId !== 'string') {
    return false;
  }
  if (value.status === 'PENDING_REVIEW') {
    return (
      typeof value.ticketTypeId === 'string' &&
      typeof value.sourceId === 'string' &&
      (value.expiresAt === null || typeof value.expiresAt === 'string') &&
      typeof value.submittedAt === 'string'
    );
  }
  if (value.status === 'ISSUED') {
    return (
      typeof value.ticketId === 'string' &&
      typeof value.ticketTypeId === 'string' &&
      typeof value.sourceId === 'string' &&
      typeof value.issuedAt === 'string'
    );
  }
  if (value.status === 'REJECTED') {
    return (
      typeof value.ticketTypeId === 'string' &&
      typeof value.sourceId === 'string' &&
      (value.reason === null || typeof value.reason === 'string') &&
      typeof value.decidedAt === 'string'
    );
  }
  if (value.status === 'EXPIRED') {
    return (
      typeof value.ticketTypeId === 'string' &&
      typeof value.sourceId === 'string' &&
      typeof value.expiredAt === 'string'
    );
  }
  return false;
}

/** Live owner status via BFF — receipt operations stay historical. */
export async function fetchOwnerRedemptionStatus(
  requestId: string,
  tenantId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchOwnerRedemptionResult> {
  const id = requestId.trim();
  const tenant = tenantId.trim();
  if (!id || !tenant) return { status: 'invalid' };
  try {
    const response = await fetchImpl(
      `/api/bff/redemptions/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenant)}`,
      { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' },
    );
    if (response.status === 401 || response.status === 403) {
      return { status: 'unauthorized' };
    }
    if (response.status === 404) return { status: 'not-found' };
    if (response.status >= 500) return { status: 'unreachable' };
    const json: unknown = await response.json();
    if (!isOwnerRedemptionStatus(json)) return { status: 'invalid' };
    return { status: 'ok', body: json };
  } catch {
    return { status: 'unreachable' };
  }
}
