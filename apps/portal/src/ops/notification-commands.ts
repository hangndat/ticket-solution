import {
  NOTIFICATION_ERROR_CODES,
  NOTIFICATION_REMINDER_CANCEL_COMMAND,
  NOTIFICATION_REMINDER_CREATE_COMMAND,
  NOTIFICATION_RETRY_COMMAND,
  NOTIFICATION_TEMPLATE_PUBLISH_COMMAND,
  type NotificationChannel,
  type NotificationKind,
  type NotificationProviderStatus,
} from '@ticket/contracts';
import { eventPath, type AdminScope } from './scope';

/** Tenant and event scoped request paths, command bodies, and retry identity. */
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
  return eventPath(scope, `reminders/${encodeURIComponent(reminderId)}/cancel`);
}

export function notificationEndpointTemplates() {
  const eventScoped = '/api/bff/tenants/:tenantId/events/:eventId';
  return {
    list: `GET ${eventScoped}/notifications`,
    retry: `POST ${eventScoped}/notifications/:notificationId/retry`,
    templatePreview: `POST ${eventScoped}/notification-templates/preview`,
    templatePublish: `POST ${eventScoped}/notification-templates/publish`,
    reminderPreview: `POST ${eventScoped}/reminders/preview`,
    reminderCreate: `POST ${eventScoped}/reminders`,
    reminderCancel: `POST ${eventScoped}/reminders/:reminderId/cancel`,
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
