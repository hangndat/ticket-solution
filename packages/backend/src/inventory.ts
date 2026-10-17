import { randomUUID } from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import { hashRedemptionCode, type CodeHmacConfig } from './code-hmac';
import { InventoryError, INVENTORY_ERROR_CODES } from './inventory-error';
import { requireTenantPermission } from './membership';

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
        content_status = 'PUBLISHED',
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

const IMPORT_LIMIT = 500;
const PERMISSION_IMPORT = 'inventory.import';

export type ImportCodesResult = {
  imported: number;
  ticketTypeId: string;
  sourceId: string;
};

export type EventQuotaResult = {
  eventId: string;
  capacity: number | null;
  allocated: number;
};

export async function importRedemptionCodes(
  tx: Prisma.TransactionClient,
  hmac: CodeHmacConfig,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    rawCodes: string[];
    eventQuota?: number;
  },
): Promise<ImportCodesResult> {
  const codes = input.rawCodes.map((code) => code.trim()).filter((code) => code.length > 0);
  if (codes.length === 0) {
    throw new InventoryError(INVENTORY_ERROR_CODES.CODES_REQUIRED, 'At least one code is required');
  }
  if (codes.length > IMPORT_LIMIT) {
    throw new InventoryError(
      INVENTORY_ERROR_CODES.IMPORT_TOO_LARGE,
      'Import exceeds 500 codes',
    );
  }
  if (new Set(codes).size !== codes.length) {
    throw new InventoryError(INVENTORY_ERROR_CODES.CODE_DUPLICATE, 'Import contains a duplicate code');
  }
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_IMPORT,
    eventId: input.eventId,
  });
  const events = await tx.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status FROM events
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.eventId}::uuid
    FOR UPDATE
  `;
  const event = events[0];
  if (!event) {
    throw new InventoryError(INVENTORY_ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
  }
  if (event.status === 'CLOSED' || event.status === 'ARCHIVED') {
    throw new InventoryError(INVENTORY_ERROR_CODES.EVENT_CLOSED, 'Event is closed');
  }

  const existing = await tx.$queryRaw<
    Array<{ ticket_type_id: string; source_id: string }>
  >`
    SELECT ticket_type_id, source_id
    FROM source_ticket_types
    WHERE tenant_id = ${input.tenantId}::uuid AND event_id = ${input.eventId}::uuid
    ORDER BY ticket_type_id
    LIMIT 1
  `;
  let ticketTypeId = existing[0]?.ticket_type_id;
  let sourceId = existing[0]?.source_id;
  if (!ticketTypeId || !sourceId) {
    if (!input.eventQuota || input.eventQuota < codes.length) {
      throw new InventoryError(
        INVENTORY_ERROR_CODES.QUOTA_REQUIRED,
        'eventQuota is required and must cover the imported codes',
      );
    }
    ticketTypeId = randomUUID();
    sourceId = randomUUID();
    const quota = input.eventQuota;
    await tx.$executeRaw`
      INSERT INTO ticket_types (
        tenant_id, event_id, id, label, entitlement_snapshot, created_at, updated_at
      ) VALUES (
        ${input.tenantId}::uuid, ${input.eventId}::uuid, ${ticketTypeId}::uuid,
        'General', '{}'::jsonb, now(), now()
      )
    `;
    await tx.$executeRaw`
      INSERT INTO issuance_sources (
        tenant_id, event_id, id, name, approval_mode, created_at, updated_at
      ) VALUES (
        ${input.tenantId}::uuid, ${input.eventId}::uuid, ${sourceId}::uuid,
        'Import', 'AUTO', now(), now()
      )
    `;
    await tx.$executeRaw`
      INSERT INTO source_ticket_types (tenant_id, event_id, source_id, ticket_type_id)
      VALUES (
        ${input.tenantId}::uuid, ${input.eventId}::uuid,
        ${sourceId}::uuid, ${ticketTypeId}::uuid
      )
    `;
    await tx.$executeRaw`
      INSERT INTO quota_buckets (
        tenant_id, event_id, id, scope, scope_id, capacity, allocated, created_at, updated_at
      ) VALUES
        (${input.tenantId}::uuid, ${input.eventId}::uuid, ${randomUUID()}::uuid, 'EVENT', NULL, ${quota}, 0, now(), now()),
        (${input.tenantId}::uuid, ${input.eventId}::uuid, ${randomUUID()}::uuid, 'TICKET_TYPE', ${ticketTypeId}::uuid, ${quota}, 0, now(), now()),
        (${input.tenantId}::uuid, ${input.eventId}::uuid, ${randomUUID()}::uuid, 'ISSUANCE_SOURCE', ${sourceId}::uuid, ${quota}, 0, now(), now())
    `;
  }

  for (const raw of codes) {
    const codeHmac = hashRedemptionCode(hmac, raw);
    const id = randomUUID();
    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('redemption_codes_hmac_unique')) {
        throw new InventoryError(
          INVENTORY_ERROR_CODES.CODE_DUPLICATE,
          'A code in this import already exists',
        );
      }
      throw error;
    }
  }
  return { imported: codes.length, ticketTypeId, sourceId };
}

export async function readEventQuota(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; eventId: string; actorUserId: string },
): Promise<EventQuotaResult> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_IMPORT,
    eventId: input.eventId,
  });
  const rows = await tx.$queryRaw<Array<{ capacity: number | null; allocated: number }>>`
    SELECT capacity, allocated
    FROM quota_buckets
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND scope = 'EVENT'
  `;
  const row = rows[0];
  if (!row) {
    throw new InventoryError(INVENTORY_ERROR_CODES.QUOTA_REQUIRED, 'Event quota is not configured');
  }
  return { eventId: input.eventId, capacity: row.capacity, allocated: row.allocated };
}
