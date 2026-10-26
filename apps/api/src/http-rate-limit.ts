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

export class RateLimitedWithRetryAfter extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(rateLimitedException().getResponse(), 429);
  }
}

/** The counter uses UTC hour windows; pass this same clock value to the counter. */
export function secondsUntilNextRateLimitWindow(now: Date): number {
  return Math.max(
    1,
    Math.ceil((3_600_000 - (now.getTime() % 3_600_000)) / 1000),
  );
}

async function consumeRateLimitInTenantContext(
  db: PrismaClient,
  tenantId: string,
  bucketKey: string,
  limit: number,
  now?: Date,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    // notification_rate_counters is RLS-scoped; counter tenant_id is synthetic
    // (userId or IP-derived UUID), not the event tenant — bind session for writes.
    await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return tryConsumeRateLimit(tx, { tenantId, bucketKey, limit, now });
  });
}

export async function consumeUserRateLimitWithRetryAfter(
  db: PrismaClient,
  userId: string,
  bucketKey: string,
  limit: number,
): Promise<void> {
  const now = new Date();
  const allowed = await consumeRateLimitInTenantContext(
    db,
    userId,
    bucketKey,
    limit,
    now,
  );
  if (!allowed) {
    throw new RateLimitedWithRetryAfter(secondsUntilNextRateLimitWindow(now));
  }
}

export async function consumeUserRateLimit(
  db: PrismaClient | null,
  userId: string,
  bucketKey: string,
  limit: number,
): Promise<void> {
  if (!db || limit < 1) return;
  const allowed = await consumeRateLimitInTenantContext(
    db,
    userId,
    bucketKey,
    limit,
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
  const allowed = await consumeRateLimitInTenantContext(
    db,
    tenantId,
    bucketKey,
    limit,
  );
  if (!allowed) throw rateLimitedException();
}
