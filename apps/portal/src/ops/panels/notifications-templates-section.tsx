'use client';

import {
  NOTIFICATION_KINDS,
  type NotificationKind,
} from '@ticket/contracts';
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
  Space,
  Typography,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { portalGet, portalMutate } from '../../client/portal-fetch';
import {
  bffEvent,
  bffNotificationTemplatePreview,
  bffNotificationTemplatePublish,
  bffReminderCancel,
  bffReminderPreview,
  bffReminders,
} from '../../prep/bff-urls';
import { usePortalLocale } from '../../i18n';
import { portalFieldMin } from '../../layout/density';
import {
  DEFAULT_TICKET_ISSUED_DRAFT,
  TEMPLATE_VARIABLES_BY_KIND,
  interpretReminderCancel,
  interpretReminderCreate,
  interpretReminderPreview,
  interpretTemplatePreview,
  interpretTemplatePublish,
  isRevisionConflict,
  localDateTimeToUtcIso,
  reminderCancelLabel,
  reminderCreateFingerprint,
  reminderCreateLabel,
  reminderPreviewLabel,
  resolveNotificationIdempotencyKey,
  templatePreviewLabel,
  templatePublishLabel,
  type ReminderCancelView,
  type ReminderCreateView,
  type ReminderPreviewView,
  type TemplatePreviewView,
  type TemplatePublishView,
} from '../notifications';

type Props = {
  tenantId: string;
  eventId: string;
  canNotify: boolean;
  busy: boolean;
  onBusy: (busy: boolean) => void;
};

type UnclearAttempt = { key: string; fingerprint: string; unclear: boolean };

const SAMPLE_DEFAULTS: Record<string, string> = {
  eventName: 'Demo Event',
  ticketId: 'ticket-sample',
  ticketLink: 'https://example.invalid/tickets/sample',
  guideText: 'Mang CCCD khi vào.',
  contactText: 'hotline@example.invalid',
};

