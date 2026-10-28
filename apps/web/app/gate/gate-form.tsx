'use client';

import { Button, Input } from '@ticket/ui';
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
import { redeemDevStatusClass } from '../../src/redeem/redeem-surface';
import { liveRegionForStatus } from '../../src/ui/live-region';
import {
  GateScopeBar,
  GateTabNav,
  gateTabTitle,
  type GateTab,
} from './gate-chrome';
import { GateOfflineBanner } from './offline-banner';
import { DEFAULT_GATE_LABEL, type GateScopeChrome } from './gate-scope-chrome';

type Props = {
  initialTenantId?: string;
  initialEventId?: string;
  scopeChrome?: GateScopeChrome | null;
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

export function GateForm({
  initialTenantId = '',
  initialEventId = '',
  scopeChrome = null,
}: Props) {
  const [tab, setTab] = useState<GateTab>('scan');
  const [tenantId, setTenantId] = useState(
    () => initialTenantId.trim() || scopeChrome?.tenantId || '',
  );
  const [eventId, setEventId] = useState(
    () => initialEventId.trim() || scopeChrome?.eventId || '',
  );
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
            ? redeemDevStatusClass('success')
            : outcome.tone === 'deny'
              ? redeemDevStatusClass('denied')
              : redeemDevStatusClass('unknown')
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
        className={redeemDevStatusClass('unknown')}
      >
        <h2>{outcome.title}</h2>
        <p>{outcome.detail}</p>
      </aside>
    );

  const fieldLabel =
    'grid gap-1.5 text-sm font-semibold text-ink [&_input]:mt-1 [&_input]:font-normal';
  const formBlock = 'mt-6 grid gap-4 rounded-md border border-line bg-white p-5';
  const panelClass = 'mt-4 grid gap-4';

  return (
    <div className="mt-2 grid gap-2" data-testid="gate-workspace">
      <GateOfflineBanner link={link} />
      <GateScopeBar
        eventId={eventId}
        tenantId={tenantId}
        link={link}
        hasSession={Boolean(sessionId)}
        eventDisplayName={scopeChrome?.eventName ?? null}
        gateDisplayName={scopeChrome ? DEFAULT_GATE_LABEL : null}
      />
      <GateTabNav active={tab} onChange={setTab} />

      <header className="mt-5 max-w-[42rem]">
        <h2
          id={`gate-panel-${tab}-title`}
          className="m-0 font-display text-[1.35rem] font-bold tracking-[-0.02em] text-ink"
        >
          {tabCopy.title}
        </h2>
        <p className="mt-2 text-[0.95rem] leading-[1.55] text-muted">{tabCopy.lead}</p>
      </header>

      {tab === 'scan' ? (
        <section
          id="gate-panel-scan"
          role="tabpanel"
          aria-labelledby="gate-tab-scan gate-panel-scan-title"
          className={panelClass}
          data-testid="gate-panel-scan"
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div
              className="grid min-h-56 place-items-center rounded-md border border-dashed border-line bg-[color-mix(in_srgb,var(--color-ink)_4%,var(--color-paper))]"
              aria-hidden="true"
            >
              <div className="relative grid h-40 w-40 place-items-center rounded-md border-2 border-ink/25">
                <span className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 bg-signal/70" />
                <span className="relative z-10 rounded bg-paper/90 px-2 py-1 text-xs font-semibold text-muted">
                  Đưa QR vào khung
                </span>
              </div>
            </div>
            <aside className="rounded-md border border-line bg-white p-5">
              <h3 className="m-0 text-[1.05rem] font-bold text-ink">Camera quét vé</h3>
              <p className="mt-2 text-sm leading-[1.55] text-muted">
                Camera cần quyền truy cập và kết nối HTTPS. Cổng web hiện dùng nhập tay
                qua API — không mô phòng quét trên trình duyệt này.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-4"
                onClick={goManualTab}
              >
                Nhập mã vé
              </Button>
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
          className={panelClass}
          data-testid="gate-panel-manual"
        >
          <section
            className="rounded-md border border-line bg-white p-5"
            data-testid="gate-context"
            data-link={link}
            aria-label="Ngữ cảnh cổng"
          >
            <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-muted">
              Ngữ cảnh cổng
            </p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-muted">Kết nối</dt>
                <dd className="m-0 mt-1 font-mono text-sm" data-testid="gate-connectivity">
                  {connectivityLabel(link)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">Sự kiện</dt>
                <dd className="m-0 mt-1 font-mono text-sm">
                  <code title={eventId || undefined}>{shortId(eventId)}</code>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">Tenant</dt>
                <dd className="m-0 mt-1 font-mono text-sm">
                  <code title={tenantId || undefined}>{shortId(tenantId)}</code>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">Phiên</dt>
                <dd className="m-0 mt-1 font-mono text-sm">
                  <code title={sessionId || undefined}>
                    {sessionId ? shortId(sessionId) : 'Chưa mở'}
                  </code>
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-muted">
              Cổng web không xếp hàng offline. Khi mất mạng hãy dùng app Nhân viên.
            </p>
            {link === 'degraded' ? (
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                data-testid="gate-retry-link"
                onClick={clearUnreachable}
              >
                Thử lại kết nối
              </Button>
            ) : null}
          </section>

          <div className="mx-auto grid w-full max-w-[40rem] gap-4">
            <form className={formBlock} onSubmit={openSession}>
              <h3 className="m-0 text-[1.05rem] font-bold text-ink">Mở phiên cổng</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={fieldLabel}>
                  Tenant ID
                  <Input
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </label>
                <label className={fieldLabel}>
                  Event ID
                  <Input
                    value={eventId}
                    onChange={(e) => setEventId(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </label>
              </div>
              <Button
                type="submit"
                disabled={busy || actionsBlocked}
                data-testid="gate-session-submit"
              >
                Mở phiên cổng
              </Button>
              {sessionId ? (
                <p className="m-0 text-sm text-muted">
                  Phiên: <code>{sessionId}</code>
                </p>
              ) : null}
            </form>

            <form className={formBlock} onSubmit={confirmEntry}>
              <h3 className="m-0 text-[1.05rem] font-bold text-ink">Kiểm tra vé</h3>
              <label className={fieldLabel}>
                Mã vé (Ticket ID)
                <Input
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  required
                  autoComplete="off"
                />
              </label>
              <Button
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
              </Button>
              {hold ? (
                <p className="m-0 text-sm text-muted">
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
          className={panelClass}
          data-testid="gate-panel-history"
        >
          <div>
            <label className="block max-w-md">
              <span className="sr-only">Tìm trong các lượt đã tải</span>
              <Input
                type="search"
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
            <p className="text-sm text-muted" role="status">
              Chưa có lượt check-in trên trình duyệt này.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-line" data-testid="gate-history-table">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead className="bg-paper text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">Thời gian</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Vé</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Kết quả</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHistory.map((row) => (
                    <tr key={`${row.ticketId}-${row.checkinId}`} className="border-t border-line">
                      <td className="px-3 py-2">{formatHistoryTime(row.recordedAt)}</td>
                      <td className="px-3 py-2">
                        <code title={row.ticketId}>{shortId(row.ticketId)}</code>
                      </td>
                      <td className="px-3 py-2">Được vào</td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => {
                            setLookupId(row.ticketId);
                            setDecision(lookupKnownCheckin(notes, row.ticketId));
                          }}
                        >
                          Xem
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            {!historyExhausted && filteredHistory.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                data-testid="gate-history-load-more"
                onClick={() => setHistoryVisible((n) => n + HISTORY_PAGE)}
              >
                Tải thêm
              </Button>
            ) : filteredHistory.length > 0 ? (
              <p className="text-sm text-muted">Đã tải hết lịch sử trên máy này.</p>
            ) : null}
          </div>

          <form className={`${formBlock} max-w-[40rem]`} onSubmit={lookup}>
            <h3 className="m-0 text-[1.05rem] font-bold text-ink">Đối soát trên máy này</h3>
            <p className="m-0 text-sm text-muted">
              Chỉ hiện check-in API đã trả trên trình duyệt này. Không có mã thì không cho
              qua — không phải hàng đợi offline.
            </p>
            <label className={fieldLabel}>
              Ticket ID cần tra
              <Input
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                required
                autoComplete="off"
              />
            </label>
            <Button type="submit" variant="secondary">
              Đối soát
            </Button>
          </form>

          {decisionPanel}
        </section>
      ) : null}
    </div>
  );
}
