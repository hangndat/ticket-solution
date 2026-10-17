import type {
  NotificationKind,
  NotificationListPage,
  NotificationSummary,
} from '@ticket/contracts';
import type { Prisma } from './generated/prisma/client';
import { requireTenantPermission } from './membership';
import {
  NotificationError,
  NOTIFICATION_ERROR_CODES,
} from './notification-error';
import { assertResendCaps } from './notification-retry';
import {
  NOTIFICATION_RATE_DEFAULTS,
} from '@ticket/contracts';

const PERMISSION_NOTIFY = 'event.config';

export async function listEventNotifications(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    cursor?: string | null;
    limit?: number;
  },
): Promise<NotificationListPage> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_NOTIFY,
    eventId: input.eventId,
  });
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      kind: string;
      payload_version: number;
      channel: string;
      state: string;
      attempts: number;
      next_attempt_at: Date | null;
      created_at: Date;
    }>
  >`
    SELECT id, kind, payload_version, channel, state, attempts,
           next_attempt_at, created_at
    FROM notifications
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND (${input.cursor ?? null}::uuid IS NULL OR id < ${input.cursor ?? null}::uuid)
    ORDER BY id DESC
    LIMIT ${limit + 1}::integer
  `;
  const page = rows.slice(0, limit).map(
    (row): NotificationSummary => ({
      notificationId: row.id,
      kind: row.kind as NotificationKind,
      payloadVersion: row.payload_version,
      channel: row.channel as 'email' | 'push',
      providerStatus: row.state as NotificationSummary['providerStatus'],
      attempts: row.attempts,
      nextAttemptAt: row.next_attempt_at
        ? row.next_attempt_at.toISOString()
        : null,
    }),
  );
  return {
    items: page,
    nextCursor: rows.length > limit ? page[page.length - 1]!.notificationId : null,
  };
}

/**
 * Staff resend: re-queue email channel without rotating credential.
 * Caps exhausted → defer (error), never drop ticket.
 */
export async function retryNotificationDelivery(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    notificationId: string;
    actorUserId: string;
    reason: string;
    tenantCapPerHour?: number | null;
  },
): Promise<{ notificationId: string; requeued: true }> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_NOTIFY,
    eventId: input.eventId,
  });
  if (!input.reason.trim() || input.reason.length > 500) {
    throw new NotificationError(
      NOTIFICATION_ERROR_CODES.TEMPLATE_INVALID,
      'reason is required (≤500 chars)',
    );
  }

  const notes = await tx.$queryRaw<
    Array<{
      id: string;
      channel: string;
      state: string;
      business_key: string;
      payload: Prisma.JsonValue;
      updated_at: Date;
    }>
  >`
    SELECT id, channel, state, business_key, payload, updated_at
    FROM notifications
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND id = ${input.notificationId}::uuid
    FOR UPDATE
  `;
  const note = notes[0];
  if (!note) {
    throw new NotificationError(
      NOTIFICATION_ERROR_CODES.NOTIFICATION_NOT_FOUND,
      'Notification not found',
    );
  }
  if (note.channel !== 'email') {
    throw new NotificationError(
      NOTIFICATION_ERROR_CODES.KIND_UNSUPPORTED,
      'Only email channel resend is supported in N1',
    );
  }

  const cooldownMs = NOTIFICATION_RATE_DEFAULTS.ticketResendCooldownSeconds * 1000;
  if (Date.now() - note.updated_at.getTime() < cooldownMs) {
    throw new NotificationError(
      NOTIFICATION_ERROR_CODES.RESEND_COOLDOWN,
      'Resend cooldown active',
      true,
    );
  }

  const payload = (note.payload ?? {}) as {
    email?: string | null;
    ticketId?: string;
    ownerUserId?: string;
  };
  const recipientKey =
    payload.email?.trim() ||
    payload.ownerUserId ||
    payload.ticketId ||
    note.id;

  await assertResendCaps(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    notificationId: note.id,
    recipientKey,
    actorUserId: input.actorUserId,
    isStaff: true,
    tenantCapPerHour: input.tenantCapPerHour,
  });

  // Re-open email channel for delivery; do not rotate ticket credentials.
  await tx.$executeRaw`
    UPDATE notifications
    SET state = 'PENDING',
        next_attempt_at = clock_timestamp(),
        last_error = NULL,
        lease_owner = NULL,
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = now()
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${note.id}::uuid
      AND channel = 'email'
  `;

  const ticketId =
    payload.ticketId ??
    (note.business_key.startsWith('ticket:')
      ? note.business_key.split(':')[1]
      : null);
  if (ticketId) {
    await tx.$executeRaw`
      UPDATE outbox
      SET status = 'PENDING',
          next_attempt_at = clock_timestamp(),
          lease_owner = NULL,
          lease_token = NULL,
          lease_expires_at = NULL,
          updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND aggregate_id = ${ticketId}::uuid
        AND type = 'TicketIssued'
        AND status IN ('COMPLETE', 'DEAD', 'PENDING')
    `;
  }

  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type,
      resource_id, reason, sanitized_diff, created_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, gen_random_uuid(),
      ${input.actorUserId}::uuid, 'notification.retry', 'notification',
      ${note.id}::uuid, ${input.reason.slice(0, 500)},
      ${JSON.stringify({ channel: 'email', credentialRotated: false })}::jsonb,
      now()
    )
  `;

  return { notificationId: note.id, requeued: true };
}
