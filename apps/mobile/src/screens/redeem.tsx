import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  redeemActionAnnouncement,
  redeemDecisionAnnouncement,
  redeemReconcileAnnouncement,
  redeemStatusRefreshAnnouncement,
} from '@/a11y/announcements';
import { Notice, Page } from '@/components/page';
import { getApiBaseUrl, getEventId, getTenantId } from '@/identity/config';
import { session } from '@/identity/session';
import { fetchPublishedEventDetail } from '@/published/published-event-api';
import type { FormAnswerValue, FormDefinition } from '@/redeem/contract';
import {
  redeemPayloadFingerprint,
  resolveIdempotencyKey,
  type RedeemAttempt,
} from '@/redeem/attempt-key';
import { requireTermsConsent, validateFormAnswers } from '@/redeem/form-validate';
import { fetchOwnerRedemptionStatus } from '@/redeem/owner-status';
import {
  redeemCode,
  reconcileRedeem,
  type RedeemDecision,
} from '@/redeem/redeem-client';
import { RedeemFormFields } from '@/redeem/redeem-form-fields';
import { colors } from '@/theme/colors';

function titleFor(decision: RedeemDecision | null): string {
  if (!decision) return 'Redeem a code';
  if (decision.kind === 'issued') {
    return decision.replayed ? 'Ticket already issued' : 'Ticket issued';
  }
  if (decision.kind === 'pending') return 'Pending review — not a ticket';
  if (decision.kind === 'unknown') return 'Unknown — not a ticket';
  if (decision.kind === 'stale') return 'Form or terms changed';
  return 'Not issued';
}

function detailFor(decision: RedeemDecision): string {
  if (decision.kind === 'issued') return decision.ticketId;
  if (decision.kind === 'pending') {
    return `${decision.message} Request ${decision.requestId}`;
  }
  return decision.message;
}

