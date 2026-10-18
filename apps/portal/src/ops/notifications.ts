/**
 * C-N web client — template preview/publish, reminders, notification list/retry.
 * ACCEPTED ≠ delivered. No raw PII/tokens in parsed views. Unknown ≠ success.
 */

import {
  NOTIFICATION_ERROR_CODES,
  NOTIFICATION_KINDS,
  NOTIFICATION_REMINDER_CANCEL_COMMAND,
  NOTIFICATION_REMINDER_CREATE_COMMAND,
  NOTIFICATION_RETRY_COMMAND,
  NOTIFICATION_TEMPLATE_PUBLISH_COMMAND,
  type NotificationChannel,
  type NotificationKind,
  type NotificationProviderStatus,
  type NotificationSummary,
  type NotificationTemplatePreviewResponse,
  type ReminderPreviewResponse,
  type ReminderSummary,
} from '@ticket/contracts';
import type { AdminScope } from './scope';
import { eventPath } from './scope';
import {
  apiErrorFrom,
  asRecord,
  isNonEmptyString,
  optionalString,
} from './contract-shape';

/** Allowlisted template variables — mirrors BE KIND_VARIABLES (server validates). */
export const TEMPLATE_VARIABLES_BY_KIND: Record<
  NotificationKind,
  readonly string[]
> = {
  TicketIssued: [
    'eventName',
    'ticketId',
    'ticketLink',
    'guideText',
    'contactText',
  ],
  InvitationReady: ['eventName', 'ticketLink', 'guideText', 'contactText'],
  EventChanged: ['eventName', 'guideText', 'contactText'],
  EventCancelled: ['eventName', 'contactText'],
  EventReminder: ['eventName', 'ticketLink', 'guideText', 'contactText'],
};

export const DEFAULT_TICKET_ISSUED_DRAFT = {
  kind: 'TicketIssued' as const,
  subject: 'Vé đã cấp — {{eventName}}',
  bodyText: [
    'Vé {{ticketId}} đã được cấp cho sự kiện {{eventName}}.',
    '',
    'Xem vé (đăng nhập bắt buộc): {{ticketLink}}',
    '',
    'Hướng dẫn:',
    '{{guideText}}',
    '',
    'Liên hệ:',
    '{{contactText}}',
  ].join('\n'),
  bodyHtml: [
    '<p>Vé <strong>{{ticketId}}</strong> đã được cấp cho sự kiện <strong>{{eventName}}</strong>.</p>',
    '<p><a href="{{ticketLink}}">Xem vé</a> (đăng nhập bắt buộc)</p>',
    '<h2>Hướng dẫn</h2><p>{{guideText}}</p>',
    '<h2>Liên hệ</h2><p>{{contactText}}</p>',
  ].join(''),
};

export const NOTIFICATION_UNKNOWN =
  'Kết quả thông báo chưa biết. Không coi là đã gửi, đã lên lịch, hoặc đã huỷ.';

const PII_KEYS = [
  'email',
  'ownerEmail',
  'rawEmail',
  'token',
  'accessToken',
  'bearer',
  'qr',
  'qrPayload',
  'credential',
  'plaintext',
  'password',
] as const;

