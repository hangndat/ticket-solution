'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { FormAnswerValue, FormDefinition } from '@ticket/contracts';
import { decideClaimBody } from '../../src/guest/claim-api';
import {
  clearClaimHashFromLocation,
  clearGuestClaimIntent,
  parkGuestClaimIntent,
  peekGuestClaimIntent,
  readClaimTokenFromLocation,
  redactGuestClaimIntent,
} from '../../src/guest/claim-intent';
import { redeemMutate } from '../../src/redeem/client-fetch';
import type { RedeemDecision } from '../../src/redeem/decide';
import { RedeemFormFields } from '../../src/redeem/form-fields';
import {
  requireTermsConsent,
  validateFormAnswers,
} from '../../src/redeem/form-validate';
import {
  messageForDecision,
  type RedeemUxMessage,
} from '../../src/redeem/messages';
import { loadPublishedRedeemSchema } from '../../src/redeem/published-schema';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';
import { SurfaceState } from '../../src/ui/surface-state';

type ClaimLocation = {
  token: string;
  tenantId: string;
  eventId: string;
  tenantSlug: string;
  eventSlug: string;
};

function emptyLocation(): ClaimLocation {
  return {
    token: '',
    tenantId: '',
    eventId: '',
    tenantSlug: '',
    eventSlug: '',
  };
}

/** Pure snapshot: fragment + parked intent (no side effects). */
function getClaimLocationSnapshot(): ClaimLocation {
  const fromLoc = readClaimTokenFromLocation();
  if (fromLoc.token || fromLoc.tenantId || fromLoc.eventId) {
    return fromLoc;
  }
  const parked = peekGuestClaimIntent();
  if (!parked) return emptyLocation();
  return {
    token: parked.token,
    tenantId: parked.tenantId,
    eventId: parked.eventId,
    tenantSlug: parked.tenantSlug ?? '',
    eventSlug: parked.eventSlug ?? '',
  };
}

