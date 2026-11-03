import type { OwnerRedemptionStatus, RedeemResponse } from '@ticket/contracts';
import type { RedeemDecision } from './decide';
import type { AttendeeLocale } from '../i18n/locale';
import { redeemFormCopy } from './form-copy';
import {
  messageForApiError,
  messageForOwnerStatus,
  type RedeemUxMessage,
} from './messages';
import { fetchOwnerRedemptionStatus } from './owner-status';

export type OwnerRefreshPlan = {
  decision?: RedeemDecision | null;
  ticket?: RedeemResponse | null;
  clearPendingRequest?: boolean;
};

export type OwnerRefreshOutcome =
  | { kind: 'stale' }
  | {
      kind: 'ready';
      ux: RedeemUxMessage;
      raw?: string;
      plan?: OwnerRefreshPlan;
    };

/** Own the scoped request and every status outcome; the form only applies current state. */
export async function refreshOwnerRedemption({
  requestId,
  tenantId,
  locale,
  isCurrent,
  fetchImpl,
}: {
  requestId: string;
  tenantId: string;
  locale: AttendeeLocale;
  isCurrent: () => boolean;
  fetchImpl?: typeof fetch;
}): Promise<OwnerRefreshOutcome> {
  const result = await fetchOwnerRedemptionStatus(
    requestId,
    tenantId,
    fetchImpl,
  );
  if (!isCurrent()) return { kind: 'stale' };
  if (result.status === 'ok') {
    return {
      kind: 'ready',
      ux: messageForOwnerStatus(result.body, locale),
      raw: JSON.stringify(result.body, null, 2),
      plan: ownerRefreshPlan(result.body),
    };
  }
  if (result.status === 'unauthorized') {
    return {
      kind: 'ready',
      ux: messageForApiError('UNAUTHENTICATED', undefined, undefined, locale),
    };
  }
  return {
    kind: 'ready',
    ux: messageForApiError(
      undefined,
      result.status === 'not-found'
        ? redeemFormCopy(locale).ownerNotFound
        : redeemFormCopy(locale).ownerUnread,
      undefined,
      locale,
    ),
  };
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