/** G-N1 — optional state/channel; omit keeps legacy list behavior. */
export function notificationsListUpstreamPath(
  scope: AdminScope,
  query?: {
    cursor?: string | null;
    limit?: number;
    state?: NotificationProviderStatus;
    channel?: NotificationChannel;
  },
): string {
  const base = eventPath(scope, 'notifications');
  const params = new URLSearchParams();
  if (query?.cursor?.trim()) params.set('cursor', query.cursor.trim());
  if (query?.limit !== undefined) params.set('limit', String(query.limit));
  if (query?.state) params.set('state', query.state);
  if (query?.channel) params.set('channel', query.channel);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function notificationRetryUpstreamPath(
  scope: AdminScope,
  notificationId: string,
): string {
  return eventPath(
    scope,
    `notifications/${encodeURIComponent(notificationId)}/retry`,
  );
}

export function templatePreviewUpstreamPath(scope: AdminScope): string {
  return eventPath(scope, 'notification-templates/preview');
}

export function templatePublishUpstreamPath(scope: AdminScope): string {
  return eventPath(scope, 'notification-templates/publish');
}

export function reminderPreviewUpstreamPath(scope: AdminScope): string {
  return eventPath(scope, 'reminders/preview');
}

export function reminderCreateUpstreamPath(scope: AdminScope): string {
  return eventPath(scope, 'reminders');
}

export function reminderCancelUpstreamPath(
  scope: AdminScope,
  reminderId: string,
): string {
  return eventPath(
    scope,
    `reminders/${encodeURIComponent(reminderId)}/cancel`,
  );
}

export function notificationEndpointTemplates() {
  return {
    list: 'GET /api/bff/admin/notifications',
    retry: 'POST /api/bff/admin/notifications/:notificationId/retry',
    templatePreview: 'POST /api/bff/admin/notification-templates/preview',
    templatePublish: 'POST /api/bff/admin/notification-templates/publish',
    reminderPreview: 'POST /api/bff/admin/reminders/preview',
    reminderCreate: 'POST /api/bff/admin/reminders',
    reminderCancel: 'POST /api/bff/admin/reminders/:reminderId/cancel',
  } as const;
}

export function notificationCommands() {
  return {
    templatePublish: NOTIFICATION_TEMPLATE_PUBLISH_COMMAND,
    reminderCreate: NOTIFICATION_REMINDER_CREATE_COMMAND,
    reminderCancel: NOTIFICATION_REMINDER_CANCEL_COMMAND,
    retry: NOTIFICATION_RETRY_COMMAND,
  } as const;
}

export function isNotificationKind(value: unknown): value is NotificationKind {
  return (
    typeof value === 'string' &&
    (NOTIFICATION_KINDS as readonly string[]).includes(value)
  );
}

export function isProviderStatusFull(
  value: unknown,
): value is NotificationProviderStatus {
  return (
    value === 'PENDING' ||
    value === 'ACCEPTED' ||
    value === 'FAILED' ||
    value === 'DEAD' ||
    value === 'UNKNOWN'
  );
}

export function isNotificationChannel(
  value: unknown,
): value is NotificationChannel {
  return value === 'email' || value === 'push';
}

/** Honest status label — never maps ACCEPTED to "đã giao / delivered". */
export function providerStatusLabel(
  status: NotificationProviderStatus,
): string {
  switch (status) {
    case 'PENDING':
      return 'PENDING (chờ gửi)';
    case 'ACCEPTED':
      return 'ACCEPTED (nhà cung cấp nhận — ≠ đã giao tới người nhận)';
    case 'FAILED':
      return 'FAILED';
    case 'DEAD':
      return 'DEAD (hết retry)';
    case 'UNKNOWN':
      return 'UNKNOWN (timeout/không rõ — không khẳng định đã gửi)';
    default:
      return String(status);
  }
}

/**
 * Convert local datetime-local value + IANA timezone offset minutes
 * (from Date getTimezoneOffset of that local instant) to UTC ISO-8601.
 * Browser `datetime-local` has no zone — we treat the string as local wall time.
 */
export function localDateTimeToUtcIso(localValue: string): string | null {
  const trimmed = localValue.trim();
  if (!trimmed) return null;
  // Expect YYYY-MM-DDTHH:mm or with seconds
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(
    trimmed,
  );
  if (!match) return null;
  const datePart = match[1]!;
  const timePart = match[2]!;
  const seconds = match[3] ?? '00';
  const asLocal = new Date(`${datePart}T${timePart}:${seconds}`);
  if (Number.isNaN(asLocal.getTime())) return null;
  return asLocal.toISOString();
}

export function utcIsoToLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function hasForbiddenPii(body: Record<string, unknown>): boolean {
  for (const key of PII_KEYS) {
    if (key in body) return true;
  }
  return false;
}

function parseNotificationSummary(value: unknown): NotificationSummary | null {
  const body = asRecord(value);
  if (!body) return null;
  if (hasForbiddenPii(body)) return null;
  if (
    !isNonEmptyString(body.notificationId) ||
    !isNotificationKind(body.kind) ||
    typeof body.payloadVersion !== 'number' ||
    !Number.isInteger(body.payloadVersion) ||
    !isNotificationChannel(body.channel) ||
    !isProviderStatusFull(body.providerStatus) ||
    typeof body.attempts !== 'number' ||
    !Number.isFinite(body.attempts) ||
    body.attempts < 0
  ) {
    return null;
  }
  if (body.nextAttemptAt !== null && typeof body.nextAttemptAt !== 'string') {
    return null;
  }
  return {
    notificationId: body.notificationId.trim(),
    kind: body.kind,
    payloadVersion: body.payloadVersion,
    channel: body.channel,
    providerStatus: body.providerStatus,
    attempts: body.attempts,
    nextAttemptAt: optionalString(body.nextAttemptAt),
  };
}

export type NotificationListView =
  | {
      kind: 'list';
      items: NotificationSummary[];
      cursor: string | null;
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type TemplatePreviewView =
  | {
      kind: 'preview';
      subject: string;
      bodyText: string;
      bodyHtml: string;
      escaped: true;
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type TemplatePublishView =
  | {
      kind: 'published';
      templateId: string;
      version: number;
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type ReminderPreviewView =
  | {
      kind: 'preview';
      recipientCount: number;
      scheduledAt: string;
      eventRevision: number;
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type ReminderCreateView =
  | {
      kind: 'created';
      reminder: ReminderSummary;
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type ReminderCancelView =
  | {
      kind: 'cancelled';
      reminder: ReminderSummary;
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type NotificationRetryView =
  | {
      kind: 'requeued';
      notificationId: string;
      providerStatus: 'PENDING';
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

function rejectionOrUnknown(
  status: number,
  json: unknown,
  networkError: boolean,
): { kind: 'rejected'; code: string; message: string } | {
  kind: 'unknown';
  message: string;
} {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
}

export function interpretNotificationList(
  status: number,
  json: unknown,
  networkError: boolean,
): NotificationListView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
  }
  const body = asRecord(json);
  if (status === 200 && body && Array.isArray(body.items)) {
    if (!('nextCursor' in body)) {
      return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
    }
    if (body.nextCursor !== null && typeof body.nextCursor !== 'string') {
      return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
    }
    if (hasForbiddenPii(body)) {
      return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
    }
    const items: NotificationSummary[] = [];
    for (const row of body.items) {
      const item = parseNotificationSummary(row);
      if (!item) return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
      items.push(item);
    }
    return { kind: 'list', items, cursor: body.nextCursor };
  }
  return rejectionOrUnknown(status, json, false);
}

export function interpretTemplatePreview(
  status: number,
  json: unknown,
  networkError: boolean,
): TemplatePreviewView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
  }
  const body = asRecord(json);
  if (status === 200 && body) {
    if (hasForbiddenPii(body)) {
      return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
    }
    if (
      isNonEmptyString(body.subject) &&
      isNonEmptyString(body.bodyText) &&
      typeof body.bodyHtml === 'string' &&
      body.escaped === true
    ) {
      const preview: NotificationTemplatePreviewResponse = {
        subject: body.subject,
        bodyText: body.bodyText,
        bodyHtml: body.bodyHtml,
        escaped: true,
      };
      return { kind: 'preview', ...preview };
    }
    return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
  }
  return rejectionOrUnknown(status, json, false);
}

export function interpretTemplatePublish(
  status: number,
  json: unknown,
  networkError: boolean,
): TemplatePublishView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
  }
  const body = asRecord(json);
  if ((status === 200 || status === 201) && body) {
    if (hasForbiddenPii(body)) {
      return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
    }
    if (
      isNonEmptyString(body.templateId) &&
      typeof body.version === 'number' &&
      Number.isInteger(body.version) &&
      body.version >= 1
    ) {
      return {
        kind: 'published',
        templateId: body.templateId.trim(),
        version: body.version,
      };
    }
    return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
  }
  return rejectionOrUnknown(status, json, false);
}

export function interpretReminderPreview(
  status: number,
  json: unknown,
  networkError: boolean,
): ReminderPreviewView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
  }
  const body = asRecord(json);
  if (status === 200 && body) {
    if (hasForbiddenPii(body)) {
      return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
    }
    // recipientCount only — never a list of emails/ids
    if (
      typeof body.recipientCount === 'number' &&
      Number.isInteger(body.recipientCount) &&
      body.recipientCount >= 0 &&
      isNonEmptyString(body.scheduledAt) &&
      typeof body.eventRevision === 'number' &&
      Number.isInteger(body.eventRevision) &&
      !('recipients' in body) &&
      !('emails' in body) &&
      !('owners' in body)
    ) {
      const preview: ReminderPreviewResponse = {
        recipientCount: body.recipientCount,
        scheduledAt: body.scheduledAt,
        eventRevision: body.eventRevision,
      };
      return { kind: 'preview', ...preview };
    }
    return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
  }
  return rejectionOrUnknown(status, json, false);
}

