import type { PrismaClient } from './generated/prisma/client';

export type OutboxMetricSnapshot = {
  oldestAgeSeconds: number;
  pendingCount: number;
  processingCount: number;
  errorCount: number;
};

/**
 * Read outbox health from PostgreSQL (source of truth). No PII labels.
 */
export async function collectOutboxMetrics(
  db: PrismaClient,
): Promise<OutboxMetricSnapshot> {
  const rows = await db.$queryRaw<
    {
      oldest_age_seconds: number | null;
      pending_count: number;
      processing_count: number;
      error_count: number;
    }[]
  >`
    SELECT
      COALESCE(
        EXTRACT(EPOCH FROM (clock_timestamp() - MIN(created_at)))
          FILTER (
            WHERE status IN ('PENDING', 'LEASED', 'PROCESSING')
          ),
        0
      )::float8 AS oldest_age_seconds,
      COUNT(*) FILTER (WHERE status IN ('PENDING', 'LEASED'))::int AS pending_count,
      COUNT(*) FILTER (WHERE status = 'PROCESSING')::int AS processing_count,
      COUNT(*) FILTER (
        WHERE status = 'DEAD'
           OR (
             status IN ('PENDING', 'LEASED', 'PROCESSING')
             AND attempts > 0
           )
      )::int AS error_count
    FROM outbox
  `;
  const row = rows[0];
  return {
    oldestAgeSeconds: Number(row?.oldest_age_seconds ?? 0),
    pendingCount: Number(row?.pending_count ?? 0),
    processingCount: Number(row?.processing_count ?? 0),
    errorCount: Number(row?.error_count ?? 0),
  };
}

export async function collectDbRuntimeMetrics(db: PrismaClient): Promise<{
  lockWaiting: number;
}> {
  // Useful when the runtime role can see pg_stat_activity; otherwise 0.
  try {
    const rows = await db.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
      FROM pg_stat_activity
      WHERE wait_event_type = 'Lock'
        AND datname = current_database()
    `;
    return { lockWaiting: Number(rows[0]?.n ?? 0) };
  } catch {
    return { lockWaiting: 0 };
  }
}
