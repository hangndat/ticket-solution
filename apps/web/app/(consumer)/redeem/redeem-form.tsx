'use client';

import { Button } from '@ticket/ui';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from 'react';
import {
  IDENTITY_ERROR_CODES,
  type FormAnswerValue,
  type FormDefinition,
  type MeTicketsResponse,
  type RedeemResponse,
} from '@ticket/contracts';
import { useAttendeeLocale } from '../../../src/i18n';
import {
  messageForApiError,
  messageForDecision,
  messageForOwnerStatus,
  networkMessage,
  timeoutMessage,
  unknownMessage,
  verifyingMessage,
  type RedeemUxMessage,
} from '../../../src/redeem/messages';
import {
  redeemFormCopy,
  schemaNoticeChrome,
  type SchemaNoticeKey,
} from '../../../src/redeem/form-copy';
import { ticketStateLabel } from '../../../src/owner-ticket/ticket-state';
import {
  redeemPayloadFingerprint,
  resolveIdempotencyKey,
  type RedeemAttempt,
} from '../../../src/redeem/attempt-key';
import { redeemMutate } from '../../../src/redeem/client-fetch';
import { decideRedeemBody, type RedeemDecision } from '../../../src/redeem/decide';
import { fetchJson } from '../../../src/redeem/fetch-json';
import {
  focusFirstFieldError,
  RedeemFormFields,
} from '../../../src/redeem/form-fields';
import {
  requireTermsConsent,
  validateFormAnswers,
} from '../../../src/redeem/form-validate';
import { fetchOwnerRedemptionStatus } from '../../../src/redeem/owner-status';
import {
  isApiError,
  pollOperation,
  REQUEST_TIMEOUT_MS,
} from '../../../src/redeem/poll-operation';
import { loadPublishedRedeemSchema } from '../../../src/redeem/published-schema';
import { isTenantBoundRedeemQuery } from '../../../src/redeem/global-entry';
import { validateRedeemScope } from '../../../src/redeem/redeem-scope';
import { resolveRedemptionCodeGlobal } from '../../../src/redeem/global-resolve';
import {
  clearStoredResolveToken,
  readStoredResolveToken,
  writeStoredResolveToken,
} from '../../../src/redeem/resolve-session';
import { redeemLoginHref } from '../../../src/redeem/login-href';
import { RedeemTermsConsent } from '../../../src/redeem/redeem-terms-consent';
import {
  authButtonsRow,
  introLead,
  meResultPre,
  redeemCodeField,
  redeemDevFormRoot,
  redeemDevStatusClass,
  redeemDevTicketCard,
  redeemErrorRing,
  redeemFieldsGrid,
  redeemGlobalContext,
  redeemMetaDetails,
  redeemOutcomeActions,
  redeemPrimaryActions,
  redeemProductErrorOutcome,
  redeemProductFormRoot,
  redeemProductLead,
  redeemProductUxClass,
  redeemSecondaryTools,
  redeemSuccessRing,
  redeemTicketCard,
  redeemTicketListSection,
  redeemVersionsGrid,
} from '../../../src/redeem/redeem-surface';
import { liveRegionForStatus } from '../../../src/ui/live-region';
import { SurfaceState } from '../../../src/ui/surface-state';

type Props = {
  productChrome?: boolean;
  globalEntry?: boolean;
  /** URL pins tenant/event — keeps dev/ops redeem tools. */
  tenantBound?: boolean;
  initialTenantId?: string;
  initialEventId?: string;
  initialTenantSlug?: string;
  initialEventSlug?: string;
};