export function NotificationsTemplatesSection({
  tenantId,
  eventId,
  canNotify,
  busy,
  onBusy,
}: Props) {
  const { t, locale } = usePortalLocale();
  const [eventRevision, setEventRevision] = useState<number | null>(null);
  const [revisionLoadError, setRevisionLoadError] = useState(false);
  const [kind, setKind] = useState<NotificationKind>('TicketIssued');
  const [subject, setSubject] = useState(DEFAULT_TICKET_ISSUED_DRAFT.subject);
  const [bodyText, setBodyText] = useState(DEFAULT_TICKET_ISSUED_DRAFT.bodyText);
  const [bodyHtml, setBodyHtml] = useState(DEFAULT_TICKET_ISSUED_DRAFT.bodyHtml);
  const [previewView, setPreviewView] = useState<TemplatePreviewView | null>(
    null,
  );
  const [publishView, setPublishView] = useState<TemplatePublishView | null>(
    null,
  );
  const [localSchedule, setLocalSchedule] = useState('');
  const [reminderPreview, setReminderPreview] =
    useState<ReminderPreviewView | null>(null);
  const [reminderCreate, setReminderCreate] =
    useState<ReminderCreateView | null>(null);
  const [reminderCancel, setReminderCancel] =
    useState<ReminderCancelView | null>(null);
  const [cancelReminderId, setCancelReminderId] = useState('');
  const [createAttempt, setCreateAttempt] = useState<UnclearAttempt | null>(
    null,
  );
  const [publishAttempt, setPublishAttempt] = useState<UnclearAttempt | null>(
    null,
  );
  const [cancelAttempt, setCancelAttempt] = useState<UnclearAttempt | null>(
    null,
  );

  const loadRevision = useCallback(async () => {
    const result = await portalGet(bffEvent(tenantId, eventId));
    if (
      result.status === 200 &&
      result.json &&
      typeof result.json === 'object' &&
      typeof (result.json as { revision?: unknown }).revision === 'number'
    ) {
      setEventRevision((result.json as { revision: number }).revision);
      setRevisionLoadError(false);
    } else {
      setEventRevision(null);
      setRevisionLoadError(true);
    }
  }, [tenantId, eventId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadRevision();
    });
    return () => {
      cancelled = true;
    };
  }, [loadRevision]);

  function sampleVariables(): Record<string, string> {
    const allowed = TEMPLATE_VARIABLES_BY_KIND[kind] ?? [];
    const out: Record<string, string> = {};
    for (const name of allowed) {
      out[name] = SAMPLE_DEFAULTS[name] ?? `[${name}]`;
    }
    return out;
  }

  async function runPreview() {
    if (!canNotify) return;
    onBusy(true);
    setPreviewView(null);
    const result = await portalMutate(
      bffNotificationTemplatePreview(tenantId, eventId),
      {
        kind,
        subject,
        bodyText,
        bodyHtml,
        sampleVariables: sampleVariables(),
      },
    );
    setPreviewView(
      interpretTemplatePreview(
        result.status,
        result.json,
        result.networkError || result.timedOut,
        locale,
      ),
    );
    onBusy(false);
  }

  function confirmPublish() {
    if (!canNotify) return;
    Modal.confirm({
      title: t('ops.notifications.publishConfirmTitle'),
      content: t('ops.notifications.publishConfirmBody', { kind }),
      okText: t('ops.notifications.publishConfirmOk'),
      cancelText: t('views.save.cancel'),
      onOk: () => runPublish(),
    });
  }

  async function runPublish() {
    onBusy(true);
    setPublishView(null);
    const fingerprint = [
      'template.publish',
      tenantId,
      eventId,
      kind,
      subject,
      bodyText,
      bodyHtml,
    ].join('|');
    const { key } = resolveNotificationIdempotencyKey(
      publishAttempt,
      fingerprint,
      () => crypto.randomUUID(),
    );
    const result = await portalMutate(
      bffNotificationTemplatePublish(tenantId, eventId),
      {
        kind,
        subject,
        bodyText,
        bodyHtml,
        idempotencyKey: key,
      },
    );
    const view = interpretTemplatePublish(
      result.status,
      result.json,
      result.networkError || result.timedOut,
      locale,
    );
    setPublishView(view);
    setPublishAttempt({
      key,
      fingerprint,
      unclear: view.kind === 'unknown',
    });
    onBusy(false);
  }

  function scheduledAtUtc(): string | null {
    return localDateTimeToUtcIso(localSchedule);
  }

  async function runReminderPreview() {
    if (!canNotify) return;
    onBusy(true);
    setReminderPreview(null);
    const scheduledAt = scheduledAtUtc();
    if (eventRevision === null || scheduledAt === null) {
      setReminderPreview({
        kind: 'rejected',
        code: 'INVALID_INPUT',
        message: t(
          eventRevision === null
            ? 'ops.notifications.needRevision'
            : 'ops.notifications.invalidSchedule',
        ),
      });
      onBusy(false);
      return;
    }
    const result = await portalMutate(bffReminderPreview(tenantId, eventId), {
      expectedEventRevision: eventRevision,
      scheduledAt,
    });
    setReminderPreview(
      interpretReminderPreview(
        result.status,
        result.json,
        result.networkError || result.timedOut,
        locale,
      ),
    );
    onBusy(false);
  }

  async function runReminderCreate() {
    onBusy(true);
    setReminderCreate(null);
    const scheduledAt = scheduledAtUtc();
    if (eventRevision === null || scheduledAt === null) {
      setReminderCreate({
        kind: 'rejected',
        code: 'INVALID_INPUT',
        message: t(
          eventRevision === null
            ? 'ops.notifications.needRevision'
            : 'ops.notifications.invalidSchedule',
        ),
      });
      onBusy(false);
      return;
    }
    const fingerprint = reminderCreateFingerprint({
      tenantId,
      eventId,
      expectedEventRevision: eventRevision,
      scheduledAt,
    });
    const { key } = resolveNotificationIdempotencyKey(
      createAttempt,
      fingerprint,
      () => crypto.randomUUID(),
    );
    const result = await portalMutate(bffReminders(tenantId, eventId), {
      expectedEventRevision: eventRevision,
      scheduledAt,
      kind: 'EventReminder',
      audience: 'TICKET_OWNERS',
      idempotencyKey: key,
    });
    const view = interpretReminderCreate(
      result.status,
      result.json,
      result.networkError || result.timedOut,
      locale,
    );
    setReminderCreate(view);
    setCreateAttempt({
      key,
      fingerprint,
      unclear: view.kind === 'unknown',
    });
    if (view.kind === 'created') {
      setCancelReminderId(view.reminder.reminderId);
    }
    onBusy(false);
  }

  function confirmCancel() {
    if (!canNotify || !cancelReminderId.trim()) return;
    Modal.confirm({
      title: t('ops.notifications.cancelReminderTitle'),
      content: t('ops.notifications.cancelReminderBody'),
      okText: t('ops.notifications.cancelReminderOk'),
      cancelText: t('views.save.cancel'),
      okButtonProps: { danger: true },
      onOk: () => runReminderCancel(),
    });
  }

  async function runReminderCancel() {
    onBusy(true);
    setReminderCancel(null);
    const rid = cancelReminderId.trim();
    const fingerprint = ['reminder.cancel', tenantId, eventId, rid].join('|');
    const { key } = resolveNotificationIdempotencyKey(
      cancelAttempt,
      fingerprint,
      () => crypto.randomUUID(),
    );
    const result = await portalMutate(
      bffReminderCancel(tenantId, eventId, rid),
      { idempotencyKey: key },
    );
    const view = interpretReminderCancel(
      result.status,
      result.json,
      result.networkError || result.timedOut,
      locale,
    );
    setReminderCancel(view);
    setCancelAttempt({
      key,
      fingerprint,
      unclear: view.kind === 'unknown',
    });
    onBusy(false);
  }

  const allowVars = (TEMPLATE_VARIABLES_BY_KIND[kind] ?? []).join(', ');

  return (
    <Space
      id="portal-cn-notify-section"
      direction="vertical"
      size="large"
      style={{ width: '100%' }}
    >
      <Alert
        type="info"
        showIcon
        message={t('ops.notifications.templateSectionTitle')}
        description={
          eventRevision !== null
            ? t('ops.notifications.templateSectionHint', {
                revision: eventRevision,
              })
            : revisionLoadError
              ? t('ops.notifications.needRevision')
              : t('ops.notifications.revisionLoading')
        }
      />
      <Typography.Title level={5} id="portal-template-editor">
        {t('ops.notifications.templateEditorTitle')}
      </Typography.Title>
      <Select
        className={portalFieldMin.w220}
        value={kind}
        disabled={busy || !canNotify}
        options={NOTIFICATION_KINDS.map((k: NotificationKind) => ({
          value: k,
          label: k,
        }))}
        onChange={(v) => setKind(v)}
        aria-label={t('ops.notifications.templateEditorTitle')}
        aria-describedby="portal-template-vars-hint"
      />
      <Typography.Text id="portal-template-vars-hint">
        {t('ops.notifications.allowlistedVars', { vars: allowVars })}
      </Typography.Text>
      <Input
        value={subject}
        disabled={busy || !canNotify}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        aria-label={t('ops.notifications.templateSubjectAria')}
      />
      <Input.TextArea
        value={bodyText}
        disabled={busy || !canNotify}
        onChange={(e) => setBodyText(e.target.value)}
        rows={5}
        aria-label={t('ops.notifications.templateBodyTextAria')}
      />
      <Input.TextArea
        value={bodyHtml}
        disabled={busy || !canNotify}
        onChange={(e) => setBodyHtml(e.target.value)}
        rows={4}
        aria-label={t('ops.notifications.templateBodyHtmlAria')}
      />
      <Space wrap>
        <Button
          disabled={busy || !canNotify}
          onClick={() => void runPreview()}
          data-testid="portal-template-preview"
        >
          {t('ops.notifications.previewTemplate')}
        </Button>
        <Button
          type="primary"
          disabled={busy || !canNotify}
          onClick={() => confirmPublish()}
          data-testid="portal-template-publish"
        >
          {t('ops.notifications.publishTemplateAction')}
        </Button>
      </Space>
      {previewView ? (
        <Alert
          type={previewView.kind === 'preview' ? 'success' : 'warning'}
          showIcon
          message={templatePreviewLabel(previewView, locale)}
          description={
            previewView.kind === 'preview'
              ? previewView.bodyText.slice(0, 500)
              : undefined
          }
          role="status"
          data-testid="portal-template-preview-result"
        />
      ) : null}
      {publishView ? (
        <Alert
          type={
            publishView.kind === 'published'
              ? 'success'
              : publishView.kind === 'rejected'
                ? 'error'
                : 'warning'
          }
          showIcon
          message={templatePublishLabel(publishView, locale)}
          role="status"
          data-testid="portal-template-publish-result"
        />
      ) : null}

      <Typography.Title level={5} id="portal-reminder-editor">
        {t('ops.notifications.reminderSectionTitle')}
      </Typography.Title>
      <Input
        type="datetime-local"
        value={localSchedule}
        disabled={busy || !canNotify}
        onChange={(e) => setLocalSchedule(e.target.value)}
        aria-label={t('ops.notifications.reminderScheduleLabel')}
      />
      <Space wrap>
        <Button
          disabled={busy || !canNotify}
          onClick={() => void runReminderPreview()}
          data-testid="portal-reminder-preview"
        >
          {t('ops.notifications.previewReminderAction')}
        </Button>
        <Button
          type="primary"
          disabled={busy || !canNotify || eventRevision === null}
          onClick={() => void runReminderCreate()}
          data-testid="portal-reminder-create"
        >
          {t('ops.notifications.createReminderAction')}
        </Button>
      </Space>
      {reminderPreview ? (
        <Alert
          type={
            reminderPreview.kind === 'preview'
              ? 'success'
              : reminderPreview.kind === 'rejected' &&
                  isRevisionConflict(reminderPreview.code)
                ? 'error'
                : 'warning'
          }
          showIcon
          message={reminderPreviewLabel(reminderPreview, locale)}
          role="status"
          data-testid="portal-reminder-preview-result"
        />
      ) : null}
      {reminderCreate ? (
        <Alert
          type={
            reminderCreate.kind === 'created'
              ? 'success'
              : reminderCreate.kind === 'unknown'
                ? 'warning'
                : 'error'
          }
          showIcon
          message={reminderCreateLabel(reminderCreate, locale)}
          role="status"
          data-testid="portal-reminder-create-result"
        />
      ) : null}
      <Input
        value={cancelReminderId}
        disabled={busy || !canNotify}
        onChange={(e) => setCancelReminderId(e.target.value)}
        placeholder={t('ops.notifications.cancelReminderIdPlaceholder')}
        aria-label={t('ops.notifications.cancelReminderIdPlaceholder')}
      />
      <Button
        danger
        disabled={busy || !canNotify || !cancelReminderId.trim()}
        onClick={() => confirmCancel()}
        data-testid="portal-reminder-cancel"
      >
        {t('ops.notifications.cancelReminderAction')}
      </Button>
      {reminderCancel ? (
        <Alert
          type={reminderCancel.kind === 'cancelled' ? 'success' : 'warning'}
          showIcon
          message={reminderCancelLabel(reminderCancel, locale)}
          role="status"
          data-testid="portal-reminder-cancel-result"
        />
      ) : null}
    </Space>
  );
}
