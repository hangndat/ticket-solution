/**
 * C-N — Notification kinds, templates, attempts, reminders.
 * Provider ACCEPTED ≠ end-user delivered.
 */

import type { CursorPage } from './common';

export const NOTIFICATION_KINDS = [
  'TicketIssued',
  'InvitationReady',
  'EventChanged',
  'EventCancelled',
  'EventReminder',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Allowlisted payloadVersion per kind — reject enqueue of unknown versions. */
export const NOTIFICATION_PAYLOAD_VERSIONS = {
  TicketIssued: [1],
  InvitationReady: [1],
  EventChanged: [1],
  EventCancelled: [1],
  EventReminder: [1],
} as const;

/** Provider accepted the message — never means end-user delivered/read. */
export type NotificationProviderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'FAILED'
  | 'DEAD'
  | 'UNKNOWN';

export type NotificationChannel = 'email' | 'push';

/** Technical defaults — ops config, not customer SLA. */
export const NOTIFICATION_RETRY_DEFAULTS = {
  maxAttempts: 8,
  initialBackoffSeconds: 30,
  maxBackoffSeconds: 3600,
  jitterRatio: 0.2,
} as const;

export const NOTIFICATION_RATE_DEFAULTS = {
  staffResendPerHour: 10,
  recipientPerHour: 3,
  ticketResendCooldownSeconds: 60,
} as const;

export interface NotificationAttempt {
  ordinal: number;
  channel: NotificationChannel;
  startedAt: string;
  finishedAt: string | null;
  providerStatus: NotificationProviderStatus;
  providerRef: string | null;
  /** Always null in API — never expose raw provider errors. */
  lastError: null;
}

export interface NotificationSummary {
  notificationId: string;
  kind: NotificationKind;
  payloadVersion: number;
  channel: NotificationChannel;
  providerStatus: NotificationProviderStatus;
  attempts: number;
  nextAttemptAt: string | null;
}

export type NotificationListPage = CursorPage<NotificationSummary>;

export interface NotificationTemplateVariable {
  name: string;
  description: string;
}

export interface NotificationTemplateVersion {
  templateId: string;
  version: number;
  kind: NotificationKind;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  variables: NotificationTemplateVariable[];
  published: boolean;
}

export interface NotificationTemplatePreviewBody {
  kind: NotificationKind;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  /** Sample allowlisted variable values for preview only. */
  sampleVariables: Record<string, string>;
}

export interface NotificationTemplatePreviewResponse {
  subject: string;
  bodyText: string;
  bodyHtml: string;
  escaped: true;
}

export interface ReminderCreateBody {
  expectedEventRevision: number;
  /** Absolute UTC ISO-8601. */
  scheduledAt: string;
  kind: 'EventReminder';
  /** Audience is always ticket owners; no marketing segments. */
  audience: 'TICKET_OWNERS';
}

export interface ReminderPreviewBody {
  expectedEventRevision: number;
  scheduledAt: string;
}

export interface ReminderPreviewResponse {
  recipientCount: number;
  scheduledAt: string;
  eventRevision: number;
}

export interface ReminderSummary {
  reminderId: string;
  eventId: string;
  scheduledAt: string;
  status: 'SCHEDULED' | 'CANCELLED' | 'FANOUT_COMPLETE';
  eventRevision: number;
}

export interface NotificationRetryBody {
  reason: string;
}

export const NOTIFICATION_ERROR_CODES = {
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  TEMPLATE_INVALID: 'TEMPLATE_INVALID',
  TEMPLATE_UNSUPPORTED_VARIABLE: 'TEMPLATE_UNSUPPORTED_VARIABLE',
  KIND_UNSUPPORTED: 'KIND_UNSUPPORTED',
  REMINDER_NOT_FOUND: 'REMINDER_NOT_FOUND',
  REVISION_CONFLICT: 'REVISION_CONFLICT',
  RESEND_COOLDOWN: 'RESEND_COOLDOWN',
  RESEND_LIMIT: 'RESEND_LIMIT',
  RATE_LIMITED: 'RATE_LIMITED',
  SMTP_MISCONFIGURED: 'SMTP_MISCONFIGURED',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
} as const;

export type NotificationErrorCode =
  (typeof NOTIFICATION_ERROR_CODES)[keyof typeof NOTIFICATION_ERROR_CODES];

export const NOTIFICATION_ENDPOINTS = {
  list: 'GET /tenants/:tenantId/events/:eventId/notifications',
  retry: 'POST /tenants/:tenantId/events/:eventId/notifications/:notificationId/retry',
  templatePreview:
    'POST /tenants/:tenantId/events/:eventId/notification-templates/preview',
  templatePublish:
    'POST /tenants/:tenantId/events/:eventId/notification-templates/publish',
  reminderPreview: 'POST /tenants/:tenantId/events/:eventId/reminders/preview',
  reminderCreate: 'POST /tenants/:tenantId/events/:eventId/reminders',
  reminderCancel: 'POST /tenants/:tenantId/events/:eventId/reminders/:reminderId/cancel',
} as const;
