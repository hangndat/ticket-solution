import { randomUUID } from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import { hashRedemptionCode, type CodeHmacConfig } from './code-hmac';

export type SeedInventoryInput = {
  tenantId: string;
  eventId: string;
  eventQuota: number;
  typeQuota?: number;
  sourceQuota?: number;
  rawCodes: string[];
  ticketTypeLabel?: string;
  sourceName?: string;
};

export type SeedInventoryResult = {
  ticketTypeId: string;
  sourceId: string;
  codeIds: string[];
  eventBucketId: string;
  typeBucketId: string;
  sourceBucketId: string;
};

/**
 * Test/admin helper: seed published-event inventory + codes inside withTenant.
 * Not a public HTTP admin API (that lands in D4).
 */
export async function seedEventInventory(
  tx: Prisma.TransactionClient,
  hmac: CodeHmacConfig,
  input: SeedInventoryInput,
): Promise<SeedInventoryResult> {
  const ticketTypeId = randomUUID();
  const sourceId = randomUUID();
  const eventBucketId = randomUUID();
  const typeBucketId = randomUUID();
  const sourceBucketId = randomUUID();

  await tx.$executeRaw`
    UPDATE events
    SET status = 'PUBLISHED',
        redemption_opens_at = COALESCE(redemption_opens_at, now() - interval '1 hour'),
        redemption_closes_at = COALESCE(redemption_closes_at, now() + interval '7 days')
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.eventId}::uuid
  `;

  await tx.$executeRaw`
    INSERT INTO ticket_types (
      tenant_id, event_id, id, label, entitlement_snapshot, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${ticketTypeId}::uuid,
      ${input.ticketTypeLabel ?? 'General'}, '{}'::jsonb, now(), now()
    )
  `;
  await tx.$executeRaw`
    INSERT INTO issuance_sources (
      tenant_id, event_id, id, name, approval_mode, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${sourceId}::uuid,
      ${input.sourceName ?? 'VIP'}, 'AUTO', now(), now()
    )
  `;
  await tx.$executeRaw`
    INSERT INTO source_ticket_types (
      tenant_id, event_id, source_id, ticket_type_id
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid,
      ${sourceId}::uuid, ${ticketTypeId}::uuid
    )
  `;

  await tx.$executeRaw`
    INSERT INTO quota_buckets (
      tenant_id, event_id, id, scope, scope_id, capacity, allocated, created_at, updated_at
    ) VALUES
      (
        ${input.tenantId}::uuid, ${input.eventId}::uuid, ${eventBucketId}::uuid,
        'EVENT', NULL, ${input.eventQuota}, 0, now(), now()
      ),
      (
        ${input.tenantId}::uuid, ${input.eventId}::uuid, ${typeBucketId}::uuid,
        'TICKET_TYPE', ${ticketTypeId}::uuid,
        ${input.typeQuota ?? input.eventQuota}, 0, now(), now()
      ),
      (
        ${input.tenantId}::uuid, ${input.eventId}::uuid, ${sourceBucketId}::uuid,
        'ISSUANCE_SOURCE', ${sourceId}::uuid,
        ${input.sourceQuota ?? input.eventQuota}, 0, now(), now()
      )
  `;

  const codeIds: string[] = [];
  for (const raw of input.rawCodes) {
    const id = randomUUID();
    const codeHmac = hashRedemptionCode(hmac, raw);
    await tx.$executeRaw`
      INSERT INTO redemption_codes (
        tenant_id, event_id, id, code_hmac, code_pepper_version,
        source_id, ticket_type_id, status, created_at, updated_at
      ) VALUES (
        ${input.tenantId}::uuid, ${input.eventId}::uuid, ${id}::uuid,
        ${codeHmac}, ${hmac.version}, ${sourceId}::uuid, ${ticketTypeId}::uuid,
        'AVAILABLE', now(), now()
      )
    `;
    codeIds.push(id);
  }

  return {
    ticketTypeId,
    sourceId,
    codeIds,
    eventBucketId,
    typeBucketId,
    sourceBucketId,
  };
}
