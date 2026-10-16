'use client';

import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from 'react';
import type {
  ApiError,
  MeTicketsResponse,
  OperationStatusResponse,
  RedeemResponse,
} from '@ticket/contracts';
import {
  messageForApiError,
  successMessage,
  timeoutMessage,
  verifyingMessage,
  type RedeemUxMessage,
} from '../../src/redeem/messages';

const REQUEST_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 1_500;
const POLL_MAX_MS = 30_000;

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

function isRedeemResponse(value: unknown): value is RedeemResponse {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.ticketId === 'string' &&
    typeof o.requestId === 'string' &&
    o.state === 'ACTIVE'
  );
}

function isApiError(value: unknown): value is ApiError {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return typeof o.code === 'string' && typeof o.message === 'string';
}

async function fetchJson(
  input: RequestInfo,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ status: number; json: unknown; timedOut: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
    let json: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = { code: 'INVALID_UPSTREAM_JSON', message: text.slice(0, 400) };
      }
    }
    return { status: response.status, json, timedOut: false };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { status: 0, json: null, timedOut: true };
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

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
  const [pending, startTransition] = useTransition();
  const [polling, setPolling] = useState(false);

  const busy = pending || polling;

  const applySuccess = useCallback((body: RedeemResponse) => {
    setTicket(body);
    setUx(successMessage(body.ticketId, body.replayed));
    setPolling(false);
  }, []);

  const applyError = useCallback((body: unknown) => {
    if (isApiError(body)) {
      setUx(messageForApiError(body.code, body.message, body.retryable));
    } else {
      setUx(messageForApiError(undefined, 'Unexpected response shape.'));
    }
    setPolling(false);
  }, []);

  const pollOperation = useCallback(
    async (key: string, tenantId: string, eventId: string) => {
      setPolling(true);
      setUx({
        kind: 'polling',
        title: 'Đang dò trạng thái thao tác…',
        detail: `GET /api/bff/operations/${key} (timeout / retryable).`,
        retryable: true,
      });
      const started = Date.now();
      while (Date.now() - started < POLL_MAX_MS) {
        const qs = new URLSearchParams({ tenantId, eventId, command: 'redeem' });
        const result = await fetchJson(
          `/api/bff/operations/${encodeURIComponent(key)}?${qs}`,
          { method: 'GET' },
          REQUEST_TIMEOUT_MS,
        );
        setRaw(JSON.stringify(result.json, null, 2));
        if (result.timedOut) {
          setUx(timeoutMessage());
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          continue;
        }
        const op = result.json as OperationStatusResponse | ApiError;
        if (isApiError(op) && !('status' in (op as object))) {
          applyError(op);
          return;
        }
        if (op && typeof op === 'object' && 'status' in op) {
          const status = (op as OperationStatusResponse).status;
          const response = (op as OperationStatusResponse).response;
          if (status === 'COMPLETED' && response) {
            if (isRedeemResponse(response)) {
              applySuccess(response);
              return;
            }
            if (isApiError(response)) {
              applyError(response);
              return;
            }
          }
          if (status === 'FAILED' && response && isApiError(response)) {
            applyError(response);
            return;
          }
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      setUx(timeoutMessage());
      setPolling(false);
    },
    [applyError, applySuccess],
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const key = crypto.randomUUID();
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

      if (result.timedOut) {
        setUx(timeoutMessage());
        setRaw(null);
        await pollOperation(key, form.tenantId.trim(), form.eventId.trim());
        return;
      }

      setRaw(JSON.stringify(result.json, null, 2));

      if (result.status >= 200 && result.status < 300 && isRedeemResponse(result.json)) {
        applySuccess(result.json);
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
          await pollOperation(key, form.tenantId.trim(), form.eventId.trim());
        }
        return;
      }

      setUx(messageForApiError(undefined, `HTTP ${result.status}`));
    });
  }

  function loadTickets() {
    startTransition(async () => {
      const qs = new URLSearchParams({ tenantId: form.tenantId.trim() });
      const result = await fetchJson(
        `/api/bff/tickets?${qs}`,
        { method: 'GET' },
        REQUEST_TIMEOUT_MS,
      );
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
        applyError(result.json);
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
