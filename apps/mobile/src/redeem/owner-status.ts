import type { OwnerRedemptionStatus } from './contract.ts';

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

/**
 * Live owner status — receipt operations stay historical.
 * Typed against frozen GET /me/redemptions/:requestId (F-BE dependency).
 */
export async function fetchOwnerRedemptionStatus(input: {
  apiBase: string;
  bearer: string;
  requestId: string;
  fetchImpl?: typeof fetch;
}): Promise<FetchOwnerRedemptionResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = input.apiBase.replace(/\/$/, '');
  try {
    const response = await fetchImpl(
      `${base}/v1/me/redemptions/${encodeURIComponent(input.requestId)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${input.bearer}`,
        },
      },
    );
    if (response.status === 401 || response.status === 403) {
      return { status: 'unauthorized' };
    }
    if (response.status === 404) return { status: 'not-found' };
    if (response.status >= 500) return { status: 'unreachable' };
    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        return { status: 'invalid' };
      }
    }
    if (!isOwnerRedemptionStatus(json)) return { status: 'invalid' };
    return { status: 'ok', body: json };
  } catch {
    return { status: 'unreachable' };
  }
}