function parseReminderSummary(value: unknown): ReminderSummary | null {
  const body = asRecord(value);
  if (!body) return null;
  if (hasForbiddenPii(body)) return null;
  if (
    !isNonEmptyString(body.reminderId) ||
    !isNonEmptyString(body.eventId) ||
    !isNonEmptyString(body.scheduledAt) ||
    (body.status !== 'SCHEDULED' &&
      body.status !== 'CANCELLED' &&
      body.status !== 'FANOUT_COMPLETE') ||
    typeof body.eventRevision !== 'number' ||
    !Number.isInteger(body.eventRevision)
  ) {
    return null;
  }
  return {
    reminderId: body.reminderId.trim(),
    eventId: body.eventId.trim(),
    scheduledAt: body.scheduledAt,
    status: body.status,
    eventRevision: body.eventRevision,
  };
}

export function interpretReminderCreate(
  status: number,
  json: unknown,
  networkError: boolean,
): ReminderCreateView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
  }
  const body = asRecord(json);
  if ((status === 200 || status === 201) && body) {
    // Accept either nested reminder or flat ReminderSummary
    const reminder =
      parseReminderSummary(body.reminder ?? body) ??
      parseReminderSummary(body);
    if (reminder && reminder.status === 'SCHEDULED') {
      return { kind: 'created', reminder };
    }
    return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
  }
  return rejectionOrUnknown(status, json, false);
}

