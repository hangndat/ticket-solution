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
): Promise<{ scanned: number; expired: number }> {
  const rows = await listDuePendingRedemptions(db, limit);
  let expired = 0;
  for (const row of rows) {
    const result = await withTenant(db, row.tenant_id, (tx) =>
      expirePendingRequest(tx, {
        tenantId: row.tenant_id,
        eventId: row.event_id,
        requestId: row.request_id,
      }),
    );
    if (result.expired) expired += 1;
  }
  return { scanned: rows.length, expired };
}
