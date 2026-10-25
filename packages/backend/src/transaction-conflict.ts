import type { Prisma } from './generated/prisma/client';

/** Bound issue/approval row-lock waits before withTenant's 5s statement timeout.
 * PostgreSQL reports this timeout as 55P03; unrelated statement cancellation
 * remains 57014 and must not be presented as a retryable lock conflict. */
export async function configureIssuanceLockTimeout(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SET LOCAL lock_timeout = '2000ms'`;
}

/** PostgreSQL lock/deadlock/serialization failures must roll back the whole
 * issuance transaction. Prisma can expose SQLSTATE directly or through P2010. */
export function isRetryableTransactionConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    code?: unknown;
    meta?: { code?: unknown; driverAdapterError?: unknown };
    cause?: unknown;
  };
  const sqlState = candidate.code === 'P2010' ? candidate.meta?.code : candidate.code;
  if (
    sqlState === '40P01' || // deadlock_detected
    sqlState === '40001' || // serialization_failure
    sqlState === '55P03' || // lock_not_available / lock_timeout
    sqlState === 'P2034' // Prisma transaction conflict or deadlock
  ) {
    return true;
  }
  return (
    (candidate.cause !== error && isRetryableTransactionConflict(candidate.cause)) ||
    (candidate.meta?.driverAdapterError !== error &&
      isRetryableTransactionConflict(candidate.meta?.driverAdapterError))
  );
}
