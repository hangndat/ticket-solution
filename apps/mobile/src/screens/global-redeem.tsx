import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { RedemptionResolveResponse } from '@ticket/contracts';
import {
  redeemActionAnnouncement,
  redeemDecisionAnnouncement,
  redeemReconcileAnnouncement,
  redeemStatusRefreshAnnouncement,
} from '@/a11y/announcements';
import { presentRedeemDecision } from '@/attendee/attendee-outcome-copy';
import { useAttendeeSignIn } from '@/attendee/use-attendee-sign-in';
import { AttendeeCta } from '@/components/attendee-cta';
import { Notice, Page } from '@/components/page';
import { ErrorState, LoadingState } from '@/components/screen-state';
import { redeemCopy } from '@/components/screen-state-copy';
import { getApiBaseUrl } from '@/identity/config';
import { session } from '@/identity/session';
import type { FormAnswerValue, FormDefinition } from '@/redeem/contract';
import {
  redeemPayloadFingerprint,
  resolveIdempotencyKey,
  type RedeemAttempt,
} from '@/redeem/attempt-key';
import {
  clearGlobalRedeemDraftIntent,
  dropGlobalRedeemDraftIntentIfStale,
  parkGlobalRedeemDraftIntent,
  peekGlobalRedeemDraftIntent,
  resumeGlobalRedeemDraftIntent,
} from '@/redeem/redeem-draft-intent';
import { resolveRedemptionCodeGlobal } from '@/redeem/global-resolve-client';
import { requireTermsConsent, validateFormAnswers } from '@/redeem/form-validate';
import { fetchOwnerRedemptionStatus } from '@/redeem/owner-status';
import {
  redeemCode,
  reconcileRedeem,
  type RedeemDecision,
} from '@/redeem/redeem-client';
import { RedeemFormFields } from '@/redeem/redeem-form-fields';
import { useFadeInOnMount } from '@/hooks/use-fade-in-on-mount';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';

const AUTH_CODES = new Set(['UNAUTHENTICATED', 'EMAIL_NOT_VERIFIED']);

function contextNotice(body: RedemptionResolveResponse): string {
  const window = body.redemptionWindow;
  const windowLine = window.open
    ? 'Cửa sổ đổi mã đang mở.'
    : 'Cửa sổ đổi mã đã đóng — có thể không đổi được.';
  return [
    body.tenantDisplayName,
    body.eventTitle,
    body.ticketTypeLabel,
    windowLine,
    body.approvalMode === 'MANUAL'
      ? 'Có thể cần duyệt thủ công trước khi có vé.'
      : 'Cấp vé tự động sau xác nhận.',
  ].join(' · ');
}

