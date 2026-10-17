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
import type {
  FormAnswerValue,
  FormDefinition,
  MeTicketsResponse,
  RedeemResponse,
} from '@ticket/contracts';
import {
  messageForApiError,
  messageForDecision,
  messageForOwnerStatus,
  networkMessage,
  timeoutMessage,
  unknownMessage,
  verifyingMessage,
  type RedeemUxMessage,
} from '../../src/redeem/messages';
import {
  redeemPayloadFingerprint,
  resolveIdempotencyKey,
  type RedeemAttempt,
} from '../../src/redeem/attempt-key';
import { redeemMutate } from '../../src/redeem/client-fetch';
import { decideRedeemBody, type RedeemDecision } from '../../src/redeem/decide';
import { fetchJson } from '../../src/redeem/fetch-json';
import {
  focusFirstFieldError,
  RedeemFormFields,
} from '../../src/redeem/form-fields';
import {
  requireTermsConsent,
  validateFormAnswers,
} from '../../src/redeem/form-validate';
import { fetchOwnerRedemptionStatus } from '../../src/redeem/owner-status';
import {
  isApiError,
  pollOperation,
  REQUEST_TIMEOUT_MS,
} from '../../src/redeem/poll-operation';
import { loadPublishedRedeemSchema } from '../../src/redeem/published-schema';
import { SurfaceState } from '../../src/ui/surface-state';

type Props = {
  initialTenantId?: string;
  initialEventId?: string;
  initialTenantSlug?: string;
  initialEventSlug?: string;
};

