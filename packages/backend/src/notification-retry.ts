import {
  NOTIFICATION_RATE_DEFAULTS,
  NOTIFICATION_RETRY_DEFAULTS,
} from '@ticket/contracts';
import type { Prisma } from './generated/prisma/client';
import {
  NotificationError,
  NOTIFICATION_ERROR_CODES,
} from './notification-error';

export type RetryConfig = {
  maxAttempts: number;
  initialBackoffSeconds: number;
  maxBackoffSeconds: number;
  jitterRatio: number;
};

export function readRetryConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetryConfig {
  const maxAttempts = Number(env['NOTIFICATION_MAX_ATTEMPTS']);
  const initial = Number(env['NOTIFICATION_INITIAL_BACKOFF_SECONDS']);
  const maxBackoff = Number(env['NOTIFICATION_MAX_BACKOFF_SECONDS']);
  const jitter = Number(env['NOTIFICATION_JITTER_RATIO']);
  return {
    maxAttempts: Number.isFinite(maxAttempts) && maxAttempts >= 1
      ? Math.floor(maxAttempts)
      : NOTIFICATION_RETRY_DEFAULTS.maxAttempts,
    initialBackoffSeconds:
      Number.isFinite(initial) && initial >= 1
        ? Math.floor(initial)
        : NOTIFICATION_RETRY_DEFAULTS.initialBackoffSeconds,
    maxBackoffSeconds:
      Number.isFinite(maxBackoff) && maxBackoff >= 1
        ? Math.floor(maxBackoff)
        : NOTIFICATION_RETRY_DEFAULTS.maxBackoffSeconds,
    jitterRatio:
      Number.isFinite(jitter) && jitter >= 0 && jitter <= 1
        ? jitter
        : NOTIFICATION_RETRY_DEFAULTS.jitterRatio,
  };
}

/**
 * Exponential backoff with symmetric jitter ±jitterRatio.
 * attemptOrdinal is 1-based (matches claim increments).
 */
export function computeBackoffSeconds(
  attemptOrdinal: number,
  config: RetryConfig = NOTIFICATION_RETRY_DEFAULTS,
  random: () => number = Math.random,
): number {
  const exp = Math.min(
    config.maxBackoffSeconds,
    config.initialBackoffSeconds *
      2 ** Math.max(0, Math.floor(attemptOrdinal) - 1),
  );
  const jitterSpan = exp * config.jitterRatio;
  const delta = (random() * 2 - 1) * jitterSpan;
  return Math.max(1, Math.round(exp + delta));
}

export function isWithinJitterBounds(
  seconds: number,
  attemptOrdinal: number,
  config: RetryConfig = NOTIFICATION_RETRY_DEFAULTS,
): boolean {
  const exp = Math.min(
    config.maxBackoffSeconds,
    config.initialBackoffSeconds *
      2 ** Math.max(0, Math.floor(attemptOrdinal) - 1),
  );
  const lo = Math.max(1, Math.floor(exp * (1 - config.jitterRatio)));
  const hi = Math.ceil(exp * (1 + config.jitterRatio));
  return seconds >= lo && seconds <= hi;
}

function hourWindowStart(now = new Date()): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      0,
      0,
      0,
    ),
  );
}

/**
 * Atomic hourly counter. Returns false when limit exhausted (caller must defer,
 * never drop the ticket/notification).
 */
export async function tryConsumeRateLimit(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    bucketKey: string;
    limit: number;
    now?: Date;
  },
): Promise<boolean> {
  if (input.limit < 1) return false;
  const window = hourWindowStart(input.now);
  await tx.$executeRaw`
    INSERT INTO notification_rate_counters (
      tenant_id, bucket_key, window_started_at, count, updated_at
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.bucketKey},
      ${window}::timestamptz,
      0,
      now()
    )
    ON CONFLICT (tenant_id, bucket_key, window_started_at) DO NOTHING
  `;
  const rows = await tx.$queryRaw<Array<{ count: number }>>`
    UPDATE notification_rate_counters
    SET count = count + 1, updated_at = now()
    WHERE tenant_id = ${input.tenantId}::uuid
      AND bucket_key = ${input.bucketKey}
      AND window_started_at = ${window}::timestamptz
      AND count < ${input.limit}::integer
    RETURNING count
  `;
  return rows.length > 0;
}

export async function assertResendCaps(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    notificationId: string;
    recipientKey: string;
    actorUserId: string;
    isStaff: boolean;
    tenantCapPerHour?: number | null;
  },
): Promise<void> {
  const staffOk = input.isStaff
    ? await tryConsumeRateLimit(tx, {
        tenantId: input.tenantId,
        bucketKey: `staff-resend:${input.actorUserId}`,
        limit: NOTIFICATION_RATE_DEFAULTS.staffResendPerHour,
      })
    : true;
  if (!staffOk) {
    throw new NotificationError(
      NOTIFICATION_ERROR_CODES.RESEND_LIMIT,
      'Staff resend hourly cap exhausted',
      true,
    );
  }
  const recipientOk = await tryConsumeRateLimit(tx, {
    tenantId: input.tenantId,
    bucketKey: `recipient:${input.eventId}:${input.recipientKey}`,
    limit: NOTIFICATION_RATE_DEFAULTS.recipientPerHour,
  });
  if (!recipientOk) {
    throw new NotificationError(
      NOTIFICATION_ERROR_CODES.RESEND_LIMIT,
      'Recipient resend hourly cap exhausted',
      true,
    );
  }
  if (
    input.tenantCapPerHour != null &&
    Number.isFinite(input.tenantCapPerHour) &&
    input.tenantCapPerHour > 0
  ) {
    const tenantOk = await tryConsumeRateLimit(tx, {
      tenantId: input.tenantId,
      bucketKey: `tenant:${input.tenantId}`,
      limit: Math.floor(input.tenantCapPerHour),
    });
    if (!tenantOk) {
      throw new NotificationError(
        NOTIFICATION_ERROR_CODES.RATE_LIMITED,
        'Tenant notification cap exhausted; delivery deferred',
        true,
      );
    }
  }
}

export function sanitizeProviderError(message: string): string {
  return message.replace(/[\r\n]+/g, ' ').slice(0, 500);
}
