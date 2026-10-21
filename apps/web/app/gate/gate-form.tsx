'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
import { liveRegionForStatus } from '../../src/ui/live-region';
import {
  GateScopeBar,
  GateTabNav,
  gateTabTitle,
  type GateTab,
} from './gate-chrome';
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

type HistoryRow = KnownCheckin & { recordedAt: string };

const HISTORY_PAGE = 5;

function formatHistoryTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function GateForm({ initialTenantId = '', initialEventId = '' }: Props) {
  const [tab, setTab] = useState<GateTab>('scan');
  const [tenantId, setTenantId] = useState(initialTenantId);
  const [eventId, setEventId] = useState(initialEventId);
  const [ticketId, setTicketId] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [hold, setHold] = useState<Hold | null>(null);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<GateDecision | null>(null);
  const [notes, setNotes] = useState<HistoryRow[]>([]);
  const [historyVisible, setHistoryVisible] = useState(HISTORY_PAGE);
  const [historyFilter, setHistoryFilter] = useState('');
  const [browserOnline, setBrowserOnline] = useState(true);
  const [apiUnreachable, setApiUnreachable] = useState(false);

  const link: GateLinkState = resolveGateLinkState({ browserOnline, apiUnreachable });
  const actionsBlocked = link !== 'online';
  const outcome = presentGateDecision(decision);
  const outcomeLive = liveRegionForStatus(
    outcome.assertive || outcome.kind === 'unknown' ? 'unknown' : 'idle',
  );
  const tabCopy = gateTabTitle(tab);

  const filteredHistory = useMemo(() => {
    const q = historyFilter.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (row) =>
        row.ticketId.toLowerCase().includes(q) ||
        row.checkinId.toLowerCase().includes(q) ||
        row.message.toLowerCase().includes(q),
    );
  }, [historyFilter, notes]);

  const visibleHistory = filteredHistory.slice(0, historyVisible);
  const historyExhausted = historyVisible >= filteredHistory.length;

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

  function pushHistory(next: KnownCheckin) {
    setNotes((current) => [
      { ...next, recordedAt: new Date().toISOString() },
      ...current.filter((note) => note.ticketId !== next.ticketId),
    ]);
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
      if ((result.status === 200 || result.status === 201) && body?.sessionId) {
        setSessionId(body.sessionId);
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
      if (
        (reserved.status !== 200 && reserved.status !== 201) ||
        !holdBody?.reservationId ||
        !holdBody.token
      ) {
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
        pushHistory({
          ticketId: next.ticketId,
          checkinId: next.checkinId,
          message: next.message,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  function lookup(event: FormEvent) {
    event.preventDefault();
    setDecision(lookupKnownCheckin(notes, lookupId.trim()));
  }

  function goManualTab() {
    setTab('manual');
  }

  const decisionPanel =
    decision ? (
      <aside
        role={outcomeLive.role}
        aria-live={outcomeLive.ariaLive}
        aria-atomic={outcomeLive.ariaAtomic}
        data-outcome={decision.kind}
        data-outcome-view={outcome.kind}
        data-tone={outcome.tone}
        data-testid="gate-decision"
        className={
          outcome.tone === 'admit'
            ? 'redeem-status redeem-status--success gate-status--admit gate-toast'
            : outcome.tone === 'deny'
              ? 'redeem-status redeem-status--denied gate-status--deny gate-toast gate-toast--warn'
              : 'redeem-status redeem-status--unknown state-unknown gate-toast gate-toast--warn'
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
        aria-atomic="true"
        data-testid="gate-decision-idle"
        className="redeem-status state-empty gate-toast gate-toast--idle"
      >
        <h2>{outcome.title}</h2>
        <p>{outcome.detail}</p>
      </aside>
    );

  return (
    <div className="gate-workspace" data-testid="gate-workspace">
      <GateOfflineBanner link={link} />
      <GateScopeBar
        eventId={eventId}
        tenantId={tenantId}
        link={link}
        hasSession={Boolean(sessionId)}
      />
      <GateTabNav active={tab} onChange={setTab} />

      <header className="gate-heading">
        <h2 id={`gate-panel-${tab}-title`}>{tabCopy.title}</h2>
        <p>{tabCopy.lead}</p>
      </header>

      {tab === 'scan' ? (
        <section
          id="gate-panel-scan"
          role="tabpanel"
          aria-labelledby="gate-tab-scan gate-panel-scan-title"
          className="gate-panel"
          data-testid="gate-panel-scan"
        >
          <div className="gate-cols">
            <div className="gate-camera" aria-hidden="true">
              <div className="gate-camera__frame">
                <span className="gate-camera__line" />
                <span className="gate-camera__hint">Đưa QR vào khung</span>
              </div>
            </div>
            <aside className="gate-sidebox">
              <h3>Camera quét vé</h3>
              <p className="gate-sidebox__help">
                Camera cần quyền truy cập và kết nối HTTPS. Cổng web hiện dùng nhập tay
                qua API — không mô phòng quét trên trình duyệt này.
              </p>
              <button type="button" className="button button-secondary" onClick={goManualTab}>
                Nhập mã vé
              </button>
            </aside>
          </div>
          {decisionPanel}
        </section>
      ) : null}

      {tab === 'manual' ? (
        <section
          id="gate-panel-manual"
          role="tabpanel"
          aria-labelledby="gate-tab-manual gate-panel-manual-title"
          className="gate-panel"
          data-testid="gate-panel-manual"
        >
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
                className="gate-retry-link button button-secondary"
                data-testid="gate-retry-link"
                onClick={clearUnreachable}
              >
                Thử lại kết nối
              </button>
            ) : null}
          </section>

          <div className="gate-narrow">
            <form className="gate-form-block" onSubmit={openSession}>
              <h3 className="gate-form-block__title">Mở phiên cổng</h3>
              <div className="gate-form-grid">
                <label>
                  Tenant ID
                  <input
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </label>
                <label>
                  Event ID
                  <input
                    value={eventId}
                    onChange={(e) => setEventId(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </label>
              </div>
              <button
                type="submit"
                className="button"
                disabled={busy || actionsBlocked}
                data-testid="gate-session-submit"
              >
                Mở phiên cổng
              </button>
              {sessionId ? (
                <p className="gate-form-meta">
                  Phiên: <code>{sessionId}</code>
                </p>
              ) : null}
            </form>

            <form className="gate-form-block" onSubmit={confirmEntry}>
              <h3 className="gate-form-block__title">Kiểm tra vé</h3>
              <label>
                Mã vé (Ticket ID)
                <input
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  required
                  autoComplete="off"
                />
              </label>
              <button
                type="submit"
                className="button"
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
                <p className="gate-form-meta">
                  Đang giữ reservation <code>{hold.reservationId}</code>
                </p>
              ) : null}
            </form>
          </div>

          {decisionPanel}
        </section>
      ) : null}

      {tab === 'history' ? (
        <section
          id="gate-panel-history"
          role="tabpanel"
          aria-labelledby="gate-tab-history gate-panel-history-title"
          className="gate-panel"
          data-testid="gate-panel-history"
        >
          <div className="gate-tools">
            <label className="gate-tools__search">
              <span className="visually-hidden">Tìm trong các lượt đã tải</span>
              <input
                type="search"
                className="gate-search"
                placeholder="Tìm trong các lượt đã tải"
                value={historyFilter}
                onChange={(e) => {
                  setHistoryFilter(e.target.value);
                  setHistoryVisible(HISTORY_PAGE);
                }}
                aria-label="Tìm lịch sử"
              />
            </label>
          </div>

          {visibleHistory.length === 0 ? (
            <p className="gate-history-empty" role="status">
              Chưa có lượt check-in trên trình duyệt này.
            </p>
          ) : (
            <div className="gate-tablewrap" data-testid="gate-history-table">
              <table className="gate-table">
                <thead>
                  <tr>
                    <th scope="col">Thời gian</th>
                    <th scope="col">Vé</th>
                    <th scope="col">Kết quả</th>
                    <th scope="col">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHistory.map((row) => (
                    <tr key={`${row.ticketId}-${row.checkinId}`}>
                      <td data-label="Thời gian">{formatHistoryTime(row.recordedAt)}</td>
                      <td data-label="Vé">
                        <code title={row.ticketId}>{shortId(row.ticketId)}</code>
                      </td>
                      <td data-label="Kết quả">Được vào</td>
                      <td data-label="Chi tiết">
                        <button
                          type="button"
                          className="button-link"
                          onClick={() => {
                            setLookupId(row.ticketId);
                            setDecision(lookupKnownCheckin(notes, row.ticketId));
                          }}
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="gate-history-more">
            {!historyExhausted && filteredHistory.length > 0 ? (
              <button
                type="button"
                className="button button-secondary"
                data-testid="gate-history-load-more"
                onClick={() => setHistoryVisible((n) => n + HISTORY_PAGE)}
              >
                Tải thêm
              </button>
            ) : filteredHistory.length > 0 ? (
              <p className="gate-history-end">Đã tải hết lịch sử trên máy này.</p>
            ) : null}
          </div>

          <form className="gate-narrow gate-reconcile" onSubmit={lookup}>
            <h3>Đối soát trên máy này</h3>
            <p>
              Chỉ hiện check-in API đã trả trên trình duyệt này. Không có mã thì không cho
              qua — không phải hàng đợi offline.
            </p>
            <label>
              Ticket ID cần tra
              <input
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                required
                autoComplete="off"
              />
            </label>
            <button type="submit" className="button button-secondary">Đối soát</button>
          </form>

          {decisionPanel}
        </section>
      ) : null}
    </div>
  );
}