function subscribeClaimLocation(onStoreChange: () => void): () => void {
  window.addEventListener('hashchange', onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener('hashchange', onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

export function GuestClaimForm() {
  const locationSnap = useSyncExternalStore(
    subscribeClaimLocation,
    getClaimLocationSnapshot,
    emptyLocation,
  );

  const [tokenOverride, setTokenOverride] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [eventId, setEventId] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [eventSlug, setEventSlug] = useState('');
  const [seeded, setSeeded] = useState(false);
  const [formDefinition, setFormDefinition] = useState<FormDefinition | null>(
    null,
  );
  const [termsVersion, setTermsVersion] = useState<string | null>(null);
  const [termsBody, setTermsBody] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, FormAnswerValue>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [decision, setDecision] = useState<RedeemDecision | null>(null);
  const [ux, setUx] = useState<RedeemUxMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const token =
    tokenOverride !== null ? tokenOverride : locationSnap.token;

  // Seed editable fields once from fragment/parked snapshot (like invite-accept).
  const displayTenantId = seeded ? tenantId : tenantId || locationSnap.tenantId;
  const displayEventId = seeded ? eventId : eventId || locationSnap.eventId;
  const displayTenantSlug = seeded
    ? tenantSlug
    : tenantSlug || locationSnap.tenantSlug;
  const displayEventSlug = seeded
    ? eventSlug
    : eventSlug || locationSnap.eventSlug;

  useEffect(() => {
    if (!locationSnap.token) return;
    parkGuestClaimIntent({
      token: locationSnap.token,
      tenantId: locationSnap.tenantId || displayTenantId,
      eventId: locationSnap.eventId || displayEventId,
      tenantSlug: locationSnap.tenantSlug || undefined,
      eventSlug: locationSnap.eventSlug || undefined,
    });
    clearClaimHashFromLocation();
  }, [
    locationSnap.token,
    locationSnap.tenantId,
    locationSnap.eventId,
    locationSnap.tenantSlug,
    locationSnap.eventSlug,
    displayTenantId,
    displayEventId,
  ]);

  async function loadSchema() {
    setBusy(true);
    setUx(null);
    const result = await loadPublishedRedeemSchema(
      displayTenantSlug.trim(),
      displayEventSlug.trim(),
    );
    if (result.status === 'ok') {
      setFormDefinition(result.schema.form);
      setTermsVersion(result.schema.terms?.version ?? null);
      setTermsBody(result.schema.terms?.bodyMarkdown ?? null);
      if (result.schema.eventId) {
        setEventId(result.schema.eventId);
        setSeeded(true);
      }
      setAnswers({});
      setTermsAccepted(false);
      setFieldErrors({});
      setUx({
        kind: 'verifying',
        title: 'Schema đã tải',
        detail: `form ${result.schema.form?.formVersion ?? '—'} · terms ${result.schema.terms?.version ?? '—'}`,
        retryable: false,
      });
    } else {
      setFormDefinition(null);
      setTermsVersion(null);
      setTermsBody(null);
      setUx({
        kind: 'error',
        title: 'Không tải được form/terms',
        detail:
          result.status === 'not-found'
            ? 'Không tìm thấy event published.'
            : result.status === 'unreachable'
              ? 'Published API không tới được — fail-closed, không dùng form demo.'
              : 'Published schema không hợp lệ hoặc thiếu slug.',
        retryable: false,
      });
    }
    setBusy(false);
  }

  async function submitClaim() {
    setBusy(true);
    setDecision(null);
    setFieldErrors({});
    setUx(null);

    if (!token.trim()) {
      setUx({
        kind: 'error',
        title: 'Thiếu token',
        detail:
          'Token chỉ lấy từ #fragment hoặc bộ nhớ tạm — không dán vào query.',
        retryable: false,
      });
      setBusy(false);
      return;
    }
    if (!displayTenantId.trim() || !displayEventId.trim()) {
      setUx({
        kind: 'error',
        title: 'Thiếu scope',
        detail: 'Cần tenantId và eventId (UUID) cùng lời mời.',
        retryable: false,
      });
      setBusy(false);
      return;
    }
    if (!formDefinition || !termsVersion) {
      setUx({
        kind: 'error',
        title: 'Chưa có schema',
        detail: 'Tải form/terms published (slug) trước khi claim.',
        retryable: false,
      });
      setBusy(false);
      return;
    }

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
      setUx({
        kind: 'error',
        title: 'Form/consent chưa hợp lệ',
        detail: 'Sửa các trường được đánh dấu rồi thử lại.',
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
      formVersion: formDefinition.formVersion,
      termsVersion,
    });

    const result = await redeemMutate(
      '/api/bff/claim',
      {
        tenantId: displayTenantId.trim(),
        eventId: displayEventId.trim(),
        token: token.trim(),
        formVersion: formDefinition.formVersion,
        termsVersion,
        answers: validated.answers,
        termsAccepted: true,
        idempotencyKey,
      },
      REQUEST_TIMEOUT_MS,
    );

    const next = decideClaimBody(
      result.status,
      result.json,
      idempotencyKey,
      result.networkError || result.timedOut,
    );
    setDecision(next);
    setUx(messageForDecision(next));

    if (next.kind === 'issued' || next.kind === 'pending') {
      clearGuestClaimIntent();
      setTokenOverride('');
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

  const loginHref = `/api/auth/login?return=${encodeURIComponent('/claim')}`;
  const parked = peekGuestClaimIntent();
  const redacted = redactGuestClaimIntent(
    token
      ? {
          token,
          tenantId: displayTenantId,
          eventId: displayEventId,
          tenantSlug: displayTenantSlug || undefined,
          eventSlug: displayEventSlug || undefined,
          createdAt: parked?.createdAt ?? 0,
        }
      : null,
  );

  return (
    <div className="redeem-form">
      <p>
        Guest claim (C-I): đăng nhập OIDC verified đúng email lời mời · token
        one-time · form/consent C-F · không auto-account. Wrong-email /
        unverified / expired không cấp vé. Token không vào query hay analytics.
      </p>

      <div className="auth-buttons">
        <a className="button-link" href={loginHref}>
          Đăng nhập rồi quay lại claim
        </a>
      </div>

      <label>
        Tenant slug (published)
        <input
          value={displayTenantSlug}
          onChange={(e) => {
            setSeeded(true);
            setTenantSlug(e.target.value);
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Event slug (published)
        <input
          value={displayEventSlug}
          onChange={(e) => {
            setSeeded(true);
            setEventSlug(e.target.value);
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Tenant ID
        <input
          value={displayTenantId}
          onChange={(e) => {
            setSeeded(true);
            setTenantId(e.target.value);
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Event ID
        <input
          value={displayEventId}
          onChange={(e) => {
            setSeeded(true);
            setEventId(e.target.value);
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Token claim (từ #fragment — không dán query)
        <input
          value={token}
          onChange={(e) => setTokenOverride(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Claim token"
        />
      </label>

      {!token.trim() ? (
        <SurfaceState
          kind="empty"
          title="Chưa có token claim"
          detail="Mở link lời mời (token trong #fragment) sau khi đăng nhập. Không dán token vào query."
          testId="claim-token-empty"
        />
      ) : null}

      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy || !displayTenantSlug.trim() || !displayEventSlug.trim()}
          onClick={() => void loadSchema()}
        >
          {busy && !formDefinition ? 'Đang tải…' : 'Tải form/terms'}
        </button>
      </div>

      {busy && !ux ? (
        <SurfaceState
          kind="loading"
          title="Đang xử lý…"
          detail="Chưa có kết quả claim — đợi phản hồi từ máy chủ."
          testId="claim-busy-loading"
        />
      ) : null}

      {formDefinition ? (
        <>
          <RedeemFormFields
            definition={formDefinition}
            answers={answers}
            fieldErrors={fieldErrors}
            disabled={busy}
            onChange={(fieldId, value) =>
              setAnswers((prev) => ({ ...prev, [fieldId]: value }))
            }
          />
          <label className="redeem-checkbox">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <span>Đồng ý điều khoản ({termsVersion})</span>
          </label>
          {termsBody ? (
            <pre className="me-result" tabIndex={0}>
              {termsBody}
            </pre>
          ) : null}
        </>
      ) : null}

      <button
        type="button"
        disabled={busy || !token.trim()}
        onClick={() => void submitClaim()}
      >
        {busy ? 'Đang claim…' : 'Nhận lời mời (claim)'}
      </button>

      {ux ? (
        <section
          className={
            ux.kind === 'error' || ux.kind === 'denied' || ux.kind === 'expired'
              ? 'redeem-status redeem-status--error'
              : ux.kind === 'pending'
                ? 'redeem-status redeem-status--pending'
                : 'notice'
          }
          role="status"
          data-testid="guest-claim-result"
        >
          <h2>{ux.title}</h2>
          <p>{ux.detail}</p>
          {decision?.kind === 'pending' ? (
            <p>Pending chưa đảm bảo suất. Không coi là vé đã cấp.</p>
          ) : null}
        </section>
      ) : null}

      <details>
        <summary>Trạng thái intent (đã che token)</summary>
        <pre className="me-result" tabIndex={0}>
          {JSON.stringify(redacted, null, 2)}
        </pre>
      </details>
    </div>
  );
}
