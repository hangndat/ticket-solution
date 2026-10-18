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
  connectivityLabel,
  presentGateDecision,
  shortId,
} from '../../src/gate/gate-outcome-copy';
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
  /** Fail-closed: block mutate while offline or API unreachable (AC-G4). */
  const actionsBlocked = link !== 'online';
  const outcome = presentGateDecision(decision);

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

  function clearUnreachable() {
    setApiUnreachable(false);
    setDecision(null);
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
        // Session ready ≠ admit/deny — keep idle outcome («Chờ mã vé»).
        setDecision(null);
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
        message: 'Mở phiên cổng trước. Không cho vào.',
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

      <section
        className="gate-context"
        data-testid="gate-context"
        data-link={link}
        aria-label="Ngữ cảnh cổng"
      >
        <p className="gate-context__eyebrow">Ngữ cảnh cổng</p>
        <dl className="gate-context__meta">
          <div>
            <dt>Kết nối</dt>
            <dd data-testid="gate-connectivity">{connectivityLabel(link)}</dd>
          </div>
          <div>
            <dt>Sự kiện</dt>
            <dd>
              <code title={eventId || undefined}>{shortId(eventId)}</code>
            </dd>
          </div>
          <div>
            <dt>Tenant</dt>
            <dd>
              <code title={tenantId || undefined}>{shortId(tenantId)}</code>
            </dd>
          </div>
          <div>
            <dt>Phiên</dt>
            <dd>
              <code title={sessionId || undefined}>
                {sessionId ? shortId(sessionId) : 'Chưa mở'}
              </code>
            </dd>
          </div>
        </dl>
        <p className="gate-context__note">
          Cổng web không xếp hàng offline. Khi mất mạng hãy dùng app Nhân viên.
        </p>
        {link === 'degraded' ? (
          <button
            type="button"
            className="gate-retry-link"
            data-testid="gate-retry-link"
            onClick={clearUnreachable}
          >
            Thử lại kết nối
          </button>
        ) : null}
      </section>

      <form onSubmit={openSession}>
        <label>
          Tenant ID
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} required />
        </label>
        <label>
          Event ID
          <input value={eventId} onChange={(e) => setEventId(e.target.value)} required />
        </label>
        <button
          type="submit"
          disabled={busy || actionsBlocked}
          data-testid="gate-session-submit"
        >
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
          disabled={busy || !sessionId || actionsBlocked}
          data-testid="gate-confirm-submit"
          title={
            actionsBlocked
              ? 'Cổng offline/suy giảm — không check-in trên web'
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
        <h2>Đối soát trên máy này</h2>
        <p>
          Chỉ hiện check-in API đã trả trên trình duyệt này. Không có mã thì không
          cho qua — không phải hàng đợi offline.
        </p>
        <label>
          Ticket ID cần tra
          <input value={lookupId} onChange={(e) => setLookupId(e.target.value)} required />
        </label>
        <button type="submit">Đối soát</button>
      </form>

      {decision ? (
        <aside
          role={outcome.assertive ? 'alert' : 'status'}
          aria-live={outcome.assertive ? 'assertive' : 'polite'}
          data-outcome={decision.kind}
          data-outcome-view={outcome.kind}
          data-tone={outcome.tone}
          data-testid="gate-decision"
          className={
            outcome.tone === 'admit'
              ? 'redeem-status redeem-status--success gate-status--admit'
              : outcome.tone === 'deny'
                ? 'redeem-status redeem-status--denied gate-status--deny'
                : 'redeem-status redeem-status--unknown state-unknown'
          }
        >
          <h2>{outcome.title}</h2>
          <p>{outcome.detail}</p>
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
          {outcome.kind === 'unknown' ? (
            <p data-testid="gate-reconcile-hint">
              Kết quả chưa rõ — không cho khách qua. Đối soát trước khi quyết định.
            </p>
          ) : null}
        </aside>
      ) : (
        <aside
          role="status"
          aria-live="polite"
          data-testid="gate-decision-idle"
          className="redeem-status state-empty"
        >
          <h2>{outcome.title}</h2>
          <p>{outcome.detail}</p>
        </aside>
      )}
    </>
  );
}
