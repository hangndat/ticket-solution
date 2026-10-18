import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  redeemDecisionAnnouncement,
  redeemStatusRefreshAnnouncement,
} from '@/a11y/announcements';
import { presentRedeemDecision } from '@/attendee/attendee-outcome-copy';
import { Notice, Page } from '@/components/page';
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
import { colors } from '@/theme/colors';

function firstParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/**
 * Guest claim + login-return (C-I). Token never logged; answers cleared on switch.
 * No fixture production fallback.
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
      setNotice('Form đã xuất bản không khả dụng. Không dùng dữ liệu mẫu.');
    })();
    return () => {
      cancelled = true;
    };
  }, [activeScope.tenantSlug, activeScope.eventSlug]);

  const loginHint = needsLogin
    ? 'Đăng nhập bằng email đã được mời, rồi quay lại đây.'
    : null;

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
      <Notice title="Nhận vé mời">
        Chỉ email đã được mời và xác minh. Sau đăng nhập quay lại đây để hoàn tất;
        dữ liệu tạm xoá khi đăng xuất hoặc đổi tài khoản.
      </Notice>
      {loginHint ? <Notice title="Cần đăng nhập">{loginHint}</Notice> : null}
      {notice ? <Notice title="Trạng thái">{notice}</Notice> : null}
      {needsLogin ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đến tài khoản để đăng nhập"
          onPress={() => router.push('/my-tickets')}
          style={button}
        >
          <Text style={buttonLabel}>Đăng nhập để nhận vé</Text>
        </Pressable>
      ) : null}
      <RedeemFormFields
        form={form}
        termsVersion={termsVersion}
        termsBody={termsBody}
        answers={answers}
        termsAccepted={termsAccepted}
        disabled={busy || needsLogin}
        fieldErrors={fieldErrors}
        onChangeAnswer={(fieldId, value) =>
          setAnswers((prev) => ({ ...prev, [fieldId]: value }))
        }
        onTermsAcceptedChange={setTermsAccepted}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Gửi nhận vé mời"
        accessibilityState={{ disabled: busy || needsLogin || !activeScope.token }}
        disabled={busy || needsLogin || !activeScope.token}
        onPress={() => void submitClaim()}
        style={button}
      >
        <Text style={buttonLabel}>{busy ? 'Đang xử lý…' : 'Nhận vé mời'}</Text>
      </Pressable>
      {decision ? (
        <View
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
        </View>
      ) : null}
      {decision?.kind === 'pending' ? (
        <Pressable
          {...redeemStatusRefreshAnnouncement()}
          disabled={busy}
          onPress={() => void refreshStatus()}
          style={button}
        >
          <Text style={buttonLabel}>Kiểm tra lại</Text>
        </Pressable>
      ) : null}
    </Page>
  );
}

const button = {
  padding: 14,
  borderRadius: 12,
  backgroundColor: colors.accent,
};

const buttonLabel = {
  color: colors.onAccent,
  fontSize: 17,
  fontWeight: '600' as const,
  textAlign: 'center' as const,
};
