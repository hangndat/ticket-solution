import type { OwnerRedemptionStatus, RedeemResponse } from '@ticket/contracts';
import type { RedeemDecision } from './decide';

export type OwnerRefreshPlan = {
  decision?: RedeemDecision | null;
  ticket?: RedeemResponse | null;
  clearPendingRequest?: boolean;
};

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