export function RedeemForm({
  initialTenantId = '',
  initialEventId = '',
  initialTenantSlug = '',
  initialEventSlug = '',
}: Props) {
  const [tenantId, setTenantId] = useState(initialTenantId);
  const [eventId, setEventId] = useState(initialEventId);
  const [tenantSlug, setTenantSlug] = useState(initialTenantSlug);
  const [eventSlug, setEventSlug] = useState(initialEventSlug);
  const [code, setCode] = useState('');
  const [formDefinition, setFormDefinition] = useState<FormDefinition | null>(
    null,
  );
  const [termsVersion, setTermsVersion] = useState<string | null>(null);
  const [termsBody, setTermsBody] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, FormAnswerValue>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [schemaNotice, setSchemaNotice] = useState<string | null>(null);
  const [ux, setUx] = useState<RedeemUxMessage | null>(null);
  const [decision, setDecision] = useState<RedeemDecision | null>(null);
  const [ticket, setTicket] = useState<RedeemResponse | null>(null);
  const [tickets, setTickets] = useState<MeTicketsResponse | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<RedeemAttempt | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
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

  const isStale = useCallback(
    (generation: number) => generation !== generationRef.current,
    [],
  );

  const applyDecision = useCallback(
    (next: RedeemDecision, generation: number, fingerprint?: string) => {
      if (isStale(generation)) return;
      setDecision(next);
      setUx(messageForDecision(next));
      if (next.kind === 'issued') {
        setTicket({
          ticketId: next.ticketId,
          requestId: next.requestId ?? '',
          operationId: next.operationId ?? '',
          eventId: eventId.trim(),
          ticketTypeId: '',
          sourceId: '',
          state: 'ACTIVE',
          credentialVersion: 1,
          replayed: next.replayed,
        });
        setPendingRequestId(next.requestId ?? null);
        setAttempt(null);
        return;
      }
      if (next.kind === 'pending') {
        setTicket(null);
        setPendingRequestId(next.requestId);
        setAttempt(null);
        return;
      }
      if (next.kind === 'unknown') {
        setTicket(null);
        if (fingerprint) {
          setAttempt({
            key: next.idempotencyKey,
            fingerprint,
            unclear: true,
          });
        }
        return;
      }
      if (next.kind === 'stale') {
        setTicket(null);
        setAttempt(null);
        setSchemaNotice(
          'Form/terms đã đổi trên server — tải lại schema published và đồng ý lại.',
        );
        return;
      }
      if (next.kind === 'field_errors') {
        const nextErrors: Record<string, string> = {};
        for (const f of next.fields) {
          nextErrors[f.fieldId] = f.message;
        }
        setFieldErrors(nextErrors);
        focusFirstFieldError(next.fields.map((f) => f.fieldId));
        setAttempt(null);
        return;
      }
      setTicket(null);
      setAttempt(null);
    },
    [eventId, isStale],
  );

  const runPoll = useCallback(
    async (
      key: string,
      scopeTenantId: string,
      scopeEventId: string,
      generation: number,
      fingerprint: string,
    ) => {
      const outcome = await pollOperation(
        key,
        scopeTenantId,
        scopeEventId,
        {
          onStart: () => {
            if (isStale(generation)) return;
            setPolling(true);
            setUx({
              kind: 'polling',
              title: 'Đang dò trạng thái thao tác…',
              detail: `GET /api/bff/operations/${key} (command=redemption.redeem).`,
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
          onDecision: (next) => applyDecision(next, generation, fingerprint),
          onFinally: () => {
            if (isStale(generation)) return;
            setPolling(false);
          },
        },
        { isCancelled: () => isStale(generation) },
      );
      if (isStale(generation)) return outcome;
      if (outcome === 'timeout' || outcome === 'cancelled') {
        setAttempt({ key, fingerprint, unclear: true });
        setUx(unknownMessage(key));
      }
      return outcome;
    },
    [applyDecision, isStale],
  );

  function loadSchema() {
    const generation = generationRef.current;
    startTransition(async () => {
      setSchemaNotice('Đang tải form/terms published…');
      const result = await loadPublishedRedeemSchema(tenantSlug, eventSlug);
      if (isStale(generation)) return;
      if (result.status === 'ok') {
        setFormDefinition(result.schema.form);
        setTermsVersion(result.schema.terms?.version ?? null);
        setTermsBody(result.schema.terms?.bodyMarkdown ?? null);
        if (result.schema.eventId) setEventId(result.schema.eventId);
        setAnswers({});
        setTermsAccepted(false);
        setFieldErrors({});
        setSchemaNotice(
          `Đã tải schema published v${result.schema.schemaVersion} / config v${result.schema.publishedConfigVersion}. Không nhập formVersion/termsVersion thủ công.`,
        );
        return;
      }
      setFormDefinition(null);
      setTermsVersion(null);
      setTermsBody(null);
      if (result.status === 'not-found') {
        setSchemaNotice('Không tìm thấy event published. Draft không được hiện.');
        return;
      }
      if (result.status === 'unreachable') {
        setSchemaNotice(
          'Published API không tới được (live F-BE/public sau). Fail-closed — không dùng form demo.',
        );
        return;
      }
      setSchemaNotice('Published schema không hợp lệ hoặc thiếu slug.');
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const validated = validateFormAnswers(formDefinition, answers);
    const termsIssue = requireTermsConsent({ termsVersion, termsAccepted });
    const nextErrors: Record<string, string> = {};
    if (!validated.ok) {
      for (const issue of validated.issues) {
        nextErrors[issue.fieldId] = issue.message;
      }
    }
    if (termsIssue) nextErrors.terms = termsIssue.message;
    setFieldErrors(nextErrors);
    if (!validated.ok || termsIssue) {
      focusFirstFieldError(Object.keys(nextErrors));
      return;
    }

    const payload = {
      tenantId: tenantId.trim(),
      eventId: eventId.trim(),
      code: code.trim(),
      formVersion: formDefinition?.formVersion ?? '',
      termsVersion: termsVersion ?? '',
      answers: validated.answers,
      termsAccepted: termsAccepted === true,
    };
    const fingerprint = redeemPayloadFingerprint(payload);
    const { key } = resolveIdempotencyKey(attempt, fingerprint, () =>
      crypto.randomUUID(),
    );
    const nextAttempt: RedeemAttempt = { key, fingerprint, unclear: true };
    const generation = generationRef.current;
    setAttempt(nextAttempt);
    setIdempotencyKey(key);
    setTicket(null);
    setTickets(null);
    setDecision(null);
    setRaw(null);
    setUx(verifyingMessage());

    startTransition(async () => {
      const result = await redeemMutate(
        '/api/bff/redeem',
        {
          tenantId: payload.tenantId,
          eventId: payload.eventId,
          code: payload.code,
          formVersion: formDefinition?.formVersion,
          termsVersion: termsVersion ?? undefined,
          answers: validated.answers,
          termsAccepted: termsAccepted === true ? true : undefined,
          idempotencyKey: key,
        },
        REQUEST_TIMEOUT_MS,
      );

      if (isStale(generation)) return;

      if (result.timedOut || result.networkError) {
        setUx(result.networkError ? networkMessage() : timeoutMessage());
        setRaw(null);
        await runPoll(
          key,
          payload.tenantId,
          payload.eventId,
          generation,
          fingerprint,
        );
        return;
      }

      setRaw(JSON.stringify(result.json, null, 2));
      const next = decideRedeemBody(
        result.status,
        result.json,
        key,
        false,
      );

      const retryableApi =
        isApiError(result.json) &&
        messageForApiError(
          result.json.code,
          result.json.message,
          result.json.retryable,
        ).retryable;

      if (next.kind === 'unknown' || retryableApi || result.status === 503) {
        await runPoll(
          key,
          payload.tenantId,
          payload.eventId,
          generation,
          fingerprint,
        );
        return;
      }

      applyDecision(next, generation, fingerprint);
    });
  }

  function pollAgain() {
    if (!attempt?.unclear || !attempt.key || busy) return;
    const generation = generationRef.current;
    const key = attempt.key;
    const fingerprint = attempt.fingerprint;
    startTransition(async () => {
      await runPoll(
        key,
        tenantId.trim(),
        eventId.trim(),
        generation,
        fingerprint,
      );
    });
  }

  function refreshOwnerStatus() {
    if (!pendingRequestId || busy) return;
    const generation = generationRef.current;
    startTransition(async () => {
      const result = await fetchOwnerRedemptionStatus(pendingRequestId);
      if (isStale(generation)) return;
      if (result.status === 'ok') {
        setUx(messageForOwnerStatus(result.body));
        setRaw(JSON.stringify(result.body, null, 2));
        if (result.body.status === 'ISSUED') {
          setTicket({
            ticketId: result.body.ticketId,
            requestId: result.body.requestId,
            operationId: '',
            eventId: result.body.eventId,
            ticketTypeId: result.body.ticketTypeId,
            sourceId: result.body.sourceId,
            state: 'ACTIVE',
            credentialVersion: 1,
            replayed: false,
          });
        }
        return;
      }
      if (result.status === 'unauthorized') {
        setUx(messageForApiError('UNAUTHENTICATED'));
        return;
      }
      setUx(
        messageForApiError(
          undefined,
          result.status === 'not-found'
            ? 'Không tìm thấy yêu cầu (owner scope).'
            : 'Không đọc được trạng thái hiện tại.',
        ),
      );
    });
  }

  function loadTickets() {
    const generation = generationRef.current;
    startTransition(async () => {
      const qs = new URLSearchParams({ tenantId: tenantId.trim() });
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
        setUx(
          messageForApiError(
            result.json.code,
            result.json.message,
            result.json.retryable,
          ),
        );
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
      <form onSubmit={onSubmit} aria-labelledby="redeem-form-title" noValidate>
        <h2 id="redeem-form-title">Đổi mã lấy vé</h2>
        <p className="intro">
          Form/terms lấy từ projection published (không nhập version thủ công).
          Pending ≠ vé; timeout giữ cùng idempotency-key.
        </p>

        <div className="redeem-fields">
          <label>
            Tenant ID (UUID — scope mutation)
            <input
              name="tenantId"
              required
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <label>
            Event ID (UUID — tự điền khi tải published)
            <input
              name="eventId"
              required
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <div className="redeem-versions">
            <label>
              Tenant slug (published)
              <input
                name="tenantSlug"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label>
              Event slug (published)
              <input
                name="eventSlug"
                value={eventSlug}
                onChange={(e) => setEventSlug(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={loadSchema}
            disabled={busy || !tenantSlug.trim() || !eventSlug.trim()}
          >
            Tải form/terms published
          </button>
          {schemaNotice ? (
            <SurfaceState
              kind={
                schemaNotice.startsWith('Đang tải')
                  ? 'loading'
                  : schemaNotice.startsWith('Không') ||
                      schemaNotice.startsWith('Published')
                    ? 'error'
                    : 'empty'
              }
              title={
                schemaNotice.startsWith('Đang tải')
                  ? 'Đang tải form/terms…'
                  : schemaNotice.startsWith('Đã tải')
                    ? 'Schema đã sẵn sàng'
                    : 'Trạng thái schema'
              }
              detail={schemaNotice}
              testId="redeem-schema-notice"
            />
          ) : null}

          <label>
            Mã đổi vé
            <input
              name="code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="REDEMPTION-CODE"
            />
          </label>

          {formDefinition ? (
            <RedeemFormFields
              definition={formDefinition}
              answers={answers}
              fieldErrors={fieldErrors}
              disabled={busy}
              onChange={(fieldId, value) => {
                setAnswers((prev) => ({ ...prev, [fieldId]: value }));
                setFieldErrors((prev) => {
                  if (!prev[fieldId]) return prev;
                  const next = { ...prev };
                  delete next[fieldId];
                  return next;
                });
              }}
            />
          ) : (
            <SurfaceState
              kind="empty"
              title="Chưa có form published"
              detail="Tải schema bằng slug tenant/event, hoặc sự kiện không yêu cầu field (chỉ mã + terms nếu có)."
              testId="redeem-schema-empty"
            />
          )}

          {termsVersion ? (
            <fieldset className="redeem-terms">
              <legend>Điều khoản ({termsVersion})</legend>
              {termsBody ? (
                <pre className="redeem-terms-body" tabIndex={0}>
                  {termsBody}
                </pre>
              ) : null}
              <label className="redeem-checkbox" htmlFor="terms-accepted">
                <input
                  id="terms-accepted"
                  name="termsAccepted"
                  type="checkbox"
                  checked={termsAccepted}
                  aria-invalid={fieldErrors.terms ? true : undefined}
                  aria-describedby={
                    fieldErrors.terms ? 'field-error-terms' : undefined
                  }
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    setFieldErrors((prev) => {
                      if (!prev.terms) return prev;
                      const next = { ...prev };
                      delete next.terms;
                      return next;
                    });
                  }}
                />
                <span>Tôi đồng ý với điều khoản published</span>
              </label>
              {fieldErrors.terms ? (
                <p id="field-error-terms" className="redeem-field-error" role="alert">
                  {fieldErrors.terms}
                </p>
              ) : null}
            </fieldset>
          ) : null}
        </div>

        <div className="auth-buttons">
          <button type="submit" disabled={busy}>
            {busy ? 'Đang xử lý…' : 'Đổi mã (API thật)'}
          </button>
          <button type="button" onClick={pollAgain} disabled={!canRepoll}>
            Dò lại trạng thái
          </button>
          <button
            type="button"
            onClick={refreshOwnerStatus}
            disabled={busy || !pendingRequestId}
          >
            Làm mới trạng thái yêu cầu
          </button>
          <button
            type="button"
            onClick={loadTickets}
            disabled={busy || !tenantId.trim()}
          >
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
          {decision?.kind === 'pending' ? (
            <p className="redeem-meta">
              pending requestId: <code>{decision.requestId}</code>
            </p>
          ) : null}
        </section>
      ) : null}

      {ticket?.ticketId ? (
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
              <dt>requestId</dt>
              <dd>{ticket.requestId}</dd>
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
