'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CS_RESEND_COOLDOWN_SECONDS,
  interpretCsDetail,
  interpretCsList,
  interpretCsResend,
  type CsView,
} from './cs';
import type { AdminScope } from './scope';
import { useIdempotentAction } from './use-idempotent-action';
import { fetchJson } from '../redeem/fetch-json';
import { REQUEST_TIMEOUT_MS } from '../redeem/poll-operation';

type Params = {
  scope: () => AdminScope;
  onBusy: (busy: boolean) => void;
  onBumpNotice: () => void;
  onClearSiblingViews: () => void;
};

export function useCsApi({
  scope,
  onBusy,
  onBumpNotice,
  onClearSiblingViews,
}: Params) {
  const resendIdempotency = useIdempotentAction();
  const [csQuery, setCsQuery] = useState('');
  const [csTicketId, setCsTicketId] = useState('');
  const [csCursor, setCsCursor] = useState<string | null>(null);
  const [csView, setCsView] = useState<CsView | null>(null);
  const [resendCooldownUntil, setResendCooldownUntil] = useState<number | null>(
    null,
  );
  const [resendCooldownNow, setResendCooldownNow] = useState(() => Date.now());

  const resendCooldownActive =
    resendCooldownUntil !== null && resendCooldownNow < resendCooldownUntil;
  const resendCooldownRemainingSec = resendCooldownActive
    ? Math.max(1, Math.ceil((resendCooldownUntil! - resendCooldownNow) / 1000))
    : 0;

  useEffect(() => {
    if (!resendCooldownUntil) return;
    const tick = () => {
      const now = Date.now();
      setResendCooldownNow(now);
      if (now >= resendCooldownUntil) setResendCooldownUntil(null);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldownUntil]);

  const clearViews = useCallback(() => {
    setCsView(null);
  }, []);

  const csSearch = useCallback(async () => {
    onBusy(true);
    onClearSiblingViews();
    clearViews();
    const params = new URLSearchParams({
      ...scope(),
      ...(csQuery.trim() ? { q: csQuery.trim() } : {}),
      limit: '20',
      ...(csCursor ? { cursor: csCursor } : {}),
    });
    const result = await fetchJson(
      `/api/bff/admin/tickets?${params.toString()}`,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretCsList(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    if (next.kind === 'list') setCsCursor(next.cursor);
    onBumpNotice();
    setCsView(next);
    onBusy(false);
  }, [
    clearViews,
    csCursor,
    csQuery,
    onBumpNotice,
    onBusy,
    onClearSiblingViews,
    scope,
  ]);

  const csDetail = useCallback(async () => {
    const id = csTicketId.trim();
    if (!id) {
      setCsView({
        kind: 'rejected',
        code: 'TICKET_ID_REQUIRED',
        message: 'ticketId must be a UUID.',
      });
      return;
    }
    onBusy(true);
    onClearSiblingViews();
    clearViews();
    const params = new URLSearchParams(scope());
    const result = await fetchJson(
      `/api/bff/admin/tickets/${encodeURIComponent(id)}?${params.toString()}`,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
    );
    onBumpNotice();
    setCsView(
      interpretCsDetail(
        result.status,
        result.json,
        result.networkError || result.timedOut,
        id,
      ),
    );
    onBusy(false);
  }, [clearViews, csTicketId, onBumpNotice, onBusy, onClearSiblingViews, scope]);

  const csResend = useCallback(async () => {
    const id = csTicketId.trim();
    if (!id) {
      setCsView({
        kind: 'rejected',
        code: 'TICKET_ID_REQUIRED',
        message: 'ticketId must be a UUID.',
      });
      return;
    }
    const fingerprint = JSON.stringify({ ...scope(), ticketId: id });
    const idempotencyKey = resendIdempotency.keyFor(fingerprint);
    onBusy(true);
    onClearSiblingViews();
    clearViews();
    const result = await fetchJson(
      `/api/bff/admin/tickets/${encodeURIComponent(id)}/resend`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scope(), idempotencyKey }),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretCsResend(
      result.status,
      result.json,
      result.networkError || result.timedOut,
      id,
    );
    resendIdempotency.remember(
      idempotencyKey,
      fingerprint,
      next.kind === 'unknown',
    );
    if (next.kind === 'rejected' && next.code === 'RESEND_COOLDOWN') {
      setResendCooldownUntil(Date.now() + CS_RESEND_COOLDOWN_SECONDS * 1000);
    } else if (next.kind === 'resent') {
      setResendCooldownUntil(Date.now() + CS_RESEND_COOLDOWN_SECONDS * 1000);
    }
    onBumpNotice();
    setCsView(next);
    onBusy(false);
  }, [
    clearViews,
    csTicketId,
    onBumpNotice,
    onBusy,
    onClearSiblingViews,
    resendIdempotency,
    scope,
  ]);

  const resetCsCursor = useCallback(() => {
    setCsCursor(null);
  }, []);

  return {
    csQuery,
    setCsQuery,
    csTicketId,
    setCsTicketId,
    csCursor,
    csView,
    clearViews,
    resetCsCursor,
    csSearch,
    csDetail,
    csResend,
    resendCooldownActive,
    resendCooldownRemainingSec,
  };
}
