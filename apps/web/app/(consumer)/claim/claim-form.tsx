'use client';

import { Button } from '@ticket/ui';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import type { FormAnswerValue, FormDefinition } from '@ticket/contracts';
import { useAttendeeLocale } from '../../../src/i18n';
import { guestClaimCopy } from '../../../src/guest/claim-copy';
import { decideClaimBody } from '../../../src/guest/claim-api';
import {
  clearClaimHashFromLocation,
  clearGuestClaimIntent,
  parkGuestClaimIntent,
  readClaimTokenFromLocation,
} from '../../../src/guest/claim-intent';
import { redeemMutate } from '../../../src/redeem/client-fetch';
import type { RedeemDecision } from '../../../src/redeem/decide';
import { RedeemFormFields } from '../../../src/redeem/form-fields';
import {
  requireTermsConsent,
  validateFormAnswers,
} from '../../../src/redeem/form-validate';
import {
  messageForDecision,
  type RedeemUxMessage,
} from '../../../src/redeem/messages';
import {
  authButtonsRow,
  claimFormRoot,
  claimOutcomeClass,
} from '../../../src/guest/guest-flow-surface';
import { redeemCheckboxRow } from '../../../src/redeem/redeem-surface';
import { loadPublishedRedeemSchema } from '../../../src/redeem/published-schema';
import { fetchOwnerRedemptionStatus } from '../../../src/redeem/owner-status';
import { messageForOwnerStatus } from '../../../src/redeem/messages';
import { REQUEST_TIMEOUT_MS } from '../../../src/redeem/poll-operation';
import { liveRegionForStatus } from '../../../src/ui/live-region';
import { SurfaceState } from '../../../src/ui/surface-state';

type ClaimLocation = {
  token: string;
  tenantId: string;
  eventId: string;
  tenantSlug: string;
  eventSlug: string;
};

/** Stable empty snapshot — useSyncExternalStore requires cached getServerSnapshot. */
const EMPTY_LOCATION: ClaimLocation = {
  token: '',
  tenantId: '',
  eventId: '',
  tenantSlug: '',
  eventSlug: '',
};

let cachedLocationSnapshot: ClaimLocation = EMPTY_LOCATION;

function sameClaimLocation(a: ClaimLocation, b: ClaimLocation): boolean {
  return (
    a.token === b.token &&
    a.tenantId === b.tenantId &&
    a.eventId === b.eventId &&
    a.tenantSlug === b.tenantSlug &&
    a.eventSlug === b.eventSlug
  );
}

function claimLocationKey(location: ClaimLocation): string {
  return [location.token, location.tenantId, location.eventId,
    location.tenantSlug, location.eventSlug].join('\u0000');
}

/**
 * Pure snapshot: fragment + parked intent (no side effects).
 * Returns a cached reference when values are unchanged so useSyncExternalStore
 * does not infinite-loop (Object.is) into the route error boundary.
 */
function getClaimLocationSnapshot(): ClaimLocation {
  const fromLoc = readClaimTokenFromLocation();
  const next: ClaimLocation = fromLoc;
  if (sameClaimLocation(cachedLocationSnapshot, next)) {
    return cachedLocationSnapshot;
  }
  cachedLocationSnapshot = next;
  return cachedLocationSnapshot;
}

