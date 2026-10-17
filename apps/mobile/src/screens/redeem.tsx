import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  redeemActionAnnouncement,
  redeemDecisionAnnouncement,
  redeemReconcileAnnouncement,
  redeemStatusRefreshAnnouncement,
} from '@/a11y/announcements';
import { presentRedeemDecision } from '@/attendee/attendee-outcome-copy';
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
        'Tuỳ chọn: nhập slug tổ chức/sự kiện để tải biểu mẫu và điều khoản đã xuất bản.',
      );
      return;
    }
    setSchemaNotice('Đang tải biểu mẫu đã xuất bản…');
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

  const outcome = presentRedeemDecision(decision, { surface: 'redeem' });
  const outcomeDetail = outcome.secondary
    ? `${outcome.detail}\n${outcome.secondary}`
    : outcome.detail;

  return (
    <Page>
      <Notice title="Đổi mã lấy vé">
        Nhập mã, trả lời biểu mẫu và đồng ý điều khoản. Chờ duyệt chưa phải vé.
        Mất phản hồi thì giữ «chưa rõ» đến khi kiểm tra lại cùng lần thử.
      </Notice>
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
        <Text style={buttonLabel}>{busy ? 'Đang xử lý…' : 'Đổi mã'}</Text>
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
      {statusNote ? <Notice title="Trạng thái">{statusNote}</Notice> : null}
      {decision?.kind === 'pending' ? (
        <Pressable
          {...redeemStatusRefreshAnnouncement()}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void refreshStatus()}
          style={button}
        >
          <Text style={buttonLabel}>Kiểm tra lại</Text>
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
          <Text style={buttonLabel}>Kiểm tra lại cùng lần thử</Text>
        </Pressable>
      ) : null}
      {decision?.kind === 'stale' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tải lại biểu mẫu và điều khoản"
          disabled={busy}
          onPress={() => void loadPublishedSchema()}
          style={buttonSecondary}
        >
          <Text style={buttonSecondaryLabel}>Tải lại biểu mẫu</Text>
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
  color: colors.onAccent,
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
