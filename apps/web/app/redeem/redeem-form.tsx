'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from 'react';
import type { MeTicketsResponse, RedeemResponse } from '@ticket/contracts';
import {
  messageForApiError,
  networkMessage,
  successMessage,
  timeoutMessage,
  verifyingMessage,
  type RedeemUxMessage,
} from '../../src/redeem/messages';
import {
  redeemPayloadFingerprint,
  resolveIdempotencyKey,
  type RedeemAttempt,
} from '../../src/redeem/attempt-key';
import { fetchJson } from '../../src/redeem/fetch-json';
import {
  isApiError,
  isRedeemResponse,
  pollOperation,
  REQUEST_TIMEOUT_MS,
} from '../../src/redeem/poll-operation';

type Props = {
  initialTenantId?: string;
  initialEventId?: string;
};

type FormState = {
  tenantId: string;
  eventId: string;
  code: string;
  formVersion: string;
  termsVersion: string;
};

export function RedeemForm({ initialTenantId = '', initialEventId = '' }: Props) {
  const [form, setForm] = useState<FormState>(() => ({
    tenantId: initialTenantId,
    eventId: initialEventId,
    code: '',
    formVersion: 'web-redeem-d2',
    termsVersion: 'web-terms-d2',
  }));
  const [ux, setUx] = useState<RedeemUxMessage | null>(null);
  const [ticket, setTicket] = useState<RedeemResponse | null>(null);
  const [tickets, setTickets] = useState<MeTicketsResponse | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<RedeemAttempt | null>(null);
  const [pending, startTransition] = useTransition();
  const [polling, setPolling] = useState(false);
  const generationRef = useRef(0);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
    };
  }, []);

  const busy = pending || polling;
  const canRepoll = Boolean(attempt?.unclear && attempt.key && !busy);

  const isStale = useCallback((generation: number) => generation !== generationRef.current, []);

  const markAttemptClear = useCallback((generation: number) => {
    if (isStale(generation)) return;
    setAttempt((prev) => (prev ? { ...prev, unclear: false } : prev));
  }, [isStale]);

  const markAttemptUnclear = useCallback((generation: number) => {
    if (isStale(generation)) return;
    setAttempt((prev) => (prev ? { ...prev, unclear: true } : prev));
  }, [isStale]);

  const applySuccess = useCallback((body: RedeemResponse, generation: number) => {
    if (isStale(generation)) return;
    setTicket(body);
    setUx(successMessage(body.ticketId, body.replayed));
    markAttemptClear(generation);
  }, [isStale, markAttemptClear]);

  const applyError = useCallback((body: unknown, generation: number) => {
    if (isStale(generation)) return;
    if (isApiError(body)) {
      const mapped = messageForApiError(body.code, body.message, body.retryable);
      setUx(mapped);
      if (!mapped.retryable) markAttemptClear(generation);
      else markAttemptUnclear(generation);
    } else {
      setUx(messageForApiError(undefined, 'Unexpected response shape.'));
      markAttemptClear(generation);
    }
  }, [isStale, markAttemptClear, markAttemptUnclear]);

  const runPoll = useCallback(
    async (key: string, tenantId: string, eventId: string, generation: number) => {
      const outcome = await pollOperation(
        key,
        tenantId,
        eventId,
        {
          onStart: () => {
            if (isStale(generation)) return;
            setPolling(true);
            setUx({
              kind: 'polling',
              title: 'Đang dò trạng thái thao tác…',
              detail: `GET /api/bff/operations/${key} (timeout / retryable).`,
              retryable: true,
            });
          },
          onRaw: (json) => {
            if (isStale(generation)) return;
            setRaw(JSON.stringify(json, null, 2));
          },
          onTransient: (kind) => {
            if (isStale(generation)) return;
            setUx(kind === 'network' ? networkMessage() : timeoutMessage());
          },
          onSuccess: (body) => applySuccess(body, generation),
          onError: (body) => applyError(body, generation),
          onFinally: () => {
            if (isStale(generation)) return;
            setPolling(false);
          },
        },
        { isCancelled: () => isStale(generation) },
      );
      if (isStale(generation)) return outcome;
      if (outcome === 'timeout' || outcome === 'cancelled') {
        markAttemptUnclear(generation);
      }
      return outcome;
    },
    [applyError, applySuccess, isStale, markAttemptUnclear],
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const fingerprint = redeemPayloadFingerprint(form);
    const { key } = resolveIdempotencyKey(attempt, fingerprint, () => crypto.randomUUID());
    const nextAttempt: RedeemAttempt = { key, fingerprint, unclear: true };
    const generation = generationRef.current;
    setAttempt(nextAttempt);
    setIdempotencyKey(key);
    setTicket(null);
    setTickets(null);
    setRaw(null);
    setUx(verifyingMessage());

    startTransition(async () => {
      const result = await fetchJson(
        '/api/bff/redeem',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: form.tenantId.trim(),
            eventId: form.eventId.trim(),
            code: form.code.trim(),
            formVersion: form.formVersion.trim() || undefined,
            termsVersion: form.termsVersion.trim() || undefined,
            idempotencyKey: key,
          }),
        },
        REQUEST_TIMEOUT_MS,
      );

      if (isStale(generation)) return;

      if (result.timedOut || result.networkError) {
        setUx(result.networkError ? networkMessage() : timeoutMessage());
        setRaw(null);
        // Outcome unclear — poll same key; never claim success from network loss alone.
        await runPoll(key, form.tenantId.trim(), form.eventId.trim(), generation);
        return;
      }

      setRaw(JSON.stringify(result.json, null, 2));

      if (result.status >= 200 && result.status < 300 && isRedeemResponse(result.json)) {
        applySuccess(result.json, generation);
        return;
      }

      if (isApiError(result.json)) {
        const mapped = messageForApiError(
          result.json.code,
          result.json.message,
          result.json.retryable,
        );
        setUx(mapped);
        if (mapped.retryable || result.status === 503) {
          await runPoll(key, form.tenantId.trim(), form.eventId.trim(), generation);
        } else {
          markAttemptClear(generation);
        }
        return;
      }

      setUx(messageForApiError(undefined, `HTTP ${result.status}`));
      markAttemptClear(generation);
    });
  }

  function pollAgain() {
    if (!attempt?.unclear || !attempt.key || busy) return;
    const generation = generationRef.current;
    const key = attempt.key;
    startTransition(async () => {
      await runPoll(key, form.tenantId.trim(), form.eventId.trim(), generation);
    });
  }

  function loadTickets() {
    const generation = generationRef.current;
    startTransition(async () => {
      const qs = new URLSearchParams({ tenantId: form.tenantId.trim() });
      const result = await fetchJson(
        `/api/bff/tickets?${qs}`,
        { method: 'GET' },
        REQUEST_TIMEOUT_MS,
      );
      if (isStale(generation)) return;
      if (result.timedOut || result.networkError) {
        setUx(result.networkError ? networkMessage() : timeoutMessage());
        return;
      }
      setRaw(JSON.stringify(result.json, null, 2));
      if (result.status >= 200 && result.status < 300) {
        setTickets(result.json as MeTicketsResponse);
        setUx({
          kind: 'success',
          title: 'Danh sách vé (API thật)',
          detail: `GET /v1/me/tickets?tenantId=… — ${(result.json as MeTicketsResponse)?.tickets?.length ?? 0} vé.`,
          retryable: false,
        });
      } else if (isApiError(result.json)) {
        applyError(result.json, generation);
      } else {
        setUx(messageForApiError(undefined, `HTTP ${result.status}`));
      }
    });
  }

  const statusClass = useMemo(() => {
    if (!ux) return '';
    return `redeem-status redeem-status--${ux.kind}`;
  }, [ux]);

  return (
    <div className="redeem-form">
      <form onSubmit={onSubmit} aria-labelledby="redeem-form-title">
        <h2 id="redeem-form-title">Đổi mã lấy vé</h2>
        <p className="intro">
          Gọi Nest <code>POST /v1/tenants/&#123;tenantId&#125;/events/&#123;eventId&#125;/redemptions</code>{' '}
          qua BFF. Session Keycloak nằm trong cookie HttpOnly — không mock proof.
        </p>

        <div className="redeem-fields">
          <label>
            Tenant ID (UUID)
            <input
              name="tenantId"
              required
              value={form.tenantId}
              onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
              autoComplete="off"
              spellCheck={false}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <label>
            Event ID (UUID)
            <input
              name="eventId"
              required
              value={form.eventId}
              onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))}
              autoComplete="off"
              spellCheck={false}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <label>
            Mã đổi vé
            <input
              name="code"
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              autoComplete="off"
              spellCheck={false}
              placeholder="REDEMPTION-CODE"
            />
          </label>
          <div className="redeem-versions">
            <label>
              formVersion
              <input
                name="formVersion"
                value={form.formVersion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, formVersion: e.target.value }))
                }
              />
            </label>
            <label>
              termsVersion
              <input
                name="termsVersion"
                value={form.termsVersion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, termsVersion: e.target.value }))
                }
              />
            </label>
          </div>
        </div>

        <div className="auth-buttons">
          <button type="submit" disabled={busy}>
            {busy ? 'Đang xử lý…' : 'Đổi mã (API thật)'}
          </button>
          <button type="button" onClick={pollAgain} disabled={!canRepoll}>
            Dò lại trạng thái
          </button>
          <button type="button" onClick={loadTickets} disabled={busy || !form.tenantId.trim()}>
            Xem vé của tôi
          </button>
          <a className="button-link" href="/api/auth/login">
            Đăng nhập Keycloak
          </a>
        </div>
      </form>

      {ux ? (
        <section className={statusClass} aria-live="polite" role="status">
          <h3>{ux.title}</h3>
          <p>{ux.detail}</p>
          {idempotencyKey ? (
            <p className="redeem-meta">
              idempotency-key: <code>{idempotencyKey}</code>
            </p>
          ) : null}
        </section>
      ) : null}

      {ticket ? (
        <section className="redeem-ticket" aria-labelledby="ticket-title">
          <h3 id="ticket-title">Vé từ API</h3>
          <dl>
            <div>
              <dt>ticketId</dt>
              <dd>{ticket.ticketId}</dd>
            </div>
            <div>
              <dt>state</dt>
              <dd>{ticket.state}</dd>
            </div>
            <div>
              <dt>eventId</dt>
              <dd>{ticket.eventId}</dd>
            </div>
            <div>
              <dt>ticketTypeId</dt>
              <dd>{ticket.ticketTypeId}</dd>
            </div>
            <div>
              <dt>sourceId</dt>
              <dd>{ticket.sourceId}</dd>
            </div>
            <div>
              <dt>credentialVersion</dt>
              <dd>{ticket.credentialVersion}</dd>
            </div>
            <div>
              <dt>requestId</dt>
              <dd>{ticket.requestId}</dd>
            </div>
            <div>
              <dt>operationId</dt>
              <dd>{ticket.operationId}</dd>
            </div>
            <div>
              <dt>replayed</dt>
              <dd>{String(ticket.replayed)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {tickets?.tickets?.length ? (
        <section className="redeem-ticket-list" aria-labelledby="tickets-title">
          <h3 id="tickets-title">Vé của tôi (tenant)</h3>
          <ul>
            {tickets.tickets.map((t) => (
              <li key={t.ticketId}>
                <code>{t.ticketId}</code> · {t.state} · event {t.eventId}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {raw ? (
        <pre className="me-result" tabIndex={0}>
          {raw}
        </pre>
      ) : null}
    </div>
  );
}
