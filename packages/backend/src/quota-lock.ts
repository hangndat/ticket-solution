import type { Prisma } from './generated/prisma/client';

export type QuotaRow = {
  id: string;
  scope: string;
  scope_id: string | null;
  capacity: number | null;
  allocated: number;
};

/**
 * Lock quota rows in SQL, in the same EVENT → TICKET_TYPE → ISSUANCE_SOURCE
 * order for auto issue and manual approval. Separate awaited statements make
 * the acquisition order explicit; ORDER BY id also covers duplicate EVENT
 * rows (PostgreSQL UNIQUE treats NULL scope_id values as distinct).
 * The caller must pass its existing tenant transaction client.
 */
export async function lockIssuanceQuotas(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    ticketTypeId: string;
    sourceId: string;
  },
): Promise<QuotaRow[]> {
  const eventRows = await tx.$queryRaw<QuotaRow[]>`
    SELECT id, scope, scope_id, capacity, allocated
    FROM quota_buckets
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND scope = 'EVENT' AND scope_id IS NULL
    ORDER BY id
    FOR UPDATE
  `;
  const typeRows = await tx.$queryRaw<QuotaRow[]>`
    SELECT id, scope, scope_id, capacity, allocated
    FROM quota_buckets
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND scope = 'TICKET_TYPE' AND scope_id = ${input.ticketTypeId}::uuid
    ORDER BY id
    FOR UPDATE
  `;
  const sourceRows = await tx.$queryRaw<QuotaRow[]>`
    SELECT id, scope, scope_id, capacity, allocated
    FROM quota_buckets
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND scope = 'ISSUANCE_SOURCE' AND scope_id = ${input.sourceId}::uuid
    ORDER BY id
    FOR UPDATE
  `;
  return [...eventRows, ...typeRows, ...sourceRows];
}