export function RedeemForm({
  productChrome = false,
  globalEntry = false,
  tenantBound: tenantBoundProp,
  initialTenantId = '',
  initialEventId = '',
  initialTenantSlug = '',
  initialEventSlug = '',
}: Props) {
  const redeemLogin = redeemLoginHref({
    tenantId: initialTenantId,
    eventId: initialEventId,
    tenantSlug: initialTenantSlug,
    eventSlug: initialEventSlug,
  });
  const { locale } = useAttendeeLocale();
  const copy = redeemFormCopy(locale);
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
  const [schemaNotice, setSchemaNotice] = useState<SchemaNoticeKey | null>(
    null,
  );
  const [publishedSchemaReady, setPublishedSchemaReady] = useState(false);
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
  const tenantBound =
    tenantBoundProp ??
    isTenantBoundRedeemQuery({
      tenantId: initialTenantId,
      eventId: initialEventId,
      tenantSlug: initialTenantSlug,
      eventSlug: initialEventSlug,
    });
  const attendeeSingleCodeSurface = productChrome && !tenantBound;
  const singleCodeFlow = globalEntry || attendeeSingleCodeSurface;

  const [globalPhase, setGlobalPhase] = useState<'enter-code' | 'confirm'>(
    singleCodeFlow ? 'enter-code' : 'confirm',
  );
  const [resolveToken, setResolveToken] = useState<string | null>(() =>
    singleCodeFlow ? readStoredResolveToken() : null,
  );
  const [globalContext, setGlobalContext] = useState<{
    tenantDisplayName: string;
    eventTitle: string;
    ticketTypeLabel: string;
  } | null>(null);
  const generationRef = useRef(0);
  const loadedSlugPairRef = useRef<string | null>(null);

  const busy = pending || polling;
  const outcomeRequiresStatusCheck =
    decision?.kind === 'pending' || Boolean(attempt?.unclear);
  const showDevScopeFields =
    tenantBound && (!productChrome || !globalEntry);
  const slugPinnedSchema =
    !singleCodeFlow &&
    Boolean(tenantSlug.trim() && eventSlug.trim());
  const canRepoll = Boolean(attempt?.unclear && attempt.key && !busy);

  const isStale = useCallback(
    (generation: number) => generation !== generationRef.current,
    [],
  );

  /* eslint-disable react-hooks/preserve-manual-memoization -- stable setters */
  const loadSchema = useCallback(() => {
    const generation = ++generationRef.current;
    const slugTenant = tenantSlug.trim();
    const slugEvent = eventSlug.trim();
    const pairKey =
      slugTenant && slugEvent ? `${slugTenant}\u0000${slugEvent}` : null;
    startTransition(async () => {
      setPublishedSchemaReady(false);
      setSchemaNotice('loadingForm');
      const result = await loadPublishedRedeemSchema(slugTenant, slugEvent);
      if (isStale(generation)) return;
      if (result.status === 'ok') {
        if (pairKey) loadedSlugPairRef.current = pairKey;
        setPublishedSchemaReady(true);
        setFormDefinition(result.schema.form);
        setTermsVersion(result.schema.terms?.version ?? null);
        setTermsBody(result.schema.terms?.bodyMarkdown ?? null);
        if (result.schema.eventId) setEventId(result.schema.eventId);
        if (result.schema.tenantId) setTenantId(result.schema.tenantId);
        // AC-A4: never keep prior answers / silent terms accept after reload.
        setAnswers({});
        setTermsAccepted(false);
        setFieldErrors({});
        setSchemaNotice(
          result.schema.tenantId ? 'loadedForm' : 'loadedFormNoTenant',
        );
        return;
      }
      setPublishedSchemaReady(false);
      setFormDefinition(null);
      setTermsVersion(null);
      setTermsBody(null);
      setTermsAccepted(false);
      setAnswers({});
      if (result.status === 'not-found') {
        setSchemaNotice('eventNotFound');
        return;
      }
      if (result.status === 'unreachable') {
        setSchemaNotice('formUnreachable');
        return;
      }
      setSchemaNotice('formInvalid');
    });
  }, [tenantSlug, eventSlug, isStale]);

  useEffect(() => {
    if (globalEntry || !productChrome) return;
    const slugTenant = initialTenantSlug.trim();
    const slugEvent = initialEventSlug.trim();
    if (!slugTenant || !slugEvent) return;
    const pairKey = `${slugTenant}\u0000${slugEvent}`;
    if (loadedSlugPairRef.current === pairKey) return;
    loadSchema();
  }, [
    globalEntry,
    productChrome,
    initialTenantSlug,
    initialEventSlug,
    loadSchema,
  ]);

  const applyDecision = useCallback(
    (next: RedeemDecision, generation: number, fingerprint?: string) => {
      if (isStale(generation)) return;
      setDecision(next);
      setUx(messageForDecision(next, locale));
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
        setPublishedSchemaReady(false);
        if (tenantSlug.trim() && eventSlug.trim()) {
          setSchemaNotice('staleReloading');
          queueMicrotask(() => {
            loadSchema();
          });
        } else {
          setSchemaNotice('staleNeedPath');
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
    [eventId, eventSlug, isStale, loadSchema, tenantSlug, locale],
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
            const pollCopy = redeemFormCopy(locale);
            setUx({
              kind: 'polling',
              title: pollCopy.pollingTitle,
              detail: pollCopy.pollingDetail,
              retryable: true,
            });
          },
          onRaw: (json) => {
            if (isStale(generation)) return;
            setRaw(JSON.stringify(json, null, 2));
          },
          onTransient: (kind) => {
            if (isStale(generation)) return;
            setUx(
              kind === 'network'
                ? networkMessage(locale)
                : timeoutMessage(locale),
            );
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
        setUx(unknownMessage(key, locale));
      }
      return outcome;
    },
    [applyDecision, isStale, locale],
  );
  /* eslint-enable react-hooks/preserve-manual-memoization */

  function resetGlobalResolveSession() {
    setGlobalPhase('enter-code');
    setResolveToken(null);
    setGlobalContext(null);
    clearStoredResolveToken();
    setFormDefinition(null);
    setTermsVersion(null);
    setTermsBody(null);
    setAnswers({});
    setTermsAccepted(false);
    setTenantId('');
    setEventId('');
    setSchemaNotice(null);
    setPublishedSchemaReady(false);
    setAttempt(null);
    setIdempotencyKey(null);
    setDecision(null);
    setPendingRequestId(null);
    setTicket(null);
    setRaw(null);
    setUx(null);
  }

  function resetRedeemAttempt() {
    setUx(null);
    setCode('');
    setTicket(null);
    if (singleCodeFlow) {
      resetGlobalResolveSession();
    }
  }

  function onGlobalResolve() {
    if (!singleCodeFlow || busy) return;
    const trimmed = code.trim();
    if (!trimmed) {
      setUx(
        messageForApiError(
          'CODE_INVALID',
          copy.codeRequired,
          undefined,
          locale,
        ),
      );
      return;
    }
    const generation = generationRef.current;
    setUx(verifyingMessage(locale));
    setSchemaNotice('resolvingCode');
    startTransition(async () => {
      const result = await resolveRedemptionCodeGlobal(trimmed);
      if (isStale(generation)) return;
      if (result.status === 'network') {
        setUx(networkMessage(locale));
        setSchemaNotice(null);
        return;
      }
      if (result.status === 'error') {
        setUx(
          messageForApiError(
            result.code,
            result.message,
            result.httpStatus >= 500,
            locale,
          ),
        );
        setSchemaNotice(null);
        return;
      }
      const body = result.body;
      if (!body.redemptionWindow.open) {
        setUx(
          messageForApiError(
            'REDEMPTION_WINDOW_CLOSED',
            undefined,
            undefined,
            locale,
          ),
        );
        setSchemaNotice(null);
        return;
      }
      setTenantId(body.tenantId);
      setEventId(body.eventId);
      setGlobalContext({
        tenantDisplayName: body.tenantDisplayName,
        eventTitle: body.eventTitle,
        ticketTypeLabel: body.ticketTypeLabel,
      });
      setPublishedSchemaReady(true);
      setFormDefinition(body.published.form);
      setTermsVersion(body.published.terms?.version ?? null);
      setTermsBody(body.published.terms?.bodyMarkdown ?? null);
      setAnswers({});
      setTermsAccepted(false);
      setFieldErrors({});
      setResolveToken(body.resolveToken);
      writeStoredResolveToken(body.resolveToken);
      setGlobalPhase('confirm');
      setSchemaNotice('resolvedNamed');
      setUx(null);
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || outcomeRequiresStatusCheck || decision?.kind === 'issued') return;
    if (singleCodeFlow && globalPhase === 'enter-code') {
      onGlobalResolve();
      return;
    }
    if (
      slugPinnedSchema &&
      !publishedSchemaReady &&
      !formDefinition &&
      !termsVersion
    ) {
      setUx({
        kind: 'error',
        title: copy.waitingFormTitle,
        detail: copy.waitingFormDetail,
        retryable: true,
      });
      return;
    }
    const scopeIssue = validateRedeemScope(tenantId, eventId);
    const validated = validateFormAnswers(formDefinition, answers);
    const termsIssue = requireTermsConsent({ termsVersion, termsAccepted });
    const nextErrors: Record<string, string> = {};
    if (scopeIssue) nextErrors[scopeIssue.fieldId] = scopeIssue.message;
    if (!validated.ok) {
      for (const issue of validated.issues) {
        nextErrors[issue.fieldId] = issue.message;
      }
    }
    if (termsIssue) nextErrors.terms = termsIssue.message;
    setFieldErrors(nextErrors);
    if (!validated.ok || termsIssue || scopeIssue) {
      if (scopeIssue && !showDevScopeFields) {
        setUx({
          ...messageForApiError('SCOPE_REQUIRED', scopeIssue.message, false, locale),
          detail: scopeIssue.message,
        });
      }
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
    setUx(verifyingMessage(locale));

    const tokenForIssue =
      resolveToken?.trim() || readStoredResolveToken() || undefined;

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
          ...(singleCodeFlow && tokenForIssue
            ? { resolveToken: tokenForIssue }
            : {}),
        },
        REQUEST_TIMEOUT_MS,
      );

      if (isStale(generation)) return;

      if (result.timedOut || result.networkError) {
        setUx(
          result.networkError
            ? networkMessage(locale)
            : timeoutMessage(locale),
        );
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
          locale,
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

      if (
        singleCodeFlow &&
        isApiError(result.json) &&
        (result.json.code === 'RESOLVE_TOKEN_STALE' ||
          result.json.code === 'RESOLVE_TOKEN_REQUIRED')
      ) {
        resetGlobalResolveSession();
      }

      if (next.kind === 'issued') {
        clearStoredResolveToken();
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
      const result = await fetchOwnerRedemptionStatus(pendingRequestId, tenantId);
      if (isStale(generation)) return;
      if (result.status === 'ok') {
        setUx(messageForOwnerStatus(result.body, locale));
        setRaw(JSON.stringify(result.body, null, 2));
        if (result.body.status === 'ISSUED') {
          setDecision({
            kind: 'issued',
            ticketId: result.body.ticketId,
            requestId: result.body.requestId,
            replayed: false,
          });
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
        } else if (result.body.status === 'REJECTED' || result.body.status === 'EXPIRED') {
          setDecision(null);
          setPendingRequestId(null);
        }
        return;
      }
      if (result.status === 'unauthorized') {
        setUx(messageForApiError('UNAUTHENTICATED', undefined, undefined, locale));
        return;
      }
      setUx(
        messageForApiError(
          undefined,
          result.status === 'not-found'
            ? redeemFormCopy(locale).ownerNotFound
            : redeemFormCopy(locale).ownerUnread,
          undefined,
          locale,
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
        setUx(
          result.networkError
            ? networkMessage(locale)
            : timeoutMessage(locale),
        );
        return;
      }
      setRaw(JSON.stringify(result.json, null, 2));
      if (result.status >= 200 && result.status < 300) {
        setTickets(result.json as MeTicketsResponse);
        const loaded = redeemFormCopy(locale);
        const count = String(
          (result.json as MeTicketsResponse)?.tickets?.length ?? 0,
        );
        setUx({
          kind: 'success',
          title: loaded.ticketsLoadedTitle,
          detail: loaded.ticketsLoadedDetail.replace('{count}', count),
          retryable: false,
        });
      } else if (isApiError(result.json)) {
        setUx(
          messageForApiError(
            result.json.code,
            result.json.message,
            result.json.retryable,
            locale,
          ),
        );
      } else {
        setUx(
          messageForApiError(
            undefined,
            `HTTP ${result.status}`,
            undefined,
            locale,
          ),
        );
      }
    });
  }

  const statusClass = useMemo(() => {
    if (!ux) return '';
    if (!productChrome) {
      return redeemDevStatusClass(ux.kind);
    }
    return redeemProductUxClass(ux.kind);
  }, [ux, productChrome]);

  const productErrorOutcome = Boolean(
    productChrome && ux && redeemProductErrorOutcome(ux.kind),
  );

  const statusLive = useMemo(
    () => (ux ? liveRegionForStatus(ux.kind) : null),
    [ux],
  );

  const productLead =
    singleCodeFlow && globalPhase === 'enter-code'
      ? null
      : singleCodeFlow
        ? copy.leadGlobalConfirm
        : copy.leadScoped;
  const schemaNoticeVars =
    schemaNotice === 'resolvedNamed' && globalContext
      ? {
          eventTitle: globalContext.eventTitle,
          ticketTypeLabel: globalContext.ticketTypeLabel,
        }
      : undefined;

  const formClassName = productChrome ? redeemProductFormRoot : redeemDevFormRoot;

  const termsEventHref =
    tenantSlug.trim() && eventSlug.trim()
      ? `/t/${encodeURIComponent(tenantSlug.trim())}/events/${encodeURIComponent(eventSlug.trim())}`
      : null;

  const awaitingPublishedSchema =
    slugPinnedSchema &&
    !publishedSchemaReady &&
    !formDefinition &&
    !termsVersion;

  const redeemSubmitDisabled =
    busy ||
    outcomeRequiresStatusCheck ||
    decision?.kind === 'issued' ||
    awaitingPublishedSchema ||
    (singleCodeFlow && globalPhase === 'confirm' && !publishedSchemaReady);

  return (
    <div className={formClassName}>
      <form onSubmit={onSubmit} aria-labelledby="redeem-form-title" noValidate
        className={productChrome ? 'grid gap-4' : undefined}>
        <h2 id="redeem-form-title" className={productChrome ? 'm-0 text-[1.2rem] font-bold' : undefined}>
          {singleCodeFlow && globalPhase === 'enter-code'
            ? copy.formTitleEnter
            : copy.formTitleConfirm}
        </h2>
        {productChrome && singleCodeFlow && globalPhase === 'enter-code' ? (
          <p className="m-0 text-[0.95rem] leading-[1.55] text-muted">
            {copy.enterCodeHint}
          </p>
        ) : null}
        {productChrome && productLead ? (
          <p className={redeemProductLead}>{productLead}</p>
        ) : null}
        {productChrome && slugPinnedSchema && schemaNotice ? (
          <SurfaceState
            {...schemaNoticeChrome(
              schemaNotice,
              copy,
              'published',
              locale,
              schemaNoticeVars,
            )}
            testId="redeem-product-schema-notice"
          />
        ) : null}
        {!productChrome ? (
          <p className={introLead}>
            {globalEntry
              ? globalPhase === 'enter-code'
                ? copy.introGlobalEnter
                : copy.introGlobalConfirm
              : copy.introScoped}
          </p>
        ) : null}

        <div className={redeemFieldsGrid}>
          {singleCodeFlow && globalPhase === 'confirm' && globalContext ? (
            <section
              className={redeemGlobalContext}
              aria-labelledby="redeem-global-context-title"
              data-testid="redeem-global-context"
            >
              <h3 id="redeem-global-context-title">{copy.contextTitle}</h3>
              <dl>
                <div>
                  <dt>{copy.org}</dt>
                  <dd>{globalContext.tenantDisplayName}</dd>
                </div>
                <div>
                  <dt>{copy.event}</dt>
                  <dd>{globalContext.eventTitle}</dd>
                </div>
                <div>
                  <dt>{copy.ticketType}</dt>
                  <dd>{globalContext.ticketTypeLabel}</dd>
                </div>
              </dl>
              <Button
                type="button"
                variant="secondary"
                onClick={resetGlobalResolveSession}
                disabled={busy || outcomeRequiresStatusCheck}
              >
                {copy.otherCode}
              </Button>
            </section>
          ) : null}

          {!globalEntry && showDevScopeFields ? (
            <>
              {productChrome ? (
                <details className={redeemSecondaryTools}>
                  <summary>Tùy chọn nâng cao (đường dẫn / mã kỹ thuật)</summary>
                  <div className={redeemFieldsGrid}>
                    <label>
                      Mã tổ chức
                      <input
                        name="tenantId"
                        value={tenantId}
                        onChange={(e) => setTenantId(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="UUID tổ chức"
                        aria-invalid={fieldErrors.tenantId ? true : undefined}
                        aria-describedby={
                          fieldErrors.tenantId ? 'redeem-tenantId-error' : undefined
                        }
                      />
                      {fieldErrors.tenantId ? (
                        <span
                          id="redeem-tenantId-error"
                          className="field-error"
                          role="alert"
                        >
                          {fieldErrors.tenantId}
                        </span>
                      ) : null}
                    </label>
                    <label>
                      Mã sự kiện (tự điền khi tải biểu mẫu)
                      <input
                        name="eventId"
                        value={eventId}
                        onChange={(e) => setEventId(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="UUID sự kiện"
                        aria-invalid={fieldErrors.eventId ? true : undefined}
                        aria-describedby={
                          fieldErrors.eventId ? 'redeem-eventId-error' : undefined
                        }
                      />
                      {fieldErrors.eventId ? (
                        <span
                          id="redeem-eventId-error"
                          className="field-error"
                          role="alert"
                        >
                          {fieldErrors.eventId}
                        </span>
                      ) : null}
                    </label>
                    <div className={redeemVersionsGrid}>
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
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={loadSchema}
                      disabled={busy || !tenantSlug.trim() || !eventSlug.trim()}
                    >
                      Tải biểu mẫu
                    </Button>
                  </div>
                </details>
              ) : (
                <>
                  <label>
                    Mã tổ chức
                    <input
                      name="tenantId"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="UUID tổ chức"
                      aria-invalid={fieldErrors.tenantId ? true : undefined}
                      aria-describedby={
                        fieldErrors.tenantId ? 'redeem-tenantId-error-dev' : undefined
                      }
                    />
                    {fieldErrors.tenantId ? (
                      <span
                        id="redeem-tenantId-error-dev"
                        className="field-error"
                        role="alert"
                      >
                        {fieldErrors.tenantId}
                      </span>
                    ) : null}
                  </label>
                  <label>
                    Mã sự kiện (tự điền khi tải biểu mẫu)
                    <input
                      name="eventId"
                      value={eventId}
                      onChange={(e) => setEventId(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="UUID sự kiện"
                      aria-invalid={fieldErrors.eventId ? true : undefined}
                      aria-describedby={
                        fieldErrors.eventId ? 'redeem-eventId-error-dev' : undefined
                      }
                    />
                    {fieldErrors.eventId ? (
                      <span
                        id="redeem-eventId-error-dev"
                        className="field-error"
                        role="alert"
                      >
                        {fieldErrors.eventId}
                      </span>
                    ) : null}
                  </label>
                  <div className={redeemVersionsGrid}>
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
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={loadSchema}
                    disabled={busy || !tenantSlug.trim() || !eventSlug.trim()}
                  >
                    Tải biểu mẫu
                  </Button>
                </>
              )}
              {schemaNotice && !(productChrome && slugPinnedSchema) ? (
                <SurfaceState
                  {...schemaNoticeChrome(
                    schemaNotice,
                    copy,
                    'published',
                    locale,
                    schemaNoticeVars,
                  )}
                  testId="redeem-schema-notice"
                />
              ) : null}
            </>
          ) : null}

          {singleCodeFlow && schemaNotice ? (
            <SurfaceState
              {...schemaNoticeChrome(
                schemaNotice,
                copy,
                'global',
                locale,
                schemaNoticeVars,
              )}
              testId="redeem-global-schema-notice"
            />
          ) : null}

          {singleCodeFlow && globalPhase === 'enter-code' ? (
            <div className={productChrome ? redeemCodeField : undefined}>
              <label htmlFor="redeem-code-global">
                {copy.codeLabel}
                <input
                  id="redeem-code-global"
                  name="code"
                  required
                  disabled={busy}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={copy.codePlaceholder}
                  data-testid="redeem-global-code"
                />
              </label>
              <p className="m-0 text-[0.85rem] leading-[1.45] text-muted">
                {copy.codeHint}
              </p>
            </div>
          ) : null}

          {!singleCodeFlow || globalPhase === 'confirm' ? (
            <div className={productChrome ? redeemCodeField : undefined}>
              <label htmlFor="redeem-code-confirm">
                {copy.codeLabel}
                <input
                  id="redeem-code-confirm"
                  name="code"
                  required
                  disabled={busy}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={copy.codePlaceholder}
                  readOnly={singleCodeFlow && globalPhase === 'confirm'}
                  aria-readonly={
                    singleCodeFlow && globalPhase === 'confirm' ? true : undefined
                  }
                />
              </label>
            </div>
          ) : null}

          {formDefinition ? (
            <RedeemFormFields
              definition={formDefinition}
              answers={answers}
              fieldErrors={fieldErrors}
              disabled={busy}
              compact={productChrome}
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
          ) : singleCodeFlow && globalPhase === 'enter-code' ? null : termsVersion ? (
            <p className={introLead} data-testid="redeem-schema-terms-only">
              {copy.termsOnly}
            </p>
          ) : (
            <SurfaceState
              kind="empty"
              title={copy.noFormTitle}
              detail={
                singleCodeFlow ? copy.noFormGlobal : copy.noFormScoped
              }
              testId="redeem-schema-empty"
            />
          )}

          {termsVersion ? (
            <RedeemTermsConsent
              termsVersion={termsVersion}
              termsBody={termsBody}
              termsAccepted={termsAccepted}
              termsError={fieldErrors.terms}
              disabled={busy}
              termsHref={productChrome ? termsEventHref : null}
              compact={productChrome}
              onAcceptedChange={(accepted) => {
                setTermsAccepted(accepted);
                setFieldErrors((prev) => {
                  if (!prev.terms) return prev;
                  const next = { ...prev };
                  delete next.terms;
                  return next;
                });
              }}
            />
          ) : null}
        </div>

        <div
          className={productChrome ? redeemPrimaryActions : authButtonsRow}
        >
          {singleCodeFlow && globalPhase === 'enter-code' ? (
            <Button
              type="submit"
              variant="primary"
              disabled={busy}
              loading={busy}
              loadingLabel={copy.resolving}
              data-testid="redeem-global-resolve"
            >
              {copy.continue}
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              disabled={redeemSubmitDisabled}
              loading={busy}
              loadingLabel={copy.processing}
            >
              {copy.submit}
            </Button>
          )}
          {productChrome ? (
            canRepoll ? (
              <Button type="button" variant="secondary" onClick={pollAgain} disabled={!canRepoll}>
                {copy.checkAgain}
              </Button>
            ) : decision?.kind === 'pending' && pendingRequestId ? (
              <Button type="button" variant="secondary" onClick={refreshOwnerStatus} disabled={busy}>
                {copy.checkRequest}
              </Button>
            ) : null
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={pollAgain} disabled={!canRepoll}>
                {copy.checkAgain}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={refreshOwnerStatus}
                disabled={busy || !pendingRequestId}
              >
                {copy.refreshRequest}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={loadTickets}
                disabled={busy || !tenantId.trim()}
              >
                {copy.viewWallet}
              </Button>
              <Button asChild variant="primary">
                <a href={redeemLogin}>{copy.login}</a>
              </Button>
            </>
          )}
        </div>
      </form>
      {productChrome && singleCodeFlow && globalPhase === 'enter-code' ? (
        <p className="m-0 text-[0.9rem]">
          <Link href="/wallet">{copy.myTickets}</Link>
        </p>
      ) : null}

      {ux && statusLive ? (
        <section
          className={statusClass}
          role={statusLive.role}
          aria-live={statusLive.ariaLive}
          aria-atomic={statusLive.ariaAtomic}
          data-testid={`redeem-ux-${ux.kind}`}
        >
          {productChrome && ux.kind === 'success' ? (
            <div className={redeemSuccessRing} aria-hidden="true">
              ✓
            </div>
          ) : null}
          {productChrome && productErrorOutcome ? (
            <div className={redeemErrorRing} aria-hidden="true">
              !
            </div>
          ) : null}
          <h3>{ux.title}</h3>
          <p>{ux.detail}</p>
          {ux.kind === 'unknown' && canRepoll ? (
            <p>
              <Button type="button" variant="secondary" onClick={pollAgain} disabled={!canRepoll}>
                {copy.checkAgain}
              </Button>
            </p>
          ) : null}
          {ux.kind === 'auth' ? (
            <p className={authButtonsRow}>
              <Button asChild variant="brand">
                <a href={redeemLogin}>{copy.login}</a>
              </Button>
              {ux.code === IDENTITY_ERROR_CODES.EMAIL_NOT_VERIFIED ? (
                  <Button asChild variant="secondary">
                    <Link href="/account">{copy.openAccount}</Link>
                  </Button>
                ) : null}
            </p>
          ) : null}
          {productErrorOutcome ? (
            <div className={redeemOutcomeActions}>
              <Button type="button" variant="brand" onClick={resetRedeemAttempt} disabled={busy}>
                {copy.tryOtherCode}
              </Button>
              <Button asChild variant="primary">
                <Link href="/wallet">{copy.myTickets}</Link>
              </Button>
            </div>
          ) : null}
          {!productChrome &&
          ux.retryable &&
          ux.kind !== 'unknown' &&
          ux.kind !== 'auth' &&
          ux.kind !== 'verifying' &&
          ux.kind !== 'polling' ? (
            <p>
              <Button
                type="button"
                variant="brand"
                onClick={() => {
                  if (ux.kind === 'stale' || ux.kind === 'timeout') {
                    window.location.reload();
                    return;
                  }
                  setUx(null);
                }}
                disabled={busy}
              >
                {ux.kind === 'stale' || ux.kind === 'timeout'
                  ? copy.reloadRetry
                  : copy.retry}
              </Button>
            </p>
          ) : null}
          {ux.kind === 'success' ? (
            <p className={authButtonsRow}>
              <Button asChild variant="brand">
                <Link href="/wallet">{copy.viewWallet}</Link>
              </Button>
            </p>
          ) : null}
          {!productErrorOutcome &&
          (ux.kind === 'exhausted' ||
            ux.kind === 'used' ||
            ux.kind === 'closed' ||
            ux.kind === 'invalid') &&
          productChrome ? (
            <p className={authButtonsRow}>
              <Button asChild variant="secondary">
                <Link href="/">{copy.eventsList}</Link>
              </Button>
            </p>
          ) : null}
          {!productChrome &&
          (idempotencyKey || decision?.kind === 'pending') && (
            <details className={redeemMetaDetails}>
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
          className={productChrome ? redeemTicketCard : redeemDevTicketCard}
          aria-labelledby="ticket-title"
          data-testid="redeem-ticket-card"
        >
          <h3 id="ticket-title">{copy.yourTicket}</h3>
          <dl>
            <div>
              <dt>{copy.ticketId}</dt>
              <dd>{ticket.ticketId}</dd>
            </div>
            <div>
              <dt>{copy.status}</dt>
              <dd>{ticketStateLabel(ticket.state, locale)}</dd>
            </div>
            {ticket.requestId ? (
              <div>
                <dt>{copy.requestId}</dt>
                <dd>{ticket.requestId}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {!productChrome && tickets?.tickets?.length ? (
        <section className={redeemTicketListSection} aria-labelledby="tickets-title">
          <h3 id="tickets-title">{copy.myTickets}</h3>
          <ul>
            {tickets.tickets.map((t) => (
              <li key={t.ticketId}>
                <code>{t.ticketId}</code> · {t.state}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {raw && !productChrome ? (
        <details className={redeemMetaDetails}>
          <summary>Chi tiết kỹ thuật (đóng mặc định)</summary>
          <pre
            className={meResultPre}
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