export function RedeemScreen() {
  const [tenantId, setTenantId] = useState(getTenantId() ?? '');
  const [eventId, setEventId] = useState(getEventId() ?? '');
  const [tenantSlug, setTenantSlug] = useState('');
  const [eventSlug, setEventSlug] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<RedeemDecision | null>(null);
  const [attempt, setAttempt] = useState<RedeemAttempt | null>(null);
  const [form, setForm] = useState<FormDefinition | null>(null);
  const [termsVersion, setTermsVersion] = useState<string | null>(null);
  const [termsBody, setTermsBody] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, FormAnswerValue>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [schemaNotice, setSchemaNotice] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const loadPublishedSchema = useCallback(async () => {
    const t = tenantSlug.trim();
    const e = eventSlug.trim();
    if (!t || !e) {
      setSchemaNotice(
        'Optional: set tenant/event slugs to load published form and terms. No fixture fallback.',
      );
      return;
    }
    setSchemaNotice('Loading published form…');
    const result = await fetchPublishedEventDetail(t, e);
    if (result.status === 'ok') {
      setForm(result.event.form ?? null);
      setTermsVersion(result.event.terms?.version ?? null);
      setTermsBody(result.event.terms?.bodyMarkdown ?? null);
      if (result.event.id) setEventId(result.event.id);
      setSchemaNotice(
        `Loaded published schema v${result.event.schemaVersion} / config v${result.event.publishedConfigVersion}.`,
      );
      setAnswers({});
      setTermsAccepted(false);
      setFieldErrors({});
      return;
    }
    if (result.status === 'misconfigured') {
      setSchemaNotice(
        'Published API not configured (EXPO_PUBLIC_API_BASE_URL). Fail-closed — no demo form.',
      );
      return;
    }
    if (result.status === 'not-found') {
      setSchemaNotice('Published event not found. Drafts are never shown.');
      return;
    }
    setSchemaNotice('Published form unreachable or invalid. Fail-closed.');
  }, [tenantSlug, eventSlug]);

  useEffect(() => {
    // Clear answers/PII when identity flips.
    const unsub = session.subscribe(() => {
      const snap = session.getSnapshot();
      if (snap.status !== 'verified') {
        setAnswers({});
        setTermsAccepted(false);
        setAttempt(null);
        setDecision(null);
        setStatusNote(null);
      }
    });
    return unsub;
  }, []);

  async function submit() {
    const epoch = session.captureEpoch();
    const bearer = await session.getCredential();
    const apiBase = getApiBaseUrl();
    if (!session.isEpochCurrent(epoch) || !bearer || !apiBase || !epoch) {
      setDecision({
        kind: 'denied',
        code: 'UNAUTHENTICATED',
        message: 'Sign in and set the API base before redeeming.',
      });
      return;
    }

    const validated = validateFormAnswers(form, answers);
    const termsIssue = requireTermsConsent({ termsVersion, termsAccepted });
    const nextErrors: Record<string, string> = {};
    if (!validated.ok) {
      for (const issue of validated.issues) {
        nextErrors[issue.fieldId] = issue.message;
      }
    }
    if (termsIssue) nextErrors.terms = termsIssue.message;
    setFieldErrors(nextErrors);
    if (!validated.ok || termsIssue) return;

    const payload = {
      tenantId: tenantId.trim(),
      eventId: eventId.trim(),
      code: code.trim(),
      formVersion: form?.formVersion ?? '',
      termsVersion: termsVersion ?? '',
      answers: validated.answers,
      termsAccepted: termsAccepted === true,
    };
    const fingerprint = redeemPayloadFingerprint(payload);
    const { key } = resolveIdempotencyKey(attempt, fingerprint, () =>
      crypto.randomUUID(),
    );
    setAttempt({ key, fingerprint, unclear: true });
    setBusy(true);
    setStatusNote(null);
    try {
      if (!session.isEpochCurrent(epoch)) return;
      const next = await redeemCode({
        apiBase,
        bearer,
        tenantId: payload.tenantId,
        eventId: payload.eventId,
        code: payload.code,
        idempotencyKey: key,
        formVersion: form?.formVersion,
        termsVersion: termsVersion ?? undefined,
        answers: validated.answers,
        termsAccepted: termsAccepted === true,
      });
      if (!session.isEpochCurrent(epoch)) return;
      setDecision(next);
      if (next.kind === 'unknown') {
        setAttempt({ key, fingerprint, unclear: true });
      } else if (next.kind === 'pending') {
        setAttempt(null);
        setStatusNote('Pending — refresh status after staff review. Not a ticket.');
      } else {
        setAttempt(null);
      }
    } finally {
      if (session.isEpochCurrent(epoch)) setBusy(false);
    }
  }

  async function reconcile() {
    if (!attempt?.key) return;
    const epoch = session.captureEpoch();
    const bearer = await session.getCredential();
    const apiBase = getApiBaseUrl();
    if (!session.isEpochCurrent(epoch) || !bearer || !apiBase) return;
    setBusy(true);
    try {
      const next = await reconcileRedeem({
        apiBase,
        bearer,
        tenantId: tenantId.trim(),
        eventId: eventId.trim(),
        idempotencyKey: attempt.key,
      });
      if (!session.isEpochCurrent(epoch)) return;
      setDecision(next);
      if (next.kind !== 'unknown') setAttempt(null);
    } finally {
      if (session.isEpochCurrent(epoch)) setBusy(false);
    }
  }

  async function refreshStatus() {
    if (!decision || decision.kind !== 'pending' || !decision.requestId) return;
    const epoch = session.captureEpoch();
    const bearer = await session.getCredential();
    const apiBase = getApiBaseUrl();
    if (!session.isEpochCurrent(epoch) || !bearer || !apiBase) return;
    setBusy(true);
    try {
      const result = await fetchOwnerRedemptionStatus({
        apiBase,
        bearer,
        requestId: decision.requestId,
      });
      if (!session.isEpochCurrent(epoch)) return;
      if (result.status === 'ok') {
        const body = result.body;
        if (body.status === 'ISSUED') {
          setDecision({
            kind: 'issued',
            ticketId: body.ticketId,
            requestId: body.requestId,
            replayed: true,
          });
          setStatusNote('Status ISSUED — ticket is available.');
        } else if (body.status === 'PENDING_REVIEW') {
          setStatusNote(
            `Still pending review${body.expiresAt ? ` · expires ${body.expiresAt}` : ''}. No seat guarantee.`,
          );
        } else if (body.status === 'REJECTED') {
          setDecision({
            kind: 'denied',
            code: 'REJECTED',
            message: body.reason ?? 'Request was rejected.',
          });
          setStatusNote(null);
        } else if (body.status === 'EXPIRED') {
          setDecision({
            kind: 'denied',
            code: 'PENDING_EXPIRED',
            message: 'Pending request expired. Code may be released.',
          });
          setStatusNote(null);
        }
        return;
      }
      if (result.status === 'not-found') {
        setStatusNote(
          'Status API returned 404 — live F-BE endpoint may not be integrated yet. Pending is still not a ticket.',
        );
        return;
      }
      setStatusNote('Could not refresh status (network/auth). Keep pending as unknown outcome.');
    } finally {
      if (session.isEpochCurrent(epoch)) setBusy(false);
    }
  }

  return (
    <Page>
      <Notice title="Redeem">
        Live redeem API with published form/terms when loaded. Pending is not a
        ticket. Lost responses stay unknown until the same idempotency key
        resolves with command redemption.redeem.
      </Notice>
      {schemaNotice ? (
        <Notice title="Published schema">{schemaNotice}</Notice>
      ) : null}
      <TextInput
        value={tenantSlug}
        onChangeText={setTenantSlug}
        placeholder="Tenant slug (for published form)"
        autoCapitalize="none"
        accessibilityLabel="Tenant slug for published form"
        style={field}
      />
      <TextInput
        value={eventSlug}
        onChangeText={setEventSlug}
        placeholder="Event slug (for published form)"
        autoCapitalize="none"
        accessibilityLabel="Event slug for published form"
        style={field}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Load published form and terms"
        disabled={busy}
        onPress={() => void loadPublishedSchema()}
        style={buttonSecondary}
      >
        <Text style={buttonSecondaryLabel}>Load published form/terms</Text>
      </Pressable>
      <TextInput
        value={tenantId}
        onChangeText={setTenantId}
        placeholder="Tenant ID"
        autoCapitalize="none"
        accessibilityLabel="Tenant ID"
        style={field}
      />
      <TextInput
        value={eventId}
        onChangeText={setEventId}
        placeholder="Event ID"
        autoCapitalize="none"
        accessibilityLabel="Event ID"
        style={field}
      />
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Redemption code"
        autoCapitalize="characters"
        accessibilityLabel="Redemption code"
        style={field}
      />
      <RedeemFormFields
        form={form}
        termsVersion={termsVersion}
        termsBody={termsBody}
        answers={answers}
        termsAccepted={termsAccepted}
        disabled={busy}
        fieldErrors={fieldErrors}
        onChangeAnswer={(fieldId, value) =>
          setAnswers((prev) => ({ ...prev, [fieldId]: value }))
        }
        onTermsAcceptedChange={setTermsAccepted}
      />
      <Pressable
        {...redeemActionAnnouncement()}
        accessibilityState={{ disabled: busy || code.trim().length === 0 }}
        disabled={busy || code.trim().length === 0}
        onPress={() => void submit()}
        style={button}
      >
        <Text style={buttonLabel}>{busy ? 'Checking…' : 'Redeem'}</Text>
      </Pressable>
      {decision ? (
        <View
          {...redeemDecisionAnnouncement({
            kind: decision.kind,
            title: titleFor(decision),
            detail: detailFor(decision),
          })}
          accessibilityLiveRegion={
            decision.kind === 'unknown' || decision.kind === 'pending'
              ? 'assertive'
              : 'polite'
          }
        >
          <Notice title={titleFor(decision)}>{detailFor(decision)}</Notice>
        </View>
      ) : null}
      {statusNote ? <Notice title="Status">{statusNote}</Notice> : null}
      {decision?.kind === 'pending' ? (
        <Pressable
          {...redeemStatusRefreshAnnouncement()}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void refreshStatus()}
          style={button}
        >
          <Text style={buttonLabel}>Refresh current status</Text>
        </Pressable>
      ) : null}
      {decision?.kind === 'issued' ? null : attempt?.key ? (
        <Pressable
          {...redeemReconcileAnnouncement()}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void reconcile()}
          style={button}
        >
          <Text style={buttonLabel}>Reconcile same attempt</Text>
        </Pressable>
      ) : null}
    </Page>
  );
}

const field = {
  minHeight: 48,
  padding: 12,
  borderRadius: 12,
  backgroundColor: colors.card,
  color: colors.label,
  fontSize: 17,
};

const button = {
  padding: 14,
  borderRadius: 12,
  backgroundColor: colors.accent,
};

const buttonLabel = {
  color: 'white',
  fontSize: 17,
  fontWeight: '600' as const,
  textAlign: 'center' as const,
};

const buttonSecondary = {
  padding: 14,
  borderRadius: 12,
  backgroundColor: colors.card,
};

const buttonSecondaryLabel = {
  color: colors.label,
  fontSize: 17,
  fontWeight: '600' as const,
  textAlign: 'center' as const,
};
