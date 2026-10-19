import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Text,
  View,
} from 'react-native';
import {
  redeemDecisionAnnouncement,
  redeemStatusRefreshAnnouncement,
} from '@/a11y/announcements';
import { presentRedeemDecision } from '@/attendee/attendee-outcome-copy';
import { useAttendeeSignIn } from '@/attendee/use-attendee-sign-in';
import { AttendeeCta } from '@/components/attendee-cta';
import { BrandWordmark, Notice, Page } from '@/components/page';
import { getApiBaseUrl } from '@/identity/config';
import { session } from '@/identity/session';
import { fetchPublishedEventDetail } from '@/published/published-event-api';
import type { FormAnswerValue, FormDefinition } from '@/redeem/contract';
import { claimInvitation } from '@/redeem/claim-client';
import {
  clearGuestClaimIntent,
  dropGuestClaimIntentIfStale,
  parkGuestClaimIntent,
  peekGuestClaimIntent,
  resumeGuestClaimIntent,
} from '@/redeem/claim-intent';
import { requireTermsConsent, validateFormAnswers } from '@/redeem/form-validate';
import { fetchOwnerRedemptionStatus } from '@/redeem/owner-status';
import type { RedeemDecision } from '@/redeem/redeem-client';
import { RedeemFormFields } from '@/redeem/redeem-form-fields';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { typography } from '@/theme/typography';

function firstParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/**
 * Guest claim + login-return (C-I). Token never logged; answers cleared on switch.
 * Phase 2: Live Pulse visual + outcome fade-in. No fixture production fallback.
 */