function subscribeClaimLocation(onStoreChange: () => void): () => void {
  window.addEventListener('hashchange', onStoreChange);
  window.addEventListener('popstate', onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener('hashchange', onStoreChange);
    window.removeEventListener('popstate', onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

export function GuestClaimForm() {
  const { locale } = useAttendeeLocale();
  const copy = guestClaimCopy(locale);
  const locationSnap = useSyncExternalStore(
    subscribeClaimLocation,
    getClaimLocationSnapshot,
    () => EMPTY_LOCATION,
  );

  const [formDefinition, setFormDefinition] = useState<FormDefinition | null>(
    null,
  );
  const [termsVersion, setTermsVersion] = useState<string | null>(null);
  const [termsBody, setTermsBody] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, FormAnswerValue>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [decision, setDecision] = useState<RedeemDecision | null>(null);
  // Pending refresh must survive clearing the invitation token and parked intent.
  const [pendingTenantId, setPendingTenantId] = useState('');
  const [ux, setUx] = useState<RedeemUxMessage | null>(null);
  const [resultContextKey, setResultContextKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [schemaKey, setSchemaKey] = useState('');
  const [schemaStatus, setSchemaStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [schemaError, setSchemaError] = useState('');
  const [eventName, setEventName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [claimedKey, setClaimedKey] = useState('');
  const [completed, setCompleted] = useState(false);
  const token = locationSnap.token;
  const displayTenantId = locationSnap.tenantId;
  const displayEventId = locationSnap.eventId;
  const displayTenantSlug = locationSnap.tenantSlug;
  const displayEventSlug = locationSnap.eventSlug;
  const contextKey = claimLocationKey(locationSnap);
  const validContext = Boolean(token.trim() && displayTenantId.trim() &&
    displayEventId.trim() && displayTenantSlug.trim() && displayEventSlug.trim());
  const activeContext = useRef(contextKey);
  const [attempt, setAttempt] = useState<{ key: string; idempotencyKey: string } | null>(null);
  const idempotencyKey = attempt?.key === contextKey ? attempt.idempotencyKey : '';
  const schemaReady = schemaKey === contextKey && schemaStatus === 'ready';

  useEffect(() => {
    activeContext.current = contextKey;
    if (!validContext) {
      if (window.location.hash &&
          sameClaimLocation(locationSnap, readClaimTokenFromLocation())) {
        clearGuestClaimIntent();
        clearClaimHashFromLocation();
        queueMicrotask(() => {
          if (activeContext.current !== contextKey) return;
          setCompleted(false);
          setBusy(false);
        });
      }
      return;
    }
    parkGuestClaimIntent({
      token: locationSnap.token,
      tenantId: locationSnap.tenantId,
      eventId: locationSnap.eventId,
      tenantSlug: locationSnap.tenantSlug,
      eventSlug: locationSnap.eventSlug,
    });
    clearClaimHashFromLocation();
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setAttempt({ key: contextKey, idempotencyKey: crypto.randomUUID() });
      setSchemaKey(contextKey);
      setSchemaStatus('loading');
      setFormDefinition(null);
      setTermsVersion(null);
      setTermsBody(null);
      setEventName('');
      setOrganizationName('');
      setAnswers({});
      setTermsAccepted(false);
      setFieldErrors({});
      setDecision(null);
      setPendingTenantId('');
      setUx(null);
      setResultContextKey('');
      setCompleted(false);
      setBusy(false);
    });
    void loadPublishedRedeemSchema(displayTenantSlug, displayEventSlug).then((result) => {
      if (cancelled || activeContext.current !== contextKey ||
          claimLocationKey(readClaimTokenFromLocation()) !== contextKey) return;
      if (result.status === 'ok' && result.schema.eventId === displayEventId &&
          result.schema.tenantId === displayTenantId && result.schema.terms?.version) {
      setFormDefinition(result.schema.form);
      setTermsVersion(result.schema.terms?.version ?? null);
      setTermsBody(result.schema.terms?.bodyMarkdown ?? null);
      setEventName(
        result.schema.eventName ?? guestClaimCopy(locale).invitedEventFallback,
      );
      setOrganizationName(result.schema.organizationName ?? '');
      setSchemaStatus('ready');
      } else {
        const schemaCopy = guestClaimCopy(locale);
        setSchemaError(result.status === 'not-found'
          ? schemaCopy.schemaNotFound
          : schemaCopy.schemaMismatch);
        setSchemaStatus('error');
      }
    });
    return () => { cancelled = true; };
  }, [contextKey, validContext, displayTenantSlug, displayEventSlug,
    displayTenantId, displayEventId, locationSnap, locale]);

  async function submitClaim() {
    if (!validContext || !schemaReady || !idempotencyKey || busy || claimedKey === contextKey) return;
    setBusy(true);
    setResultContextKey(contextKey);
    setDecision(null);
    setFieldErrors({});
    setUx(null);

    if (!token.trim()) {
      setUx({
        kind: 'error',
        title: copy.missingToken.title,
        detail: copy.missingToken.detail,
        retryable: false,
      });
      setBusy(false);
      return;
    }
    if (!displayTenantId.trim() || !displayEventId.trim()) {
      setUx({
        kind: 'error',
        title: copy.missingScope.title,
        detail: copy.missingScope.detail,
        retryable: false,
      });
      setBusy(false);
      return;
    }
    if (!termsVersion) {
      setUx({
        kind: 'error',
        title: copy.noForm.title,
        detail: copy.noForm.detail,
        retryable: false,
      });
      setBusy(false);
      return;
    }

    const validated = formDefinition
      ? validateFormAnswers(formDefinition, answers)
      : null;
    const termsIssue = requireTermsConsent({ termsVersion, termsAccepted });
    const nextErrors: Record<string, string> = {};
    if (validated && !validated.ok) {
      for (const issue of validated.issues) {
        nextErrors[issue.fieldId] = issue.message;
      }
    }
    if (termsIssue) nextErrors.terms = termsIssue.message;
    setFieldErrors(nextErrors);
    if ((validated && !validated.ok) || termsIssue) {
      setUx({
        kind: 'error',
        title: copy.formInvalid.title,
        detail: copy.formInvalid.detail,
        retryable: false,
      });
      setBusy(false);
      return;
    }

    parkGuestClaimIntent({
      token: token.trim(),
      tenantId: displayTenantId.trim(),
      eventId: displayEventId.trim(),
      tenantSlug: displayTenantSlug.trim() || undefined,
      eventSlug: displayEventSlug.trim() || undefined,
      formVersion: formDefinition?.formVersion,
      termsVersion,
    });

    const result = await redeemMutate(
      '/api/bff/claim',
      {
        tenantId: displayTenantId.trim(),
        eventId: displayEventId.trim(),
        token: token.trim(),
        formVersion: formDefinition?.formVersion,
        termsVersion,
        answers: validated?.ok ? validated.answers : {},
        termsAccepted: true,
        idempotencyKey,
      },
      REQUEST_TIMEOUT_MS,
    );

    if (activeContext.current !== contextKey ||
        claimLocationKey(readClaimTokenFromLocation()) !== contextKey) return;

    if (
      !result.networkError &&
      !result.timedOut &&
      result.status === 401
    ) {
      setDecision(null);
      setUx({
        kind: 'auth',
        title: copy.auth.title,
        detail: copy.auth.detail,
        retryable: false,
      });
      setBusy(false);
      return;
    }

    const next = decideClaimBody(
      result.status,
      result.json,
      idempotencyKey,
      result.networkError || result.timedOut,
    );
    const nextUx = messageForDecision(next, locale);
    setDecision(next);
    setPendingTenantId(next.kind === 'pending' ? displayTenantId.trim() : '');
    setUx(nextUx);

    if (next.kind === 'issued' || next.kind === 'pending') {
      setCompleted(true);
      clearGuestClaimIntent();
      setClaimedKey(contextKey);
    }
    if (next.kind === 'field_errors') {
      const map: Record<string, string> = {};
      for (const err of next.fields) {
        map[err.fieldId] = err.message;
      }
      setFieldErrors(map);
    }
    setBusy(false);
  }

  async function refreshClaimStatus() {
    if (decision?.kind !== 'pending' || busy) return;
    const requestId = decision.requestId;
    const activeKey = activeContext.current;
    setBusy(true);
    const result = await fetchOwnerRedemptionStatus(requestId, pendingTenantId);
    if (activeContext.current !== activeKey ||
        claimLocationKey(readClaimTokenFromLocation()) !== activeKey) return;
    if (result.status === 'ok') {
      setUx(messageForOwnerStatus(result.body, locale));
      if (result.body.status === 'ISSUED') {
        setDecision({ kind: 'issued', ticketId: result.body.ticketId,
          requestId, replayed: false });
      } else if (result.body.status === 'REJECTED' || result.body.status === 'EXPIRED') {
        setDecision(null);
      }
    } else {
      setUx({ kind: 'unknown', title: copy.unreadStatus.title,
        detail: result.status === 'unauthorized'
          ? copy.unreadStatus.unauthorized
          : copy.unreadStatus.retry,
        retryable: true });
    }
    setBusy(false);
  }

  const loginHref = `/api/auth/login?return=${encodeURIComponent('/claim')}`;
  const outcomeLive = ux
    ? liveRegionForStatus(
        ux.kind === 'denied' ||
          ux.kind === 'expired' ||
          ux.kind === 'error' ||
          ux.kind === 'auth'
          ? 'error'
          : ux.kind,
      )
    : null;
  const outcomeSection = ux && outcomeLive &&
    (!validContext || resultContextKey === contextKey) ? (
    <section
      className={claimOutcomeClass(ux.kind)}
      role={outcomeLive.role}
      aria-live={outcomeLive.ariaLive}
      aria-atomic={outcomeLive.ariaAtomic}
      data-testid="guest-claim-result"
    >
      <h2>{ux.title}</h2>
      <p>{ux.detail}</p>
      {decision?.kind === 'pending' ? (
        <p>{copy.pendingNotTicket}</p>
      ) : null}
      {ux.kind === 'auth' ? (
        <p className={authButtonsRow}>
          <Button asChild variant="brand">
            <a href={loginHref}>{copy.loginInvitedAuth}</a>
          </Button>
        </p>
      ) : null}
      {decision?.kind === 'pending' ? (
        <p><Button type="button" variant="secondary" disabled={busy}
          onClick={() => void refreshClaimStatus()}>{copy.checkStatus}</Button></p>
      ) : ux.kind === 'unknown' && validContext ? (
        <p><Button type="button" variant="secondary" disabled={busy}
          onClick={() => void submitClaim()}>{copy.resubmit}</Button></p>
      ) : null}
      {decision?.kind === 'issued' ? (
        <p><Button asChild variant="brand"><Link href="/wallet" prefetch={false}>{copy.viewWallet}</Link></Button></p>
      ) : null}
    </section>
  ) : null;

  if (!validContext) {
    if (completed && sameClaimLocation(locationSnap, EMPTY_LOCATION)) {
      return <div className={claimFormRoot}>{outcomeSection}</div>;
    }
    return <div className={claimFormRoot}>
      <SurfaceState kind="empty" title={copy.emptyTitle}
        detail={copy.emptyDetail}
        testId="claim-token-empty" />
      <div className={authButtonsRow}>
        <Button asChild variant="secondary"><Link href="/redeem">{copy.redeem}</Link></Button>
        <Button asChild variant="secondary"><Link href="/wallet" prefetch={false}>{copy.wallet}</Link></Button>
      </div>
    </div>;
  }

  return (
    <div className={claimFormRoot}>
      <p>
        {copy.support}
      </p>

      <div className={authButtonsRow}>
        <Button asChild variant="primary">
          <a href={loginHref}>{copy.loginInvited}</a>
        </Button>
      </div>

      {schemaKey !== contextKey || schemaStatus === 'loading' ? (
        <SurfaceState kind="loading" title={copy.loadingTitle}
          detail={copy.loadingDetail} />
      ) : null}
      {schemaKey === contextKey && schemaStatus === 'error' ? (
        <SurfaceState kind="error" title={copy.schemaErrorTitle} detail={schemaError} />
      ) : null}

      {busy && !ux ? (
        <SurfaceState
          kind="loading"
          title={copy.busyTitle}
          detail={copy.busyDetail}
          testId="claim-busy-loading"
        />
      ) : null}

      {schemaReady ? (
        <>
          <section aria-label={copy.eventSectionAria}>
            <h2>{eventName}</h2>
            {organizationName ? <p>{organizationName}</p> : null}
          </section>
          {formDefinition ? <RedeemFormFields
            definition={formDefinition}
            answers={answers}
            fieldErrors={fieldErrors}
            disabled={busy || claimedKey === contextKey}
            onChange={(fieldId, value) =>
              setAnswers((prev) => ({ ...prev, [fieldId]: value }))
            }
          /> : null}
          <div className={redeemCheckboxRow}>
            <input
              id="claim-terms-consent"
              type="checkbox"
              checked={termsAccepted}
              disabled={busy || claimedKey === contextKey}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              aria-invalid={fieldErrors.terms ? true : undefined}
            />
            <label htmlFor="claim-terms-consent">{copy.termsConsent}</label>
          </div>
          {fieldErrors.terms ? <p className="field-error" role="alert">{fieldErrors.terms}</p> : null}
          {termsBody ? (
            <details className="mt-2.5 min-w-0 max-w-full text-sm [&_summary]:mb-2 [&_summary]:cursor-pointer [&_summary]:font-bold" open>
              <summary>{copy.termsSummary}</summary>
              <div
                className="max-h-80 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-paper p-4 text-[0.9rem] font-normal leading-[1.6]"
                tabIndex={0}
                aria-label={copy.termsBodyAria}
              >
                {termsBody}
              </div>
            </details>
          ) : null}
        </>
      ) : null}

      {schemaReady ? <Button
        type="button"
        variant="primary"
        disabled={busy || claimedKey === contextKey}
        loading={busy}
        loadingLabel={copy.sending}
        onClick={() => void submitClaim()}
      >
        {copy.submit}
      </Button> : null}

      {outcomeSection}
    </div>
  );
}
