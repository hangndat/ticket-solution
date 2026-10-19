import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Animated, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
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
import { useFadeInOnMount } from '@/hooks/use-fade-in-on-mount';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';

const AUTH_CODES = new Set(['UNAUTHENTICATED', 'EMAIL_NOT_VERIFIED']);

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function RedeemScreen() {
  const routeParams = useLocalSearchParams<{
    tenantSlug?: string | string[];
    eventSlug?: string | string[];
  }>();
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

  const [tenantId, setTenantId] = useState(getTenantId() ?? '');
  const [eventId, setEventId] = useState(getEventId() ?? '');
  // Route params from event-detail CTA (AC-E3); local edit overrides until remount.
  const routeTenantSlug = firstParam(routeParams.tenantSlug).trim();
  const routeEventSlug = firstParam(routeParams.eventSlug).trim();
  const [tenantSlugEdit, setTenantSlugEdit] = useState<string | null>(null);
  const [eventSlugEdit, setEventSlugEdit] = useState<string | null>(null);
  const tenantSlug = tenantSlugEdit ?? routeTenantSlug;
  const eventSlug = eventSlugEdit ?? routeEventSlug;
  const setTenantSlug = setTenantSlugEdit;
  const setEventSlug = setEventSlugEdit;
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
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  const verified = identity.status === 'verified';
  const needsAuth =
    !verified &&
    (configured ||
      (decision?.kind === 'denied' && AUTH_CODES.has(decision.code)));

  const loadPublishedSchema = useCallback(async () => {
    const t = tenantSlug.trim();
    const e = eventSlug.trim();
    if (!t || !e) {
      setSchemaNotice(redeemCopy.emptyTitle);
      return;
    }
    setSchemaNotice('Đang tải…');
    setOfflineNotice(null);
    try {
      const result = await fetchPublishedEventDetail(t, e);
      if (result.status === 'ok') {
        setForm(result.event.form ?? null);
        setTermsVersion(result.event.terms?.version ?? null);
        setTermsBody(result.event.terms?.bodyMarkdown ?? null);
        if (result.event.id) setEventId(result.event.id);
        setSchemaNotice(
          `Đã tải biểu mẫu cho «${result.event.name}» · ${result.event.brand.organizationName}.`,
        );
        setAnswers({});
        setTermsAccepted(false);
        setFieldErrors({});
        return;
      }
      if (result.status === 'misconfigured') {
        setSchemaNotice(
          'Chưa cấu hình máy chủ. Không dùng biểu mẫu mẫu.',
        );
        return;
      }
      if (result.status === 'not-found') {
        setSchemaNotice('Không tìm thấy sự kiện đã xuất bản. Bản nháp không hiện.');
        return;
      }
      setSchemaNotice('Không tải được biểu mẫu đã xuất bản.');
    } catch {
      setOfflineNotice(redeemCopy.offlineBody);
      setSchemaNotice(null);
    }
  }, [tenantSlug, eventSlug]);

  useEffect(() => {
    const unsub = session.subscribe(() => {
      const snap = session.getSnapshot();
      if (snap.status !== 'verified') {
        setAnswers({});
        setTermsAccepted(false);
        setAttempt(null);
        setDecision(null);
        setStatusNote(null);
        return;
      }
      clearError();
      setDecision((prev) =>
        prev?.kind === 'denied' && AUTH_CODES.has(prev.code) ? null : prev,
      );
    });
    return unsub;
  }, [clearError]);

  async function submit() {
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
      });
      if (!session.isEpochCurrent(epoch)) return;
      setDecision(next);
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
        return;
      }
      if (result.status === 'not-found') {
        setStatusNote('Không tìm thấy yêu cầu. Đang chờ vẫn chưa phải vé.');
        return;
      }
      setStatusNote('Không làm mới được trạng thái. Giữ kết quả chờ — chưa phải vé.');
    } finally {
      if (session.isEpochCurrent(epoch)) setBusy(false);
    }
  }

  const onSignIn = async () => {
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
        Nhập mã, trả lời biểu mẫu và đồng ý điều khoản. Chờ duyệt chưa phải vé.
        Mất phản hồi thì giữ «chưa rõ» đến khi kiểm tra lại cùng lần thử.
      </Notice>

      {needsAuth ? (
        <Notice title={authDenied ? outcome.title : 'Cần đăng nhập'}>
          {authDenied
            ? outcome.detail
            : 'Đăng nhập rồi quay lại đổi mã. Chưa submit cấp vé khi thiếu phiên.'}
        </Notice>
      ) : null}

      {needsAuth ? (
        <AttendeeCta
          label={
            signInBusy
              ? 'Đang đăng nhập…'
              : decision?.kind === 'denied' &&
                  decision.code === 'EMAIL_NOT_VERIFIED'
                ? 'Xác minh email / đăng nhập lại'
                : 'Đăng nhập'
          }
          disabled={signInBusy}
          onPress={() => void onSignIn()}
          testID="redeem-cta-signin"
        />
      ) : null}

      {signInBusy ? (
        <LoadingState title="Đang đăng nhập">
          Chờ xác minh — chưa đổi mã.
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

      {schemaNotice ? (
        <Notice title="Biểu mẫu sự kiện">{schemaNotice}</Notice>
      ) : null}
      <TextInput
        value={tenantSlug}
        onChangeText={setTenantSlug}
        placeholder="Slug tổ chức (biểu mẫu đã xuất bản)"
        autoCapitalize="none"
        accessibilityLabel="Slug tổ chức cho biểu mẫu đã xuất bản"
        style={field}
      />
      <TextInput
        value={eventSlug}
        onChangeText={setEventSlug}
        placeholder="Slug sự kiện (biểu mẫu đã xuất bản)"
        autoCapitalize="none"
        accessibilityLabel="Slug sự kiện cho biểu mẫu đã xuất bản"
        style={field}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tải biểu mẫu và điều khoản đã xuất bản"
        disabled={busy}
        onPress={() => void loadPublishedSchema()}
        style={buttonSecondary}
      >
        <Text style={buttonSecondaryLabel}>Tải biểu mẫu / điều khoản</Text>
      </Pressable>
      <TextInput
        value={tenantId}
        onChangeText={setTenantId}
        placeholder="ID tổ chức"
        autoCapitalize="none"
        accessibilityLabel="ID tổ chức"
        style={field}
      />
      <TextInput
        value={eventId}
        onChangeText={setEventId}
        placeholder="ID sự kiện"
        autoCapitalize="none"
        accessibilityLabel="ID sự kiện"
        style={field}
      />
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Mã đổi"
        autoCapitalize="characters"
        accessibilityLabel="Mã đổi"
        style={field}
      />
      <RedeemFormFields
        form={form}
        termsVersion={termsVersion}
        termsBody={termsBody}
        answers={answers}
        termsAccepted={termsAccepted}
        disabled={busy || !verified}
        fieldErrors={fieldErrors}
        onChangeAnswer={(fieldId, value) =>
          setAnswers((prev) => ({ ...prev, [fieldId]: value }))
        }
        onTermsAcceptedChange={setTermsAccepted}
      />
      <View {...redeemActionAnnouncement()}>
        <AttendeeCta
          label={busy ? 'Đang xử lý…' : 'Đổi mã'}
          disabled={busy || !verified || code.trim().length === 0}
          onPress={() => void submit()}
          testID="redeem-cta-submit"
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
      {decision?.kind === 'pending' ? (
        <View {...redeemStatusRefreshAnnouncement()}>
          <AttendeeCta
            label="Kiểm tra lại"
            disabled={busy}
            onPress={() => void refreshStatus()}
            testID="redeem-cta-refresh-status"
          />
        </View>
      ) : null}
      {decision?.kind === 'issued' ? null : attempt?.key ? (
        <View {...redeemReconcileAnnouncement()}>
          <AttendeeCta
            label="Kiểm tra lại cùng lần thử"
            disabled={busy}
            onPress={() => void reconcile()}
            testID="redeem-cta-reconcile"
          />
        </View>
      ) : null}
      {decision?.kind === 'stale' ? (
        <AttendeeCta
          label="Tải lại biểu mẫu"
          variant="secondary"
          disabled={busy}
          onPress={() => void loadPublishedSchema()}
          testID="redeem-cta-reload-schema"
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

const buttonSecondary = {
  minHeight: 48,
  padding: 14,
  borderRadius: 12,
  backgroundColor: colors.card,
};

const buttonSecondaryLabel = {
  color: colors.label,
  fontSize: 17,
  fontFamily: fontFamilies.bodySemiBold,
  fontWeight: '600' as const,
  textAlign: 'center' as const,
};
