import type { PrismaClient } from './generated/prisma/client';
import type { ObjectStore } from './minio';

/** Product clocks are fixed by DECISION-LOG O06, not runtime configuration. */

export const O06_ACCOUNT_ANONYMIZE_MAX_DAYS = 30 as const;
export const O06_ACCOUNT_ANONYMIZE_POLICY_VERSION = 'O06-2026-10-18' as const;
export const O06_TICKET_PII_RETENTION_DAYS = 365 as const;
export const O06_OBJECT_RETENTION_DAYS = 90 as const;
export const O06_AUDIT_TTL_DAYS = 730 as const;

export async function processDueTicketPiiAnonymizations(
  db: PrismaClient,
  limit = 10,
): Promise<{ scanned: number; applied: number }> {
  const due = await db.$queryRaw<{ tenant_id: string; event_id: string }[]>`
    SELECT tenant_id, event_id FROM public.list_due_ticket_pii_anonymizations(${limit}::integer)
  `;
  let applied = 0;
  for (const row of due) {
    // A list result carries no lease; the apply function rechecks under lock.
    const result = await db.$queryRaw<{ applied: boolean }[]>`
      SELECT public.apply_ticket_pii_anonymization(
        ${row.tenant_id}::uuid, ${row.event_id}::uuid
      ) AS applied
    `;
    if (result[0]?.applied) applied += 1;
  }
  return { scanned: due.length, applied };
}

export async function processDueObjectRetentions(
  db: PrismaClient,
  store: Pick<ObjectStore, 'deleteObject'>,
  leaseOwner: string,
  limit = 1,
): Promise<{ scanned: number; applied: number; failed: number }> {
  const claimed = await db.$queryRaw<{
    tenant_id: string;
    export_id: string;
    object_key: string;
    lease_token: string;
  }[]>`
    SELECT tenant_id, export_id, object_key, lease_token
    FROM public.claim_expired_retention_objects(${limit}::integer, ${leaseOwner}::text)
  `;
  let applied = 0;
  let failed = 0;
  for (const row of claimed) {
    try {
      // Claim commits its event fence before external I/O. The adapter treats
      // 404 as success, including crash-after-DELETE retries.
      await store.deleteObject(row.object_key);
      const result = await db.$queryRaw<{ applied: boolean }[]>`
        SELECT public.apply_export_object_purge(
          ${row.tenant_id}::uuid, ${row.export_id}::uuid,
          ${leaseOwner}::text, ${row.lease_token}::uuid
        ) AS applied
      `;
      if (result[0]?.applied) applied += 1;
      else failed += 1;
    } catch {
      // Leave the claim for lease-expiry retry; never mark bytes deleted here.
      failed += 1;
    }
  }
  return { scanned: claimed.length, applied, failed };
}
