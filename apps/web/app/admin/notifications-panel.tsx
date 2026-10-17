'use client';

import { useState } from 'react';
import {
  NOTIFICATION_KINDS,
  type NotificationKind,
} from '@ticket/contracts';
import { adminGet, adminMutate } from '../../src/admin/client-fetch';
import {
  DEFAULT_TICKET_ISSUED_DRAFT,
  TEMPLATE_VARIABLES_BY_KIND,
  interpretNotificationList,
  interpretNotificationRetry,
  interpretReminderCancel,
  interpretReminderCreate,
  interpretReminderPreview,
  interpretTemplatePreview,
  interpretTemplatePublish,
  isRevisionConflict,
  localDateTimeToUtcIso,
  notificationListLabel,
  notificationRetryLabel,
  providerStatusLabel,
  reminderCancelLabel,
  reminderCreateFingerprint,
  reminderCreateLabel,
  reminderPreviewLabel,
  resolveNotificationIdempotencyKey,
  templatePreviewLabel,
  templatePublishLabel,
  type NotificationListView,
  type NotificationRetryView,
  type ReminderCancelView,
  type ReminderCreateView,
  type ReminderPreviewView,
  type TemplatePreviewView,
  type TemplatePublishView,
} from '../../src/admin/notifications';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';

type Props = {
  tenantId: string;
  eventId: string;
  /** Current event revision from detail load — required for reminder create. */
  eventRevision: number | null;
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

export function NotificationsPanel({
  tenantId,
  eventId,
  eventRevision,
  busy,
  onBusy,
}: Props) {
  const scopeReady = Boolean(tenantId.trim() && eventId.trim());
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
  const [listView, setListView] = useState<NotificationListView | null>(null);
  const [retryView, setRetryView] = useState<NotificationRetryView | null>(
    null,
  );
  const [retryTarget, setRetryTarget] = useState('');
  const [retryReason, setRetryReason] = useState(
    'Staff retry after FAILED/DEAD — audited',
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
  const [retryAttempt, setRetryAttempt] = useState<UnclearAttempt | null>(null);
  const [cancelAttempt, setCancelAttempt] = useState<UnclearAttempt | null>(
    null,
  );

  if (!scopeReady) {
    return (
      <section aria-labelledby="notifications-heading" className="redeem-form">
        <h2 id="notifications-heading">Thông báo &amp; nhắc (C-N)</h2>
        <p className="intro">
          Chọn tenant + event trước khi preview template / tạo nhắc giao dịch.
        </p>
      </section>
    );
  }

  function sampleVariables(): Record<string, string> {
    const allowed = TEMPLATE_VARIABLES_BY_KIND[kind];
    const out: Record<string, string> = {};
    for (const name of allowed) {
      out[name] = SAMPLE_DEFAULTS[name] ?? `[${name}]`;
    }
    return out;
  }

  async function runPreview() {
    onBusy(true);
    setPreviewView(null);
    const result = await adminMutate(
      '/api/bff/admin/notification-templates/preview',
      {
        tenantId: tenantId.trim(),
        eventId: eventId.trim(),
        kind,
        subject,
        bodyText,
        bodyHtml,
        sampleVariables: sampleVariables(),
      },
      REQUEST_TIMEOUT_MS,
    );
    setPreviewView(
      interpretTemplatePreview(
        result.status,
        result.json,
        result.networkError || result.timedOut,
      ),
    );
    onBusy(false);
  }

  async function runPublish() {
    onBusy(true);
    setPublishView(null);
    const fingerprint = [
      'template.publish',
      tenantId.trim(),
      eventId.trim(),
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
    const result = await adminMutate(
      '/api/bff/admin/notification-templates/publish',
      {
        tenantId: tenantId.trim(),
        eventId: eventId.trim(),
        kind,
        subject,
        bodyText,
        bodyHtml,
        idempotencyKey: key,
      },
      REQUEST_TIMEOUT_MS,
    );
    const view = interpretTemplatePublish(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setPublishView(view);
    setPublishAttempt({
      key,
      fingerprint,
      unclear: view.kind === 'unknown',
    });
    onBusy(false);
  }

  async function loadNotifications() {
    onBusy(true);
    setListView(null);
    const params = new URLSearchParams({
      tenantId: tenantId.trim(),
      eventId: eventId.trim(),
    });
    const result = await adminGet(
      `/api/bff/admin/notifications?${params.toString()}`,
      REQUEST_TIMEOUT_MS,
    );
    setListView(
      interpretNotificationList(
        result.status,
        result.json,
        result.networkError || result.timedOut,
      ),
    );
    onBusy(false);
  }

  async function runRetry() {
    onBusy(true);
    setRetryView(null);
    const nid = retryTarget.trim();
    const fingerprint = [
      'notification.retry',
      tenantId.trim(),
      eventId.trim(),
      nid,
      retryReason.trim(),
    ].join('|');
    const { key } = resolveNotificationIdempotencyKey(
      retryAttempt,
      fingerprint,
      () => crypto.randomUUID(),
    );
    const result = await adminMutate(
      `/api/bff/admin/notifications/${encodeURIComponent(nid)}/retry`,
      {
        tenantId: tenantId.trim(),
        eventId: eventId.trim(),
        reason: retryReason.trim(),
        idempotencyKey: key,
      },
      REQUEST_TIMEOUT_MS,
    );
    const view = interpretNotificationRetry(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setRetryView(view);
    setRetryAttempt({
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
    onBusy(true);
    setReminderPreview(null);
    const scheduledAt = scheduledAtUtc();
    if (eventRevision === null || scheduledAt === null) {
      setReminderPreview({
        kind: 'rejected',
        code: 'INVALID_INPUT',
        message:
          eventRevision === null
            ? 'Tải chi tiết event để lấy revision trước khi preview nhắc.'
            : 'Thời gian local không hợp lệ — dùng datetime-local.',
      });
      onBusy(false);
      return;
    }
    const result = await adminMutate(
      '/api/bff/admin/reminders/preview',
      {
        tenantId: tenantId.trim(),
        eventId: eventId.trim(),
        expectedEventRevision: eventRevision,
        scheduledAt,
      },
      REQUEST_TIMEOUT_MS,
    );
    setReminderPreview(
      interpretReminderPreview(
        result.status,
        result.json,
        result.networkError || result.timedOut,
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
        message:
          eventRevision === null
            ? 'Cần event revision hiện tại.'
            : 'scheduledAt UTC không hợp lệ.',
      });
      onBusy(false);
      return;
    }
    const fingerprint = reminderCreateFingerprint({
      tenantId: tenantId.trim(),
      eventId: eventId.trim(),
      expectedEventRevision: eventRevision,
      scheduledAt,
    });
    const { key } = resolveNotificationIdempotencyKey(
      createAttempt,
      fingerprint,
      () => crypto.randomUUID(),
    );
    const result = await adminMutate(
      '/api/bff/admin/reminders',
      {
        tenantId: tenantId.trim(),
        eventId: eventId.trim(),
        expectedEventRevision: eventRevision,
        scheduledAt,
        kind: 'EventReminder',
        audience: 'TICKET_OWNERS',
        idempotencyKey: key,
      },
      REQUEST_TIMEOUT_MS,
    );
    const view = interpretReminderCreate(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setReminderCreate(view);
    // Unknown → reuse key; success/reject → clear unclear so next create is fresh.
    setCreateAttempt({
      key,
      fingerprint,
      unclear: view.kind === 'unknown',
    });
    onBusy(false);
  }

  async function runReminderCancel() {
    onBusy(true);
    setReminderCancel(null);
    const rid = cancelReminderId.trim();
    const fingerprint = [
      'reminder.cancel',
      tenantId.trim(),
      eventId.trim(),
      rid,
    ].join('|');
    const { key } = resolveNotificationIdempotencyKey(
      cancelAttempt,
      fingerprint,
      () => crypto.randomUUID(),
    );
    const result = await adminMutate(
      `/api/bff/admin/reminders/${encodeURIComponent(rid)}/cancel`,
      {
        tenantId: tenantId.trim(),
        eventId: eventId.trim(),
        idempotencyKey: key,
      },
      REQUEST_TIMEOUT_MS,
    );
    const view = interpretReminderCancel(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setReminderCancel(view);
    setCancelAttempt({
      key,
      fingerprint,
      unclear: view.kind === 'unknown',
    });
    onBusy(false);
  }

  const allowVars = TEMPLATE_VARIABLES_BY_KIND[kind].join(', ');

  return (
    <section aria-labelledby="notifications-heading" className="redeem-form">
      <h2 id="notifications-heading">Thông báo &amp; nhắc giao dịch (C-N)</h2>
      <p>
        Template chỉ literal + biến allowlist. Preview server-escaped.
        ACCEPTED ≠ delivered. Reminder chỉ audience chủ vé — không marketing.
        Permission upstream: <code>event.config</code>.
        {eventRevision !== null ? (
          <>
            {' '}
            Revision hiện tại: <strong>{eventRevision}</strong>.
          </>
        ) : (
          <> Tải chi tiết event để lấy revision trước khi tạo nhắc.</>
        )}
      </p>

      <h3 id="template-editor-heading">Template email</h3>
      <label htmlFor="notif-kind">
        Kind
        <select
          id="notif-kind"
          value={kind}
          disabled={busy}
          onChange={(e) => setKind(e.target.value as NotificationKind)}
          aria-describedby="notif-kind-hint"
        >
          {NOTIFICATION_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <p id="notif-kind-hint" className="intro">
        Biến allowlist: {allowVars}
      </p>
      <label htmlFor="notif-subject">
        Subject
        <input
          id="notif-subject"
          value={subject}
          disabled={busy}
          onChange={(e) => setSubject(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label htmlFor="notif-body-text">
        Body (text)
        <textarea
          id="notif-body-text"
          value={bodyText}
          disabled={busy}
          onChange={(e) => setBodyText(e.target.value)}
          rows={6}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <label htmlFor="notif-body-html">
        Body (HTML escaped vars)
        <textarea
          id="notif-body-html"
          value={bodyHtml}
          disabled={busy}
          onChange={(e) => setBodyHtml(e.target.value)}
          rows={5}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runPreview()}
        >
          Preview template
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runPublish()}
        >
          Publish template
        </button>
      </div>
      {previewView ? (
        <div data-testid="template-preview-result" role="status">
          <p>{templatePreviewLabel(previewView)}</p>
          {previewView.kind === 'preview' ? (
            <pre className="me-result" aria-label="Escaped preview body">
              {`Subject: ${previewView.subject}\n\n${previewView.bodyText}`}
            </pre>
          ) : null}
        </div>
      ) : null}
      {publishView ? (
        <p
          data-testid="template-publish-result"
          role="status"
          className={
            publishView.kind === 'rejected' || publishView.kind === 'unknown'
              ? 'error'
              : undefined
          }
        >
          {templatePublishLabel(publishView)}
        </p>
      ) : null}

      <h3 id="notif-list-heading">Attempts / trạng thái</h3>
      <p>
        PENDING / ACCEPTED / FAILED / DEAD / UNKNOWN. Không hiển thị raw
        token/PII. ACCEPTED không được gắn nhãn &quot;đã giao&quot;.
      </p>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadNotifications()}
        >
          Tải danh sách thông báo
        </button>
      </div>
      {listView ? (
        <div data-testid="notification-list-result" role="status">
          <p>{notificationListLabel(listView)}</p>
          {listView.kind === 'list' ? (
            <ul aria-labelledby="notif-list-heading">
              {listView.items.map((item) => (
                <li key={item.notificationId}>
                  <code>{item.notificationId}</code> · {item.kind} ·{' '}
                  {item.channel} · {providerStatusLabel(item.providerStatus)} ·
                  attempts={item.attempts}
                  {item.nextAttemptAt
                    ? ` · next=${item.nextAttemptAt}`
                    : ''}
                </li>
              ))}
            </ul>
          ) : null}
          {listView.kind === 'rejected' &&
          listView.code === 'PERMISSION_DENIED' ? (
            <p data-testid="notification-permission-denied">
              Thiếu quyền event.config — không liệt kê được thông báo
              cross-tenant/event khác.
            </p>
          ) : null}
        </div>
      ) : null}

      <h3 id="notif-retry-heading">Retry có lý do (audit)</h3>
      <label htmlFor="notif-retry-id">
        Notification ID
        <input
          id="notif-retry-id"
          value={retryTarget}
          disabled={busy}
          onChange={(e) => setRetryTarget(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label htmlFor="notif-retry-reason">
        Reason
        <input
          id="notif-retry-reason"
          value={retryReason}
          disabled={busy}
          onChange={(e) => setRetryReason(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || !retryTarget.trim() || !retryReason.trim()}
        onClick={() => void runRetry()}
      >
        Retry (PENDING — ≠ delivered)
      </button>
      {retryView ? (
        <p data-testid="notification-retry-result" role="status">
          {notificationRetryLabel(retryView)}
        </p>
      ) : null}

      <h3 id="reminder-heading">Nhắc giao dịch (EventReminder)</h3>
      <p>
        Local datetime → UTC ISO trước khi gửi. Preview chỉ{' '}
        <code>recipientCount</code> (không danh sách email). Stale revision →
        conflict. Unknown không tạo lịch trùng (giữ Idempotency-Key).
      </p>
      <label htmlFor="reminder-local">
        Lịch nhắc (local browser)
        <input
          id="reminder-local"
          type="datetime-local"
          value={localSchedule}
          disabled={busy}
          onChange={(e) => setLocalSchedule(e.target.value)}
        />
      </label>
      <div className="auth-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runReminderPreview()}
        >
          Preview nhắc
        </button>
        <button
          type="button"
          disabled={busy || eventRevision === null}
          onClick={() => void runReminderCreate()}
        >
          Tạo nhắc
        </button>
      </div>
      {reminderPreview ? (
        <p
          data-testid="reminder-preview-result"
          role="status"
          className={
            reminderPreview.kind === 'rejected' &&
            isRevisionConflict(reminderPreview.code)
              ? 'error'
              : undefined
          }
        >
          {reminderPreviewLabel(reminderPreview)}
          {reminderPreview.kind === 'rejected' &&
          isRevisionConflict(reminderPreview.code)
            ? ' — tải lại event revision rồi preview lại.'
            : ''}
        </p>
      ) : null}
      {reminderCreate ? (
        <p
          data-testid="reminder-create-result"
          role="status"
          className={
            reminderCreate.kind === 'unknown' ? 'error' : undefined
          }
        >
          {reminderCreateLabel(reminderCreate)}
          {reminderCreate.kind === 'unknown'
            ? ' — giữ cùng Idempotency-Key; không tạo lịch trùng.'
            : ''}
        </p>
      ) : null}

      <label htmlFor="reminder-cancel-id">
        Reminder ID (huỷ)
        <input
          id="reminder-cancel-id"
          value={cancelReminderId}
          disabled={busy}
          onChange={(e) => setCancelReminderId(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <button
        type="button"
        disabled={busy || !cancelReminderId.trim()}
        onClick={() => void runReminderCancel()}
      >
        Huỷ nhắc
      </button>
      {reminderCancel ? (
        <p data-testid="reminder-cancel-result" role="status">
          {reminderCancelLabel(reminderCancel)}
        </p>
      ) : null}
    </section>
  );
}
