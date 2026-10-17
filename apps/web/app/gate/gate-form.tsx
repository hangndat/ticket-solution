'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  isApiUnreachableResult,
  readBrowserOnline,
  resolveGateLinkState,
  type GateLinkState,
} from '../../src/gate/connectivity';
import {
  decideGateConfirm,
  lookupKnownCheckin,
  type GateDecision,
  type KnownCheckin,
} from '../../src/gate/decide';
import {
  BLOCKED_DEGRADED_DECISION,
  BLOCKED_OFFLINE_DECISION,
  UNREACHABLE_CONFIRM,
} from '../../src/gate/offline-messages';
import { fetchJson } from '../../src/redeem/fetch-json';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';
import { GateOfflineBanner } from './offline-banner';

type Props = {
  initialTenantId?: string;
  initialEventId?: string;
};

type Hold = {
  reservationId: string;
  token: string;
  ticketId: string;
};

function outcomeLabel(decision: GateDecision): string {
  if (decision.kind === 'admit') return 'Cho qua';
  if (decision.kind === 'deny') return 'Không cho qua';
  return 'Chưa biết — không cho qua';
}

export function GateForm({ initialTenantId = '', initialEventId = '' }: Props) {
  const [tenantId, setTenantId] = useState(initialTenantId);
  const [eventId, setEventId] = useState(initialEventId);
  const [ticketId, setTicketId] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [hold, setHold] = useState<Hold | null>(null);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<GateDecision | null>(null);
  const [notes, setNotes] = useState<KnownCheckin[]>([]);
  const [browserOnline, setBrowserOnline] = useState(true);
  const [apiUnreachable, setApiUnreachable] = useState(false);

  const link: GateLinkState = resolveGateLinkState({ browserOnline, apiUnreachable });
  const actionsBlocked = link !== 'online';

  useEffect(() => {
    function syncBrowser() {
      setBrowserOnline(readBrowserOnline(window.navigator));
    }
    syncBrowser();
    window.addEventListener('online', syncBrowser);
    window.addEventListener('offline', syncBrowser);
    const timer = window.setInterval(syncBrowser, 1000);
    return () => {
      window.removeEventListener('online', syncBrowser);
      window.removeEventListener('offline', syncBrowser);
      window.clearInterval(timer);
    };
  }, []);

  async function post(path: string, body: unknown) {
    return fetchJson(
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      REQUEST_TIMEOUT_MS,
    );
  }

  function noteUnreachable(result: {
    timedOut: boolean;
    networkError: boolean;
    status: number;
  }) {
    if (isApiUnreachableResult(result)) {
      setApiUnreachable(true);
      return true;
    }
    setApiUnreachable(false);
    return false;
  }

  /** Fail-closed guard before mutating Gate calls. */
  function guardBeforeMutate(): boolean {
    if (!readBrowserOnline()) {
      setBrowserOnline(false);
      setDecision(BLOCKED_OFFLINE_DECISION);
      return false;
    }
    if (apiUnreachable) {
      const proceed =
        typeof window !== 'undefined' && window.confirm(UNREACHABLE_CONFIRM);
      if (!proceed) {
        setDecision(BLOCKED_DEGRADED_DECISION);
        return false;
      }
    }
    return true;
  }

  async function openSession(event: FormEvent) {
    event.preventDefault();
    if (!guardBeforeMutate()) return;
    setBusy(true);
    setDecision(null);
    setHold(null);
    try {
      const result = await post('/api/bff/gate/sessions', { tenantId, eventId });
      if (noteUnreachable(result)) {
        setSessionId('');
        setDecision(decideGateConfirm(result));
        return;
      }
      const body = result.json as { sessionId?: string; code?: string; message?: string } | null;
      if (result.status === 200 && body?.sessionId) {
        setSessionId(body.sessionId);
        setDecision({
          kind: 'deny',
          code: 'SESSION_OPEN',
          message: 'Đã mở phiên cổng. Chưa check-in vé nào.',
        });
        return;
      }
      setSessionId('');
      setDecision(decideGateConfirm(result));
    } finally {
      setBusy(false);
    }
  }

  async function confirmEntry(event: FormEvent) {
    event.preventDefault();
    if (!sessionId) {
      setDecision({
        kind: 'deny',
        code: 'SESSION_REQUIRED',
        message: 'Mở phiên cổng trước. Không cho qua.',
      });
      return;
    }
    if (!guardBeforeMutate()) return;
    setBusy(true);
    setDecision(null);
    try {
      const reserved = await post('/api/bff/gate/reservations', {
        tenantId,
        eventId,
        ticketId,
        staffSessionId: sessionId,
      });
      if (noteUnreachable(reserved)) {
        setDecision(decideGateConfirm(reserved));
        return;
      }
      const holdBody = reserved.json as {
        reservationId?: string;
        token?: string;
        ticketId?: string;
      } | null;
      if (reserved.status !== 200 || !holdBody?.reservationId || !holdBody.token) {
        setHold(null);
        setDecision(decideGateConfirm(reserved));
        return;
      }
      const nextHold = {
        reservationId: holdBody.reservationId,
        token: holdBody.token,
        ticketId: holdBody.ticketId ?? ticketId,
      };
      setHold(nextHold);
      const confirmed = await post('/api/bff/gate/confirm', {
        tenantId,
        eventId,
        reservationId: nextHold.reservationId,
        staffSessionId: sessionId,
        token: nextHold.token,
      });
      if (noteUnreachable(confirmed)) {
        setDecision(decideGateConfirm(confirmed));
        return;
      }
      const next = decideGateConfirm(confirmed);
      setDecision(next);
      if (next.kind === 'admit' && next.checkinId) {
        setNotes((current) => [
          { ticketId: next.ticketId, checkinId: next.checkinId, message: next.message },
          ...current.filter((note) => note.ticketId !== next.ticketId),
        ]);
      }
    } finally {
      setBusy(false);
    }
  }

  function lookup(event: FormEvent) {
    event.preventDefault();
    setDecision(lookupKnownCheckin(notes, lookupId.trim()));
  }

  return (
    <>
      <GateOfflineBanner link={link} />

      <form onSubmit={openSession}>
        <label>
          Tenant ID
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} required />
        </label>
        <label>
          Event ID
          <input value={eventId} onChange={(e) => setEventId(e.target.value)} required />
        </label>
        <button type="submit" disabled={busy || !browserOnline} data-testid="gate-session-submit">
          Mở phiên cổng
        </button>
        {sessionId ? (
          <p>
            Phiên: <code>{sessionId}</code>
          </p>
        ) : null}
      </form>

      <form onSubmit={confirmEntry}>
        <label>
          Ticket ID
          <input value={ticketId} onChange={(e) => setTicketId(e.target.value)} required />
        </label>
        <button
          type="submit"
          disabled={busy || !sessionId || !browserOnline}
          data-testid="gate-confirm-submit"
          title={
            actionsBlocked
              ? 'Cổng offline/degraded — không check-in giả thành công trên web'
              : undefined
          }
        >
          Giữ chỗ và xác nhận
        </button>
        {hold ? (
          <p>
            Đang giữ reservation <code>{hold.reservationId}</code>
          </p>
        ) : null}
      </form>

      <form onSubmit={lookup}>
        <h2>Tra cứu CS</h2>
        <p>
          Chỉ hiện check-in API đã trả mã trên trình duyệt này. Không có mã thì không cho qua.
        </p>
        <label>
          Ticket ID cần tra
          <input value={lookupId} onChange={(e) => setLookupId(e.target.value)} required />
        </label>
        <button type="submit">Tra cứu</button>
      </form>

      {decision ? (
        <aside
          role="status"
          data-outcome={decision.kind}
          data-testid="gate-decision"
          className={
            decision.kind === 'admit'
              ? 'redeem-status redeem-status--success gate-status--admit'
              : decision.kind === 'deny'
                ? 'redeem-status redeem-status--denied gate-status--deny'
                : 'redeem-status redeem-status--unknown state-unknown'
          }
        >
          <h2>{outcomeLabel(decision)}</h2>
          <p>{decision.message}</p>
          {decision.kind === 'admit' && decision.checkinId ? (
            <p>
              Check-in <code>{decision.checkinId}</code>
            </p>
          ) : null}
          {decision.kind === 'deny' ? (
            <p>
              Mã lỗi: <code>{decision.code}</code>
            </p>
          ) : null}
          {decision.kind !== 'admit' && decision.kind !== 'deny' ? (
            <p>Kết quả chưa biết — không cho khách qua.</p>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
