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
import { liveRegionForStatus } from '../../src/ui/live-region';
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

  const loadSchema = useCallback(() => {
    const generation = generationRef.current;
    const slugTenant = tenantSlug.trim();
    const slugEvent = eventSlug.trim();
    startTransition(async () => {
      setSchemaNotice('Đang tải biểu mẫu và điều khoản…');
      const result = await loadPublishedRedeemSchema(slugTenant, slugEvent);
      if (isStale(generation)) return;
      if (result.status === 'ok') {
        setFormDefinition(result.schema.form);
        setTermsVersion(result.schema.terms?.version ?? null);
        setTermsBody(result.schema.terms?.bodyMarkdown ?? null);
        if (result.schema.eventId) setEventId(result.schema.eventId);
        // AC-A4: never keep prior answers / silent terms accept after reload.
        setAnswers({});
        setTermsAccepted(false);
        setFieldErrors({});
        setSchemaNotice(
          'Đã tải biểu mẫu mới. Điền lại và đồng ý điều khoản trước khi gửi.',
        );
        return;
      }
      setFormDefinition(null);
      setTermsVersion(null);
      setTermsBody(null);
      setTermsAccepted(false);
      setAnswers({});
      if (result.status === 'not-found') {
        setSchemaNotice(
          'Không tìm thấy sự kiện đã xuất bản. Không dùng biểu mẫu demo.',
        );
        return;
      }
      if (result.status === 'unreachable') {
        setSchemaNotice(
          'Không tải được biểu mẫu sự kiện. Thử lại sau — không dùng bản demo.',
        );
        return;
      }
      setSchemaNotice('Biểu mẫu không hợp lệ hoặc thiếu mã sự kiện.');
    });
  }, [tenantSlug, eventSlug, isStale]);

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
        // AC-A4: clear prior consent/answers; soft-reload published form.
        setTicket(null);
        setAttempt(null);
        setTermsAccepted(false);
        setAnswers({});
        setFieldErrors({});
        setFormDefinition(null);
        setTermsVersion(null);
        setTermsBody(null);
        if (tenantSlug.trim() && eventSlug.trim()) {
          setSchemaNotice(
            'Biểu mẫu hoặc điều khoản đã đổi — đang tải lại. Bạn cần đồng ý lại trước khi gửi.',
          );
          queueMicrotask(() => {
            loadSchema();
          });
        } else {
          setSchemaNotice(
            'Biểu mẫu hoặc điều khoản đã đổi — nhập đường dẫn tổ chức/sự kiện rồi bấm «Tải biểu mẫu» và đồng ý lại.',
          );
        }
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
    [eventId, eventSlug, isStale, loadSchema, tenantSlug],
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
              title: 'Đang kiểm tra lại…',
              detail:
                'Đang xác nhận kết quả đổi mã. Chưa phải vé cho đến khi có xác nhận.',
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
          title: 'Vé của bạn',
          detail: `Có ${(result.json as MeTicketsResponse)?.tickets?.length ?? 0} vé trong tổ chức đã chọn.`,
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

  const statusLive = useMemo(
    () => (ux ? liveRegionForStatus(ux.kind) : null),
    [ux],
  );

  return (
    <div className="redeem-form">
      <form onSubmit={onSubmit} aria-labelledby="redeem-form-title" noValidate>
        <h2 id="redeem-form-title">Đổi mã lấy vé</h2>
        <p className="intro">
          Tải biểu mẫu sự kiện đã xuất bản, nhập mã và đồng ý điều khoản. Đang
          chờ duyệt chưa phải vé; nếu chưa rõ kết quả, bấm «Kiểm tra lại».
        </p>

        <div className="redeem-fields">
          <label>
            Mã tổ chức
            <input
              name="tenantId"
              required
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="UUID tổ chức"
            />
          </label>
          <label>
            Mã sự kiện (tự điền khi tải biểu mẫu)
            <input
              name="eventId"
              required
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="UUID sự kiện"
            />
          </label>
          <div className="redeem-versions">
            <label>
              Đường dẫn tổ chức
              <input
                name="tenantSlug"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label>
              Đường dẫn sự kiện
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
            Tải biểu mẫu
          </button>
          {schemaNotice ? (
            <SurfaceState
              kind={
                schemaNotice.startsWith('Đang tải')
                  ? 'loading'
                  : schemaNotice.startsWith('Không') ||
                      schemaNotice.startsWith('Biểu mẫu không')
                    ? 'error'
                    : 'empty'
              }
              title={
                schemaNotice.startsWith('Đang tải')
                  ? 'Đang tải biểu mẫu…'
                  : schemaNotice.startsWith('Đã tải')
                    ? 'Biểu mẫu sẵn sàng'
                    : 'Trạng thái biểu mẫu'
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
              title="Chưa có biểu mẫu"
              detail="Tải biểu mẫu bằng đường dẫn tổ chức/sự kiện, hoặc sự kiện chỉ cần mã và điều khoản."
              testId="redeem-schema-empty"
            />
          )}

          {termsVersion ? (
            <fieldset className="redeem-terms">
              <legend>Điều khoản</legend>
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
                <span>Tôi đồng ý với điều khoản</span>
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
            {busy ? 'Đang xử lý…' : 'Đổi mã lấy vé'}
          </button>
          <button type="button" onClick={pollAgain} disabled={!canRepoll}>
            Kiểm tra lại
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
            Đăng nhập
          </a>
        </div>
      </form>

      {ux && statusLive ? (
        <section
          className={statusClass}
          role={statusLive.role}
          aria-live={statusLive.ariaLive}
          aria-atomic={statusLive.ariaAtomic}
          data-testid={`redeem-ux-${ux.kind}`}
        >
          <h3>{ux.title}</h3>
          <p>{ux.detail}</p>
          {ux.kind === 'unknown' && canRepoll ? (
            <p>
              <button type="button" onClick={pollAgain} disabled={!canRepoll}>
                Kiểm tra lại
              </button>
            </p>
          ) : null}
          {ux.kind === 'auth' ? (
            <p>
              <a className="button" href="/api/auth/login">
                Cần đăng nhập
              </a>
            </p>
          ) : null}
          {(idempotencyKey || decision?.kind === 'pending') && (
            <details className="redeem-meta">
              <summary>Chi tiết kỹ thuật</summary>
              {idempotencyKey ? (
                <p>
                  Khóa thao tác: <code>{idempotencyKey}</code>
                </p>
              ) : null}
              {decision?.kind === 'pending' ? (
                <p>
                  Mã yêu cầu: <code>{decision.requestId}</code>
                </p>
              ) : null}
            </details>
          )}
        </section>
      ) : null}

      {ticket?.ticketId ? (
        <section
          className="redeem-ticket"
          aria-labelledby="ticket-title"
          data-testid="redeem-ticket-card"
        >
          <h3 id="ticket-title">Vé của bạn</h3>
          <dl>
            <div>
              <dt>Mã vé</dt>
              <dd>{ticket.ticketId}</dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>{ticket.state}</dd>
            </div>
            {ticket.requestId ? (
              <div>
                <dt>Mã yêu cầu</dt>
                <dd>{ticket.requestId}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {tickets?.tickets?.length ? (
        <section className="redeem-ticket-list" aria-labelledby="tickets-title">
          <h3 id="tickets-title">Vé của tôi</h3>
          <ul>
            {tickets.tickets.map((t) => (
              <li key={t.ticketId}>
                <code>{t.ticketId}</code> · {t.state}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {raw ? (
        <details className="redeem-meta">
          <summary>Chi tiết kỹ thuật (đóng mặc định)</summary>
          <pre
            className="me-result"
            tabIndex={0}
            aria-label="Phản hồi máy chủ dạng JSON — chỉ dành cho hỗ trợ kỹ thuật"
          >
            {raw}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
