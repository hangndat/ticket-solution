'use client';

import { useCallback, useState } from 'react';
import {
  decideAdmin,
  type AdminDecision,
} from './decide';
import type { AdminScope } from './scope';
import { useIdempotentAction } from './use-idempotent-action';
import { fetchJson } from '../redeem/fetch-json';
import { REQUEST_TIMEOUT_MS } from '../redeem/poll-operation';

type Params = {
  scope: () => AdminScope;
  onBusy: (busy: boolean) => void;
  onBumpNotice: () => void;
  onDecision: (decision: AdminDecision) => void;
  onBeforeRedemption: () => void;
};

export function useRedemptionApprovalApi({
  scope,
  onBusy,
  onBumpNotice,
  onDecision,
  onBeforeRedemption,
}: Params) {
  const approveIdempotency = useIdempotentAction();
  const denyIdempotency = useIdempotentAction();
  const [requestId, setRequestId] = useState('');
  const [denyReason, setDenyReason] = useState('');

  const decideRedemption = useCallback(
    async (action: 'approve' | 'deny') => {
      const id = requestId.trim();
      if (!id) {
        onDecision({
          kind: 'rejected',
          code: 'REQUEST_ID_REQUIRED',
          message: 'requestId must be a UUID.',
        });
        return;
      }
      const reason = denyReason.trim();
      if (action === 'deny' && !reason) {
        onDecision({
          kind: 'rejected',
          code: 'REASON_REQUIRED',
          message: 'Denial reason is required.',
        });
        return;
      }
      if (action === 'deny' && reason.length > 500) {
        onDecision({
          kind: 'rejected',
          code: 'REASON_TOO_LONG',
          message: 'Denial reason must be at most 500 characters.',
        });
        return;
      }
      const fingerprint = JSON.stringify({
        ...scope(),
        requestId: id,
        reason: action === 'deny' ? reason : '',
      });
      const idempotency =
        action === 'approve' ? approveIdempotency : denyIdempotency;
      const idempotencyKey = idempotency.keyFor(fingerprint);
      onBusy(true);
      onBeforeRedemption();
      const result = await fetchJson(
        action === 'approve'
          ? '/api/bff/admin/redemptions/approve'
          : '/api/bff/admin/redemptions/deny',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...scope(),
            requestId: id,
            idempotencyKey,
            ...(action === 'deny' ? { reason } : {}),
          }),
        },
        REQUEST_TIMEOUT_MS,
      );
      const next = decideAdmin(
        action,
        result.status,
        result.json,
        result.networkError || result.timedOut,
      );
      idempotency.remember(idempotencyKey, fingerprint, next.kind === 'unknown');
      onBumpNotice();
      onDecision(next);
      onBusy(false);
    },
    [
      approveIdempotency,
      denyIdempotency,
      denyReason,
      onBeforeRedemption,
      onBumpNotice,
      onBusy,
      onDecision,
      requestId,
      scope,
    ],
  );

  return {
    requestId,
    setRequestId,
    denyReason,
    setDenyReason,
    decideRedemption,
  };
}
