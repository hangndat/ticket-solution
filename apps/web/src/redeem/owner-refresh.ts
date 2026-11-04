import type { OwnerRedemptionStatus, RedeemResponse } from '@ticket/contracts';
import type { RedeemDecision } from './decide';
import {
  fetchOwnerRedemptionStatus,
  type FetchOwnerRedemptionResult,
} from './owner-status';

export type OwnerRefreshPlan = {
  decision?: RedeemDecision | null;
  ticket?: RedeemResponse | null;
  clearPendingRequest?: boolean;
};

export type OwnerRefreshOutcome =
  | { kind: 'stale' }
  | {
      kind: 'updated';
      status: OwnerRedemptionStatus;
      raw: string;
      plan: OwnerRefreshPlan;
    }
  | { kind: 'unauthorized' }
  | { kind: 'unavailable'; reason: 'not-found' | 'unreachable' | 'invalid' };

function interpretFetchResult(
  result: FetchOwnerRedemptionResult,
): Exclude<OwnerRefreshOutcome, { kind: 'stale' }> {
  if (result.status === 'ok') {
    return {
      kind: 'updated',
      status: result.body,
      raw: JSON.stringify(result.body, null, 2),
      plan: ownerRefreshPlan(result.body),
    };
  }
  if (result.status === 'unauthorized') return { kind: 'unauthorized' };
  return { kind: 'unavailable', reason: result.status };
}

/** Owns the scoped request, stale completion check, and transport interpretation. */
export async function refreshOwnerRedemption(
  requestId: string,
  tenantId: string,
  isCurrent: () => boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<OwnerRefreshOutcome> {
  const result = await fetchOwnerRedemptionStatus(
    requestId,
    tenantId,
    fetchImpl,
  );
  if (!isCurrent()) return { kind: 'stale' };
  return interpretFetchResult(result);
}

/** Map a verified owner status to the small state transition the form needs. */
export function ownerRefreshPlan(
  status: OwnerRedemptionStatus,
): OwnerRefreshPlan {
  if (status.status === 'ISSUED') {
    return {
      decision: {
        kind: 'issued',
        ticketId: status.ticketId,
        requestId: status.requestId,
        replayed: false,
      },
      ticket: {
        ticketId: status.ticketId,
        requestId: status.requestId,
        operationId: '',
        eventId: status.eventId,
        ticketTypeId: status.ticketTypeId,
        sourceId: status.sourceId,
        state: 'ACTIVE',
        credentialVersion: 1,
        replayed: false,
      },
    };
  }
  if (status.status === 'REJECTED' || status.status === 'EXPIRED') {
    return { decision: null, clearPendingRequest: true };
  }
  return {};
}
