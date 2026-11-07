import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import {
  redeemDecisionAnnouncement,
  redeemStatusRefreshAnnouncement,
} from '@/a11y/announcements';
import { presentRedeemDecision } from '@/attendee/attendee-outcome-copy';
import { useAttendeeSignIn } from '@/attendee/use-attendee-sign-in';
import { AttendeeCta } from '@/components/attendee-cta';
import { Notice, Page } from '@/components/page';
import { getApiBaseUrl } from '@/identity/config';
import { session } from '@/identity/session';
import { isValidInvitationClaimScope } from '@/links/installed-app-link';
import { fetchPublishedEventDetail } from '@/published/published-event-api';
import type { FormAnswerValue, FormDefinition } from '@/redeem/contract';
import { claimInvitation } from '@/redeem/claim-client';
import { claimPresentation } from '@/redeem/claim-presentation';
import {
  clearGuestClaimIntent,
  dropGuestClaimIntentIfStale,
  parkGuestClaimIntent,
  peekGuestClaimIntent,
  resumeGuestClaimIntent,
} from '@/redeem/claim-intent';
import {
  requireTermsConsent,
  validateFormAnswers,
} from '@/redeem/form-validate';
import { resolveTermsForDisplay } from '@/redeem/terms-display';
import { randomId } from '@/lib/random-id';
import { refreshWalletAfterIssue } from '@/tickets/refresh-wallet-after-issue';
import { ticketDetailHref } from '@/tickets/ticket-detail-href';
import { fetchOwnerRedemptionStatus } from '@/redeem/owner-status';
import type { RedeemDecision } from '@/redeem/redeem-client';
import { RedeemFormFields } from '@/redeem/redeem-form-fields';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { radius, space } from '@/theme/tokens';