export function interpretReminderCancel(
  status: number,
  json: unknown,
  networkError: boolean,
): ReminderCancelView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
  }
  const body = asRecord(json);
  if ((status === 200 || status === 201) && body) {
    const reminder =
      parseReminderSummary(body.reminder ?? body) ??
      parseReminderSummary(body);
    if (reminder && reminder.status === 'CANCELLED') {
      return { kind: 'cancelled', reminder };
    }
    return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
  }
  return rejectionOrUnknown(status, json, false);
}

export function interpretNotificationRetry(
  status: number,
  json: unknown,
  networkError: boolean,
): NotificationRetryView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
  }
  const body = asRecord(json);
  if ((status === 200 || status === 201) && body) {
    if (hasForbiddenPii(body)) {
      return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
    }
    // Requeue starts PENDING — ACCEPTED alone is not proof of delivery or success.
    if (
      isNonEmptyString(body.notificationId) &&
      body.requeued === true
    ) {
      return {
        kind: 'requeued',
        notificationId: body.notificationId.trim(),
        providerStatus: 'PENDING',
      };
    }
    return { kind: 'unknown', message: NOTIFICATION_UNKNOWN };
  }
  return rejectionOrUnknown(status, json, false);
}

export function notificationListLabel(view: NotificationListView): string {
  if (view.kind === 'list') {
    return `Thông báo: ${view.items.length} mục${view.cursor ? ' (còn trang)' : ''}. ACCEPTED ≠ delivered.`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

export function templatePreviewLabel(view: TemplatePreviewView): string {
  if (view.kind === 'preview') {
    return `Preview (escaped): ${view.subject.slice(0, 80)}`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

export function templatePublishLabel(view: TemplatePublishView): string {
  if (view.kind === 'published') {
    return `Đã publish template ${view.templateId} · version ${view.version}.`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

export function reminderPreviewLabel(view: ReminderPreviewView): string {
  if (view.kind === 'preview') {
    return `Preview nhắc: ${view.recipientCount} chủ vé · UTC ${view.scheduledAt} · rev ${view.eventRevision}. Không lộ PII.`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

export function reminderCreateLabel(view: ReminderCreateView): string {
  if (view.kind === 'created') {
    return `Đã tạo nhắc ${view.reminder.reminderId} · ${view.reminder.status} · rev ${view.reminder.eventRevision}.`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

export function reminderCancelLabel(view: ReminderCancelView): string {
  if (view.kind === 'cancelled') {
    return `Đã huỷ nhắc ${view.reminder.reminderId}.`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

export function notificationRetryLabel(view: NotificationRetryView): string {
  if (view.kind === 'requeued') {
    return `Đã xếp lại gửi ${view.notificationId} (PENDING — ≠ delivered).`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

/**
 * When create/cancel/retry outcome is unknown, reuse the same idempotency key
 * for the same fingerprint so a retry cannot duplicate a schedule silently.
 */
export function resolveNotificationIdempotencyKey(
  existing: { key: string; fingerprint: string; unclear: boolean } | null,
  fingerprint: string,
  fresh: () => string,
): { key: string; reused: boolean } {
  if (
    existing?.unclear &&
    existing.fingerprint === fingerprint &&
    existing.key
  ) {
    return { key: existing.key, reused: true };
  }
  return { key: fresh(), reused: false };
}

export function reminderCreateFingerprint(input: {
  tenantId: string;
  eventId: string;
  expectedEventRevision: number;
  scheduledAt: string;
}): string {
  return [
    'reminder.create',
    input.tenantId.trim(),
    input.eventId.trim(),
    String(input.expectedEventRevision),
    input.scheduledAt.trim(),
  ].join('|');
}

export function isRevisionConflict(code: string): boolean {
  return (
    code === NOTIFICATION_ERROR_CODES.REVISION_CONFLICT ||
    code === 'REVISION_CONFLICT'
  );
}

export function buildTemplatePreviewBody(input: {
  kind: NotificationKind;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  sampleVariables?: Record<string, string>;
}) {
  return {
    kind: input.kind,
    subject: input.subject,
    bodyText: input.bodyText,
    bodyHtml: input.bodyHtml,
    sampleVariables: input.sampleVariables ?? {},
  };
}

export function buildTemplatePublishBody(input: {
  kind: NotificationKind;
  subject: string;
  bodyText: string;
  bodyHtml: string;
}) {
  return {
    kind: input.kind,
    subject: input.subject,
    bodyText: input.bodyText,
    bodyHtml: input.bodyHtml,
  };
}

export function buildReminderPreviewBody(input: {
  expectedEventRevision: number;
  scheduledAt: string;
}) {
  return {
    expectedEventRevision: input.expectedEventRevision,
    scheduledAt: input.scheduledAt,
  };
}

export function buildReminderCreateBody(input: {
  expectedEventRevision: number;
  scheduledAt: string;
}) {
  return {
    expectedEventRevision: input.expectedEventRevision,
    scheduledAt: input.scheduledAt,
    kind: 'EventReminder' as const,
    audience: 'TICKET_OWNERS' as const,
  };
}

export function buildRetryBody(reason: string) {
  return { reason: reason.trim() };
}