export function ClaimScreen() {
  const params = useLocalSearchParams<{
    token?: string | string[];
    tenantId?: string | string[];
    eventId?: string | string[];
    tenantSlug?: string | string[];
    eventSlug?: string | string[];
  }>();
  const router = useRouter();
  const {
    busy: signInBusy,
    error: signInError,
    configured,
    signIn,
  } = useAttendeeSignIn();

  const linkToken = firstParam(params.token);
  const linkTenantId = firstParam(params.tenantId);
  const linkEventId = firstParam(params.eventId);
  const linkTenantSlug = firstParam(params.tenantSlug);
  const linkEventSlug = firstParam(params.eventSlug);

  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<RedeemDecision | null>(null);
  const [form, setForm] = useState<FormDefinition | null>(null);
  const [termsVersion, setTermsVersion] = useState<string | null>(null);
  const [termsBody, setTermsBody] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, FormAnswerValue>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [reduceMotionOs, setReduceMotionOs] = useState(false);
  const [outcomeOpacity] = useState(() => new Animated.Value(1));

  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const verified = identity.status === 'verified';
  const needsLogin = !verified;

  const activeScope = useMemo(() => {
    const parked = peekGuestClaimIntent();
    return {
      token: linkToken || parked?.token || '',
      tenantId: linkTenantId || parked?.tenantId || '',
      eventId: linkEventId || parked?.eventId || '',
      tenantSlug: linkTenantSlug || parked?.tenantSlug || '',
      eventSlug: linkEventSlug || parked?.eventSlug || '',
    };
  }, [
    linkToken,
    linkTenantId,
    linkEventId,
    linkTenantSlug,
    linkEventSlug,
  ]);

  const missingInvite =
    !activeScope.token.trim() ||
    !activeScope.tenantId.trim() ||
    !activeScope.eventId.trim();

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotionOs(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionOs,
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!decision) return;
    if (reduceMotionOs) {
      outcomeOpacity.setValue(1);
      return;
    }
    outcomeOpacity.setValue(0);
    Animated.timing(outcomeOpacity, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [decision, outcomeOpacity, reduceMotionOs]);

  useEffect(() => {
    // Park link params for login-return; clear on identity flip.
    if (linkToken && linkTenantId && linkEventId) {
      const epoch = session.captureEpoch();
      parkGuestClaimIntent({
        token: linkToken,
        tenantId: linkTenantId,
        eventId: linkEventId,
        tenantSlug: linkTenantSlug || undefined,
        eventSlug: linkEventSlug || undefined,
        parkedUserId: epoch?.userId ?? null,
        parkedGeneration: epoch?.generation ?? null,
      });
    }

    return session.subscribe(() => {
      const epoch = session.captureEpoch();
      dropGuestClaimIntentIfStale({
        epoch,
        isEpochCurrent: (e) => session.isEpochCurrent(e),
      });
      const snap = session.getSnapshot();
      if (snap.status !== 'verified') {
        setAnswers({});
        setTermsAccepted(false);
        setDecision(null);
        return;
      }
      const resumed = resumeGuestClaimIntent({
        epoch,
        isEpochCurrent: (e) => session.isEpochCurrent(e),
      });
      if (resumed.ok) {
        setNotice('Đã đăng nhập — tiếp tục nhận vé với cùng lời mời.');
      }
    });
  }, [
    linkToken,
    linkTenantId,
    linkEventId,
    linkTenantSlug,
    linkEventSlug,
  ]);

  useEffect(() => {
    const t = activeScope.tenantSlug.trim();
    const e = activeScope.eventSlug.trim();
    if (!t || !e) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchPublishedEventDetail(t, e);
      if (cancelled) return;
      if (result.status === 'ok') {
        setForm(result.event.form ?? null);
        setTermsVersion(result.event.terms?.version ?? null);
        setTermsBody(result.event.terms?.bodyMarkdown ?? null);
        setNotice(
          `Đã tải form đã xuất bản (schema v${result.event.schemaVersion}).`,
        );
        return;
      }
      if (result.status === 'misconfigured') {
        setNotice('Chưa cấu hình API — chưa tải form nhận vé.');
        return;
      }
      setNotice('Không tải được biểu mẫu. Không dùng dữ liệu mẫu.');
    })();
    return () => {
      cancelled = true;
    };
  }, [activeScope.tenantSlug, activeScope.eventSlug]);

  async function submitClaim() {
    const epoch = session.captureEpoch();
    const resumed = resumeGuestClaimIntent({
      epoch,
      isEpochCurrent: (e) => session.isEpochCurrent(e),
    });
    if (!resumed.ok) {
      if (resumed.reason === 'epoch-stale' || resumed.reason === 'user-mismatch') {
        setNotice('Đã xoá lời mời sau khi đổi tài khoản hoặc đăng xuất.');
        return;
      }
      setNotice('Thiếu token lời mời hoặc phạm vi tenant/sự kiện.');
      return;
    }

    const bearer = await session.getCredential();
    const apiBase = getApiBaseUrl();
    if (!session.isEpochCurrent(epoch) || !bearer || !apiBase || !epoch) {
      setNotice('Cần phiên đã xác minh để nhận vé mời.');
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

    const intent = resumed.intent;
    setBusy(true);
    try {
      const next = await claimInvitation({
        apiBase,
        bearer,
        tenantId: intent.tenantId,
        eventId: intent.eventId,
        token: intent.token,
        idempotencyKey: crypto.randomUUID(),
        formVersion: form?.formVersion,
        termsVersion: termsVersion ?? undefined,
        answers: validated.answers,
        termsAccepted: termsAccepted === true,
      });
      if (!session.isEpochCurrent(epoch)) return;
      setDecision(next);
      if (next.kind === 'issued' || next.kind === 'pending' || next.kind === 'denied') {
        clearGuestClaimIntent();
      }
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
      if (result.status === 'ok' && result.body.status === 'ISSUED') {
        setDecision({
          kind: 'issued',
          ticketId: result.body.ticketId,
          requestId: result.body.requestId,
          replayed: true,
        });
      } else if (result.status === 'ok' && result.body.status === 'REJECTED') {
        setDecision({
          kind: 'denied',
          code: 'REJECTED',
          message: result.body.reason ?? 'Lời mời bị từ chối.',
        });
      } else if (result.status === 'ok' && result.body.status === 'EXPIRED') {
        setDecision({
          kind: 'denied',
          code: 'PENDING_EXPIRED',
          message: 'Lời mời chờ đã hết hạn.',
        });
      } else if (result.status === 'not-found') {
        setNotice(
          'Chưa có API trạng thái. Đang chờ vẫn chưa phải vé.',
        );
      }
    } finally {
      if (session.isEpochCurrent(epoch)) setBusy(false);
    }
  }

  const outcome = presentRedeemDecision(decision, { surface: 'claim' });
  const outcomeDetail = outcome.secondary
    ? `${outcome.detail}\n${outcome.secondary}`
    : outcome.detail;

  return (
    <Page>
      <BrandWordmark compact />
      <Text
        accessibilityRole="header"
        style={{ color: brand.ink, ...typography.display }}
      >
        Nhận vé mời
      </Text>
      <Text style={{ color: colors.secondary, ...typography.body }}>
        Chỉ email đã được mời và xác minh. Sau đăng nhập quay lại đây để hoàn
        tất; dữ liệu tạm xoá khi đăng xuất hoặc đổi tài khoản.
      </Text>

      {missingInvite ? (
        <Notice title="Thiếu liên kết lời mời">
          Mở đúng liên kết nhận vé (có token lời mời). Không nhập tay token —
          dùng liên kết từ thư mời.
        </Notice>
      ) : null}

      {needsLogin ? (
        <Notice title="Cần đăng nhập">
          Đăng nhập bằng email đã được mời, rồi quay lại đây với cùng lời mời.
        </Notice>
      ) : null}

      {notice ? (
        <Text
          style={{
            color: colors.secondary,
            fontFamily: fontFamilies.body,
            fontSize: 15,
            lineHeight: 22,
          }}
          accessibilityLiveRegion="polite"
        >
          {notice}
        </Text>
      ) : null}

      {needsLogin ? (
        <View style={{ gap: 10 }}>
          {configured ? (
            <AttendeeCta
              label={signInBusy ? 'Đang đăng nhập…' : 'Đăng nhập để nhận vé'}
              onPress={() => void signIn()}
              disabled={signInBusy}
              testID="claim-cta-signin"
            />
          ) : (
            <AttendeeCta
              label="Đến tài khoản để đăng nhập"
              onPress={() => router.push('/my-tickets')}
              testID="claim-cta-account"
            />
          )}
          {signInError ? (
            <Notice title="Không đăng nhập được" tone="deny">
              {signInError}
            </Notice>
          ) : null}
        </View>
      ) : null}

      <RedeemFormFields
        form={form}
        termsVersion={termsVersion}
        termsBody={termsBody}
        answers={answers}
        termsAccepted={termsAccepted}
        disabled={busy || needsLogin || missingInvite}
        fieldErrors={fieldErrors}
        onChangeAnswer={(fieldId, value) =>
          setAnswers((prev) => ({ ...prev, [fieldId]: value }))
        }
        onTermsAcceptedChange={setTermsAccepted}
      />

      <AttendeeCta
        label={busy ? 'Đang xử lý…' : 'Nhận vé mời'}
        onPress={() => void submitClaim()}
        disabled={busy || needsLogin || missingInvite}
        testID="claim-cta-submit"
      />

      {decision ? (
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
          {decision.kind === 'issued' ? (
            <View style={{ marginTop: 12 }}>
              <AttendeeCta
                label="Xem vé của tôi"
                variant="secondary"
                onPress={() => router.push('/my-tickets')}
                testID="claim-cta-wallet"
              />
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      {decision?.kind === 'pending' ? (
        <AttendeeCta
          label="Kiểm tra lại"
          variant="secondary"
          disabled={busy}
          onPress={() => void refreshStatus()}
          accessibilityLabel={
            redeemStatusRefreshAnnouncement().accessibilityLabel
          }
          testID="claim-cta-refresh"
        />
      ) : null}
    </Page>
  );
}