export function GlobalRedeemScreen() {
  const router = useRouter();
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const {
    busy: signInBusy,
    error: signInError,
    configured,
    signIn,
    clearError,
  } = useAttendeeSignIn();

  const [code, setCode] = useState(() => peekGlobalRedeemDraftIntent()?.code ?? '');
  const [resolveContext, setResolveContext] =
    useState<RedemptionResolveResponse | null>(null);
  const [resolveNotice, setResolveNotice] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<RedeemDecision | null>(null);
  const [attempt, setAttempt] = useState<RedeemAttempt | null>(null);
  const [form, setForm] = useState<FormDefinition | null>(null);
  const [termsVersion, setTermsVersion] = useState<string | null>(null);
  const [termsBody, setTermsBody] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, FormAnswerValue>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  const verified = identity.status === 'verified';
  const needsAuth = !verified && configured;
  const resolved = resolveContext !== null;

  const applyResolveBody = useCallback((body: RedemptionResolveResponse) => {
    setResolveContext(body);
    setResolveNotice(contextNotice(body));
    setResolveError(null);
    const publishedForm = body.published.form;
    setForm(publishedForm ? (publishedForm as FormDefinition) : null);
    setTermsVersion(body.published.terms?.version ?? null);
    setTermsBody(body.published.terms?.bodyMarkdown ?? null);
    setAnswers({});
    setTermsAccepted(false);
    setFieldErrors({});
    setDecision(null);
    setAttempt(null);
    setStatusNote(null);
  }, []);

  const runResolve = useCallback(
    async (codeToResolve: string) => {
      const epoch = session.captureEpoch();
      const bearer = await session.getCredential();
      const apiBase = getApiBaseUrl();
      if (!session.isEpochCurrent(epoch) || !bearer || !apiBase || !epoch) {
        setResolveError('Cần đăng nhập để tra cứu mã.');
        return;
      }
      setBusy(true);
      setResolveError(null);
      setOfflineNotice(null);
      try {
        const result = await resolveRedemptionCodeGlobal({
          apiBase,
          bearer,
          code: codeToResolve,
        });
        if (!session.isEpochCurrent(epoch)) return;
        if (result.status === 'ok') {
          applyResolveBody(result.body);
          return;
        }
        if (result.status === 'network') {
          setOfflineNotice(redeemCopy.offlineBody);
          return;
        }
        setResolveContext(null);
        setResolveNotice(null);
        setResolveError(result.message);
      } finally {
        if (session.isEpochCurrent(epoch)) setBusy(false);
      }
    },
    [applyResolveBody],
  );

  const wasVerifiedRef = useRef(identity.status === 'verified');

  useEffect(() => {
    const unsub = session.subscribe(() => {
      const epoch = session.captureEpoch();
      dropGlobalRedeemDraftIntentIfStale({
        epoch,
        isEpochCurrent: (e) => session.isEpochCurrent(e),
      });
      const snap = session.getSnapshot();
      if (snap.status !== 'verified') {
        setAnswers({});
        setTermsAccepted(false);
        setAttempt(null);
        setDecision(null);
        setStatusNote(null);
        setResolveContext(null);
        setResolveNotice(null);
        return;
      }
      clearError();
      setDecision((prev) =>
        prev?.kind === 'denied' && AUTH_CODES.has(prev.code) ? null : prev,
      );
    });
    return unsub;
  }, [clearError]);

  useEffect(() => {
    const nowVerified = identity.status === 'verified';
    const becameVerified = nowVerified && !wasVerifiedRef.current;
    wasVerifiedRef.current = nowVerified;
    if (!becameVerified) return;
    const epoch = session.captureEpoch();
    const resumed = resumeGlobalRedeemDraftIntent({
      epoch,
      isEpochCurrent: (e) => session.isEpochCurrent(e),
    });
    if (resumed.ok) {
      setCode(resumed.intent.code);
      void runResolve(resumed.intent.code);
    }
  }, [identity.status, runResolve]);

  async function onContinueOrResolve() {
    const trimmed = code.trim();
    if (!trimmed) {
      setResolveError('Nhập mã đổi vé.');
      return;
    }
    if (!verified) {
      const epoch = session.captureEpoch();
      parkGlobalRedeemDraftIntent({
        code: trimmed,
        parkedUserId: epoch?.userId ?? null,
        parkedGeneration: epoch?.generation ?? null,
      });
      const ok = await signIn();
      if (ok) setResolveError(null);
      return;
    }
    await runResolve(trimmed);
  }

  async function submit() {
    if (!resolveContext) {
      setResolveError('Tra cứu mã trước khi xác nhận đổi vé.');
      return;
    }
    const epoch = session.captureEpoch();
    const bearer = await session.getCredential();
    const apiBase = getApiBaseUrl();
    if (!session.isEpochCurrent(epoch) || !bearer || !apiBase || !epoch) {
      setDecision({
        kind: 'denied',
        code: 'UNAUTHENTICATED',
        message: 'Đăng nhập rồi quay lại đổi mã.',
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
      tenantId: resolveContext.tenantId,
      eventId: resolveContext.eventId,
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
    setOfflineNotice(null);
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
        resolveToken: resolveContext.resolveToken,
      });
      if (!session.isEpochCurrent(epoch)) return;
      setDecision(next);
      if (next.kind === 'issued' || next.kind === 'pending') {
        clearGlobalRedeemDraftIntent();
      }
      if (next.kind === 'unknown') {
        setAttempt({ key, fingerprint, unclear: true });
      } else if (next.kind === 'pending') {
        setAttempt(null);
        setStatusNote('Đang chờ duyệt — làm mới sau. Chưa phải vé.');
      } else {
        setAttempt(null);
      }
    } catch {
      setOfflineNotice(redeemCopy.offlineBody);
      setDecision({
        kind: 'unknown',
        idempotencyKey: key,
        message: redeemCopy.offlineBody,
      });
    } finally {
      if (session.isEpochCurrent(epoch)) setBusy(false);
    }
  }

  async function reconcile() {
    if (!attempt?.key || !resolveContext) return;
    const epoch = session.captureEpoch();
    const bearer = await session.getCredential();
    const apiBase = getApiBaseUrl();
    if (!session.isEpochCurrent(epoch) || !bearer || !apiBase) return;
    setBusy(true);
    try {
      const next = await reconcileRedeem({
        apiBase,
        bearer,
        tenantId: resolveContext.tenantId,
        eventId: resolveContext.eventId,
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
          setStatusNote('Vé đã sẵn sàng — mở tab Vé của tôi.');
        } else if (body.status === 'PENDING_REVIEW') {
          setStatusNote(
            `Vẫn chờ duyệt${body.expiresAt ? ` · hết hạn ${body.expiresAt}` : ''}. Chưa phải vé.`,
          );
        } else if (body.status === 'REJECTED') {
          setDecision({
            kind: 'denied',
            code: 'REJECTED',
            message: body.reason ?? 'Yêu cầu bị từ chối.',
          });
          setStatusNote(null);
        } else if (body.status === 'EXPIRED') {
          setDecision({
            kind: 'denied',
            code: 'PENDING_EXPIRED',
            message: 'Yêu cầu chờ đã hết hạn. Mã có thể được giải phóng.',
          });
          setStatusNote(null);
        }
      }
    } finally {
      if (session.isEpochCurrent(epoch)) setBusy(false);
    }
  }

  const onSignIn = async () => {
    const trimmed = code.trim();
    if (trimmed) {
      const epoch = session.captureEpoch();
      parkGlobalRedeemDraftIntent({
        code: trimmed,
        parkedUserId: epoch?.userId ?? null,
        parkedGeneration: epoch?.generation ?? null,
      });
    }
    const ok = await signIn();
    if (ok && decision?.kind === 'denied' && AUTH_CODES.has(decision.code)) {
      setDecision(null);
    }
  };

  const outcome = presentRedeemDecision(decision, { surface: 'redeem' });
  const outcomeDetail = outcome.secondary
    ? `${outcome.detail}\n${outcome.secondary}`
    : outcome.detail;
  const authDenied =
    decision?.kind === 'denied' && AUTH_CODES.has(decision.code);
  const showOutcome = Boolean(decision && !authDenied);
  const { opacity: outcomeOpacity, reduceMotionOs } =
    useFadeInOnMount(showOutcome);

  return (
    <Page>
      <Notice title="Đổi mã lấy vé">
        Nhập mã đổi vé — không cần chọn sự kiện. Đăng nhập trước khi tra cứu;
        mã được giữ tạm trong bộ nhớ (không ghi URL). Chờ duyệt chưa phải vé.
      </Notice>

      {needsAuth ? (
        <Notice title="Cần đăng nhập">
          Nhập mã rồi đăng nhập — sau đó app tra cứu và hiển thị sự kiện tương
          ứng. Chưa gọi máy chủ khi chưa có phiên.
        </Notice>
      ) : null}

      {needsAuth ? (
        <AttendeeCta
          label={
            signInBusy
              ? 'Đang đăng nhập…'
              : 'Đăng nhập để tra cứu mã'
          }
          disabled={signInBusy || code.trim().length === 0}
          onPress={() => void onSignIn()}
          testID="global-redeem-cta-signin"
        />
      ) : null}

      {signInBusy ? (
        <LoadingState title="Đang đăng nhập">
          Chờ xác minh — chưa tra cứu mã.
        </LoadingState>
      ) : null}

      {signInError ? (
        <ErrorState
          title={redeemCopy.authCancelTitle}
          onRetry={() => void onSignIn()}
          retryLabel="Thử lại"
        >
          {signInError}
        </ErrorState>
      ) : null}

      {offlineNotice ? (
        <Notice title={redeemCopy.offlineTitle}>{offlineNotice}</Notice>
      ) : null}

      {resolveNotice ? (
        <Notice title="Kết quả tra cứu">{resolveNotice}</Notice>
      ) : null}

      {resolveError ? (
        <Notice title="Không tra cứu được" tone="deny">
          {resolveError}
        </Notice>
      ) : null}

      <TextInput
        value={code}
        onChangeText={(value) => {
          setCode(value);
          if (resolved) {
            setResolveContext(null);
            setResolveNotice(null);
          }
        }}
        placeholder="Mã đổi"
        autoCapitalize="characters"
        accessibilityLabel="Mã đổi vé"
        editable={!busy}
        style={field}
      />

      {!needsAuth ? (
        <AttendeeCta
          label={busy ? 'Đang tra cứu…' : resolved ? 'Tra cứu lại' : 'Tra cứu mã'}
          variant="secondary"
          disabled={busy || code.trim().length === 0}
          onPress={() => void onContinueOrResolve()}
          testID="global-redeem-cta-resolve"
        />
      ) : (
        <AttendeeCta
          label="Tiếp tục"
          disabled={busy || signInBusy || code.trim().length === 0}
          onPress={() => void onContinueOrResolve()}
          testID="global-redeem-cta-continue"
        />
      )}

      <RedeemFormFields
        form={form}
        termsVersion={termsVersion}
        termsBody={termsBody}
        answers={answers}
        termsAccepted={termsAccepted}
        disabled={busy || !verified || !resolved}
        fieldErrors={fieldErrors}
        onChangeAnswer={(fieldId, value) =>
          setAnswers((prev) => ({ ...prev, [fieldId]: value }))
        }
        onTermsAcceptedChange={setTermsAccepted}
      />

      <View {...redeemActionAnnouncement()}>
        <AttendeeCta
          label={busy ? 'Đang xử lý…' : 'Xác nhận đổi mã'}
          disabled={busy || !verified || !resolved || code.trim().length === 0}
          onPress={() => void submit()}
          testID="global-redeem-cta-submit"
        />
      </View>

      {showOutcome && decision ? (
        <Animated.View
          style={{ opacity: reduceMotionOs ? 1 : outcomeOpacity }}
          {...redeemDecisionAnnouncement({
            kind: decision.kind,
            title: outcome.title,
            detail: outcomeDetail,
          })}
          accessibilityLiveRegion={outcome.assertive ? 'assertive' : 'polite'}
        >
          <Notice title={outcome.title} tone={outcome.tone}>
            {outcomeDetail}
          </Notice>
        </Animated.View>
      ) : null}

      {statusNote ? <Notice title="Trạng thái">{statusNote}</Notice> : null}

      {decision?.kind === 'issued' ? (
        <AttendeeCta
          label="Xem vé của tôi"
          variant="secondary"
          onPress={() => router.push('/my-tickets')}
          testID="global-redeem-cta-wallet"
        />
      ) : null}

      {decision?.kind === 'pending' ? (
        <View {...redeemStatusRefreshAnnouncement()}>
          <AttendeeCta
            label="Kiểm tra lại"
            disabled={busy}
            onPress={() => void refreshStatus()}
            testID="global-redeem-cta-refresh-status"
          />
        </View>
      ) : null}

      {decision?.kind === 'issued' ? null : attempt?.key ? (
        <View {...redeemReconcileAnnouncement()}>
          <AttendeeCta
            label="Kiểm tra lại cùng lần thử"
            disabled={busy}
            onPress={() => void reconcile()}
            testID="global-redeem-cta-reconcile"
          />
        </View>
      ) : null}

      {decision?.kind === 'stale' ? (
        <AttendeeCta
          label="Tra cứu lại mã"
          variant="secondary"
          disabled={busy}
          onPress={() => void runResolve(code.trim())}
          testID="global-redeem-cta-re-resolve"
        />
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
  fontFamily: fontFamilies.body,
};
