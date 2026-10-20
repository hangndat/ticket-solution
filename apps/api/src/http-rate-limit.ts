import { createHash, randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { RESOLVE_ERROR_CODES, type ApiError } from '@ticket/contracts';
import { tryConsumeRateLimit, type PrismaClient } from '@ticket/backend';

/** Deterministic UUID for abuse counters keyed by IP (notification_rate_counters.tenant_id). */
export function abuseTenantIdFromKey(key: string): string {
  const hex = createHash('sha256').update(key, 'utf8').digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function rateLimitedException(): HttpException {
  return new HttpException(
    {
      code: RESOLVE_ERROR_CODES.RATE_LIMITED,
      message: 'Too many requests; try again later',
      requestId: randomUUID(),
      retryable: true,
    } satisfies ApiError,
    429,
  );
}

export async function consumeUserRateLimit(
  db: PrismaClient | null,
  userId: string,
  bucketKey: string,
  limit: number,
): Promise<void> {
  if (!db || limit < 1) return;
  const allowed = await db.$transaction((tx) =>
    tryConsumeRateLimit(tx, {
      tenantId: userId,
      bucketKey,
      limit,
    }),
  );
  if (!allowed) throw rateLimitedException();
}

export async function consumeIpRateLimit(
  db: PrismaClient | null,
  clientIp: string | undefined,
  bucketKey: string,
  limit: number,
): Promise<void> {
  if (!db || limit < 1) return;
  const ip = clientIp?.trim() || 'unknown';
  const tenantId = abuseTenantIdFromKey(`ip:${ip}`);
  const allowed = await db.$transaction((tx) =>
    tryConsumeRateLimit(tx, {
      tenantId,
      bucketKey,
      limit,
    }),
  );
  if (!allowed) throw rateLimitedException();
}
