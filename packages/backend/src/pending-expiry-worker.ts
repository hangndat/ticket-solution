/**
 * Worker entry: list due pending via SECURITY DEFINER, expire inside withTenant.
 */

import type { PrismaClient } from './generated/prisma/client';
import { withTenant } from './tenant-context';
import { expirePendingRequest } from './pending-expiry';

export type DuePendingRow = {
  tenant_id: string;
  event_id: string;
  request_id: string;
};

export async function listDuePendingRedemptions(
  db: PrismaClient,
  limit = 50,
): Promise<DuePendingRow[]> {
  return db.$queryRaw<DuePendingRow[]>`
    SELECT tenant_id, event_id, request_id
    FROM list_due_pending_redemptions(${limit}::integer)
  `;
}

export async function reconcileDuePendingRedemptions(
  db: PrismaClient,
  limit = 50,
  budgetMs = 5_000,
): Promise<{ scanned: number; expired: number }> {
  const deadline = performance.now() + budgetMs;
  // Bound the cross-tenant discovery query as well as every tenant transaction.
  // SET LOCAL and the query use one pinned connection; timeout rolls it back.
  const rows = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(Math.min(3_000, budgetMs))}, true)`;
      return tx.$queryRaw<DuePendingRow[]>`
        SELECT tenant_id, event_id, request_id
        FROM list_due_pending_redemptions(${limit}::integer)
      `;
    },
    { maxWait: 1_000, timeout: Math.min(4_000, budgetMs) },
  );
  let expired = 0;
  let scanned = 0;
  for (const row of rows) {
    const remaining = Math.floor(deadline - performance.now());
    if (remaining < 250) break;
    const result = await withTenant(
      db,
      row.tenant_id,
      (tx) =>
        expirePendingRequest(tx, {
          tenantId: row.tenant_id,
          eventId: row.event_id,
          requestId: row.request_id,
        }),
      {
        statementTimeoutMs: Math.min(3_000, remaining),
        maxWaitMs: Math.min(1_000, remaining),
        transactionTimeoutMs: remaining,
      },
    );
    scanned += 1;
    if (result.expired) expired += 1;
  }
  return { scanned, expired };
}
