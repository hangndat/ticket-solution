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

/**
 * Pure snapshot: fragment + parked intent (no side effects).
 * Returns a cached reference when values are unchanged so useSyncExternalStore
 * does not infinite-loop (Object.is) into the route error boundary.
 */
function getClaimLocationSnapshot(): ClaimLocation {
  const fromLoc = readClaimTokenFromLocation();
  let next: ClaimLocation;
  if (fromLoc.token || fromLoc.tenantId || fromLoc.eventId) {
    next = {
      token: fromLoc.token,
      tenantId: fromLoc.tenantId,
      eventId: fromLoc.eventId,
      tenantSlug: fromLoc.tenantSlug,
      eventSlug: fromLoc.eventSlug,
    };
  } else {
    const parked = peekGuestClaimIntent();
    if (!parked) {
      next = EMPTY_LOCATION;
    } else {
      next = {
        token: parked.token,
        tenantId: parked.tenantId,
        eventId: parked.eventId,
        tenantSlug: parked.tenantSlug ?? '',
        eventSlug: parked.eventSlug ?? '',
      };
    }
  }
  if (sameClaimLocation(cachedLocationSnapshot, next)) {
    return cachedLocationSnapshot;
  }
  cachedLocationSnapshot = next;
  return cachedLocationSnapshot;
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
    () => EMPTY_LOCATION,
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
  const [idempotencyKey] = useState(
    () =>
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `claim-${Date.now().toString(16)}`,
  );

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
        title: 'Đã tải biểu mẫu',
        detail:
          'Điền các trường và đồng ý điều khoản trước khi nhận lời mời.',
        retryable: false,
      });
    } else {
      setFormDefinition(null);
      setTermsVersion(null);
      setTermsBody(null);
      setUx({
        kind: 'error',
        title: 'Không tải được biểu mẫu',
        detail:
          result.status === 'not-found'
            ? 'Không tìm thấy sự kiện đã xuất bản.'
            : result.status === 'unreachable'
              ? 'Không tải được biểu mẫu sự kiện. Thử lại sau — không dùng bản demo.'
              : 'Thiếu đường dẫn tổ chức/sự kiện hoặc biểu mẫu không hợp lệ.',
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
        title: 'Thiếu mã lời mời',
        detail:
          'Mở liên kết lời mời để lấy mã — không dán mã vào địa chỉ trang.',
        retryable: false,
      });
      setBusy(false);
      return;
    }
    if (!displayTenantId.trim() || !displayEventId.trim()) {
      setUx({
        kind: 'error',
        title: 'Thiếu thông tin sự kiện',
        detail: 'Cần mã tổ chức và mã sự kiện kèm theo lời mời.',
        retryable: false,
      });
      setBusy(false);
      return;
    }
    if (!formDefinition || !termsVersion) {
      setUx({
        kind: 'error',
        title: 'Chưa có biểu mẫu',
        detail:
          'Tải biểu mẫu sự kiện đã xuất bản trước khi nhận lời mời.',
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
        title: 'Biểu mẫu chưa hợp lệ',
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

  return (
    <div className="redeem-form">
      <p>
        Đăng nhập bằng đúng email đã được mời, mở liên kết lời mời, rồi điền
        biểu mẫu và đồng ý điều khoản. Email chưa xác minh, sai email, hoặc lời
        mời hết hạn sẽ không được cấp vé. Không tự tạo tài khoản mới.
      </p>

      <div className="auth-buttons">
        <a className="button-link" href={loginHref}>
          Đăng nhập rồi quay lại nhận lời mời
        </a>
      </div>

      <label>
        Đường dẫn tổ chức
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
        Đường dẫn sự kiện
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
        Mã tổ chức
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
        Mã sự kiện
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
        Mã lời mời (từ liên kết — không dán vào địa chỉ trang)
        <input
          value={token}
          onChange={(e) => setTokenOverride(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Mã lời mời"
        />
      </label>

      {!token.trim() ? (
        <SurfaceState
          kind="empty"
          title="Chưa có mã lời mời"
          detail="Mở liên kết lời mời sau khi đăng nhập. Không dán mã vào địa chỉ trang."
          testId="claim-token-empty"
        />
      ) : null}

      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy || !displayTenantSlug.trim() || !displayEventSlug.trim()}
          onClick={() => void loadSchema()}
        >
          {busy && !formDefinition ? 'Đang tải…' : 'Tải biểu mẫu'}
        </button>
      </div>

      {busy && !ux ? (
        <SurfaceState
          kind="loading"
          title="Đang xử lý…"
          detail="Đang chờ phản hồi từ máy chủ — chưa có kết quả nhận lời mời."
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
            <span>Tôi đồng ý với điều khoản</span>
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
        {busy ? 'Đang gửi…' : 'Nhận lời mời'}
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
            <p>Đang chờ duyệt — chưa coi là vé đã cấp.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