function firstParam(value: string | string[] | undefined): string {
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
    intent?: string | string[];
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
  const [eventName, setEventName] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [previewRetry, setPreviewRetry] = useState(0);
  const retryKey = useRef<string | null>(null);
  const [reduceMotionOs, setReduceMotionOs] = useState(false);
  const [outcomeOpacity] = useState(() => new Animated.Value(1));

  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const verified = identity.status === 'verified';
  const needsLogin = !verified;

  const parked = peekGuestClaimIntent();
  const activeScope = {
    token: linkToken || parked?.token || '',
    tenantId: linkTenantId || parked?.tenantId || '',
    eventId: linkEventId || parked?.eventId || '',
    tenantSlug: linkTenantSlug || parked?.tenantSlug || '',
    eventSlug: linkEventSlug || parked?.eventSlug || '',
  };

  const missingInvite = !isValidInvitationClaimScope(activeScope);
  const previewRequired = Boolean(
    activeScope.tenantSlug.trim() && activeScope.eventSlug.trim(),
  );
  const effectivePreviewStatus = previewRequired ? previewStatus : 'ready';

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
    if (
      isValidInvitationClaimScope({
        token: linkToken,
        tenantId: linkTenantId,
        eventId: linkEventId,
      })
    ) {
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
    const initialIntent = peekGuestClaimIntent();
    const initialEpoch = session.captureEpoch();
    if (initialIntent && initialIntent.parkedUserId === null && initialEpoch) {
      parkGuestClaimIntent({
        ...initialIntent,
        parkedUserId: initialEpoch.userId,
        parkedGeneration: initialEpoch.generation,
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
        retryKey.current = null;
        return;
      }
      const resumed = resumeGuestClaimIntent({
        epoch,
        isEpochCurrent: (e) => session.isEpochCurrent(e),
      });
      if (resumed.ok) {
        if (resumed.intent.parkedUserId === null && epoch) {
          parkGuestClaimIntent({
            ...resumed.intent,
            parkedUserId: epoch.userId,
            parkedGeneration: epoch.generation,
          });
        }
        setNotice('Đã đăng nhập — tiếp tục nhận vé với cùng lời mời.');
      }
    });
  }, [linkToken, linkTenantId, linkEventId, linkTenantSlug, linkEventSlug]);

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
        setEventName(result.event.name);
        const terms = resolveTermsForDisplay(
          result.event.terms,
          result.event.terms,
        );
        setTermsVersion(terms.version);
        setTermsBody(terms.body);
        setPreviewStatus('ready');
        if (previewRetry > 0) {
          setTermsAccepted(false);
          setDecision(null);
        }
        return;
      }
      setPreviewStatus('error');
    })();
    return () => {
      cancelled = true;
    };
  }, [activeScope.tenantSlug, activeScope.eventSlug, previewRetry]);

  async function submitClaim() {
    const epoch = session.captureEpoch();
    const resumed = resumeGuestClaimIntent({
      epoch,
      isEpochCurrent: (e) => session.isEpochCurrent(e),
    });
    if (!resumed.ok) {
      if (
        resumed.reason === 'epoch-stale' ||
        resumed.reason === 'user-mismatch'
      ) {
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

    if (
      effectivePreviewStatus !== 'ready' ||
      decision?.kind === 'pending' ||
      decision?.kind === 'issued'
    )
      return;
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
        idempotencyKey: retryKey.current ?? (retryKey.current = randomId()),
        formVersion: form?.formVersion,
        termsVersion: termsVersion ?? undefined,
        answers: validated.answers,
        termsAccepted: termsAccepted === true,
      });
      if (!session.isEpochCurrent(epoch)) return;
      setDecision(next);
      if (next.kind !== 'unknown') retryKey.current = null;
      if (
        next.kind === 'issued' ||
        next.kind === 'pending' ||
        next.kind === 'denied'
      ) {
        clearGuestClaimIntent();
      }
      if (next.kind === 'issued') {
        await refreshWalletAfterIssue();
        if (!session.isEpochCurrent(epoch)) return;
        router.push(ticketDetailHref(next.ticketId));
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
        await refreshWalletAfterIssue();
        if (!session.isEpochCurrent(epoch)) return;
        router.push(ticketDetailHref(result.body.ticketId));
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
        setNotice('Chưa có API trạng thái. Đang chờ vẫn chưa phải vé.');
      } else if (result.status === 'unreachable') {
        setNotice('Chưa kết nối được. Có thể thử kiểm tra lại trạng thái.');
      } else if (result.status !== 'ok') {
        setNotice('Không kiểm tra được trạng thái lúc này. Chưa có vé.');
      }
    } finally {
      if (session.isEpochCurrent(epoch)) setBusy(false);
    }
  }

  const outcome = presentRedeemDecision(decision, { surface: 'claim' });
  const presentation = claimPresentation({
    hasInvite: !missingInvite,
    verified,
    decision,
  });
  const invalid = presentation.phase === 'invalid';
  const pending = presentation.phase === 'pending';
  const issued = presentation.phase === 'issued';
  const unknown = decision?.kind === 'unknown';
  const canSubmit =
    !busy &&
    !needsLogin &&
    !invalid &&
    effectivePreviewStatus === 'ready' &&
    !pending &&
    !issued &&
    (!decision || unknown);
  const leaveClaim = (href: '/(tabs)/(events)' | '/(tabs)/my-tickets') => {
    clearGuestClaimIntent();
    router.replace(href);
  };

  return (
    <Page>
      <View style={{ gap: space.md }}>
        <View
          style={{
            width: space.huge,
            height: space.huge,
            borderRadius: radius.lg,
            borderCurve: 'continuous',
            backgroundColor: colors.surfaceSubtle,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SymbolView
            name={pending ? 'clock' : invalid ? 'link.badge.plus' : 'envelope'}
            size={28}
            tintColor={colors.accent}
          />
        </View>
        <Text
          accessibilityRole="header"
          style={{ ...typography.display, color: colors.label }}
        >
          {invalid
            ? 'Liên kết không hợp lệ'
            : pending
              ? 'Đang chờ duyệt'
              : issued
                ? 'Đã nhận vé'
                : presentation.phase === 'failure'
                  ? 'Không thể nhận vé'
                  : needsLogin
                    ? 'Bạn có lời mời nhận vé'
                    : 'Kiểm tra trước khi nhận'}
        </Text>
        <Text
          selectable
          style={{ ...typography.subhead, color: colors.secondary }}
        >
          {invalid
            ? 'Liên kết nhận vé thiếu thông tin, không đúng hoặc đã hết hạn. Hãy mở lại liên kết trong thư mời hoặc liên hệ đơn vị tổ chức.'
            : pending
              ? 'Yêu cầu nhận vé đã được ghi nhận. Chỉ khi được cấp, vé mới xuất hiện trong Ví của tôi.'
              : issued
                ? 'Vé đã được cấp cho tài khoản của bạn.'
                : presentation.phase === 'failure'
                  ? 'Lời mời không thể nhận bằng tài khoản này hoặc yêu cầu đã bị từ chối. Chưa có vé được cấp.'
                  : needsLogin
                    ? 'Đăng nhập bằng email nhận thư mời để tiếp tục. Lời mời được kiểm tra khi bạn xác nhận.'
                    : 'Bạn đang dùng tài khoản đã đăng nhập. Máy chủ sẽ kiểm tra email được mời khi gửi yêu cầu.'}
        </Text>
      </View>

      {!invalid && !issued ? (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            borderCurve: 'continuous',
            overflow: 'hidden',
          }}
        >
          <View style={{ padding: space.lg, gap: space.sm }}>
            <Text style={{ ...typography.badge, color: colors.secondary }}>
              SỰ KIỆN
            </Text>
            <Text
              selectable
              style={{ ...typography.sectionTitleBold, color: colors.label }}
            >
              {eventName ?? 'Lời mời nhận vé sự kiện'}
            </Text>
            <Text style={{ ...typography.caption, color: colors.secondary }}>
              {eventName
                ? 'Thông tin sự kiện công khai.'
                : 'Tên sự kiện chỉ hiện khi liên kết có thông tin công khai.'}
            </Text>
          </View>
        </View>
      ) : null}

      {invalid ? (
        <AttendeeCta
          label={presentation.homeLabel}
          onPress={() => leaveClaim(presentation.homeHref)}
          testID="claim-cta-invalid-home"
        />
      ) : needsLogin ? (
        <View style={{ gap: space.md }}>
          <Notice title="Liên kết được giữ tạm">
            App giữ lời mời trong lúc đăng nhập. Đổi tài khoản hoặc đăng xuất sẽ
            xoá dữ liệu lời mời tạm.
          </Notice>
          <AttendeeCta
            label={signInBusy ? 'Đang đăng nhập…' : 'Đăng nhập để tiếp tục'}
            onPress={() => void signIn()}
            disabled={signInBusy || !configured}
            testID="claim-cta-signin"
          />
          {!configured ? (
            <Notice title="Chưa thể đăng nhập" tone="deny">
              Đăng nhập chưa được cấu hình trên bản app này.
            </Notice>
          ) : null}
          {signInError ? (
            <Notice title="Không đăng nhập được" tone="deny">
              {signInError}
            </Notice>
          ) : null}
          <AttendeeCta
            label="Về Sự kiện"
            variant="secondary"
            onPress={() => leaveClaim('/(tabs)/(events)')}
            testID="claim-cta-events"
          />
        </View>
      ) : pending ? (
        <View style={{ gap: space.md }}>
          {notice ? (
            <Text
              selectable
              style={{ ...typography.subhead, color: colors.secondary }}
            >
              {notice}
            </Text>
          ) : null}
          <AttendeeCta
            label={busy ? 'Đang kiểm tra…' : 'Kiểm tra lại trạng thái'}
            disabled={busy}
            onPress={() => void refreshStatus()}
            accessibilityLabel={
              redeemStatusRefreshAnnouncement().accessibilityLabel
            }
            testID="claim-cta-refresh"
          />
          <AttendeeCta
            label="Về Sự kiện"
            variant="secondary"
            onPress={() => leaveClaim('/(tabs)/(events)')}
            testID="claim-cta-events"
          />
        </View>
      ) : decision?.kind === 'issued' ? (
        <AttendeeCta
          label="Mở chi tiết vé"
          onPress={() => router.push(ticketDetailHref(decision.ticketId))}
          testID="claim-cta-ticket-detail"
        />
      ) : (
        <View style={{ gap: space.lg }}>
          {effectivePreviewStatus === 'loading' ? (
            <Notice title="Đang tải thông tin">
              Vui lòng chờ biểu mẫu và điều khoản của sự kiện.
            </Notice>
          ) : null}
          {effectivePreviewStatus === 'error' ? (
            <View style={{ gap: space.md }}>
              <Notice title="Chưa tải được thông tin" tone="unknown">
                Không thể kiểm tra biểu mẫu sự kiện lúc này. Hãy kết nối lại rồi
                thử.
              </Notice>
              <AttendeeCta
                label="Thử tải lại"
                variant="secondary"
                onPress={() => {
                  setPreviewStatus('loading');
                  setPreviewRetry((value) => value + 1);
                }}
                testID="claim-cta-preview-retry"
              />
            </View>
          ) : null}
          {decision?.kind === 'stale' && previewRequired ? (
            <AttendeeCta
              label="Tải lại biểu mẫu"
              variant="secondary"
              onPress={() => {
                setPreviewStatus('loading');
                setPreviewRetry((value) => value + 1);
              }}
              testID="claim-cta-form-reload"
            />
          ) : null}
          {effectivePreviewStatus === 'ready' && !unknown ? (
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
          ) : null}
          {notice ? (
            <Text
              selectable
              style={{ ...typography.subhead, color: colors.secondary }}
            >
              {notice}
            </Text>
          ) : null}
          {decision ? (
            <Animated.View
              style={{ opacity: reduceMotionOs ? 1 : outcomeOpacity }}
              {...redeemDecisionAnnouncement({
                kind: decision.kind,
                title: outcome.title,
                detail: outcome.detail,
              })}
              accessibilityLiveRegion={
                outcome.assertive ? 'assertive' : 'polite'
              }
            >
              <Notice title={outcome.title} tone={outcome.tone}>
                {decision.kind === 'denied'
                  ? 'Không thể nhận vé với lời mời này. Kiểm tra tài khoản hoặc liên hệ đơn vị tổ chức.'
                  : outcome.detail}
              </Notice>
            </Animated.View>
          ) : null}
          {canSubmit ? (
            <AttendeeCta
              label={
                busy
                  ? 'Đang xử lý…'
                  : unknown
                    ? 'Thử lại lần nhận vé'
                    : 'Nhận vé mời'
              }
              onPress={() => void submitClaim()}
              disabled={busy}
              testID="claim-cta-submit"
            />
          ) : null}
          <AttendeeCta
            label={
              decision?.kind === 'denied'
                ? presentation.homeLabel
                : 'Về Sự kiện'
            }
            variant="secondary"
            onPress={() =>
              leaveClaim(
                decision?.kind === 'denied'
                  ? presentation.homeHref
                  : '/(tabs)/(events)',
              )
            }
            testID={
              decision?.kind === 'denied'
                ? 'claim-cta-denied-home'
                : 'claim-cta-events'
            }
          />
        </View>
      )}
    </Page>
  );
}
