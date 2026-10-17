/**
 * C-B config save/publish/history/preview/semantic rollback + brand snapshot.
 * Reuses single typed EventConfigPayload schema — no HTML/CSS/JS, no payload fork.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  CONFIG_ROLLBACK_COMMAND,
  CURSOR_PAGE_LIMIT,
  type ConfigPreviewResponse,
  type ConfigRollbackResponse,
  type ConfigVersionListPage,
  type ConfigVersionSummary,
  type EventBrandSnapshot,
  type EventConfigPayload,
} from '@ticket/contracts';
import type { Prisma } from './generated/prisma/client';
import { assertAssetsReadyForBrand } from './config-assets';
import { ConfigError, CONFIG_ERROR_CODES } from './config-error';
import {
  isSchemaCompatible,
  requireValidConfigPayload,
} from './config-schema';
import { requireTenantPermission } from './membership';

const PERMISSION_CONFIG = 'event.config';
const PERMISSION_PUBLISH = 'event.publish';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ConfigVersionResult = {
  eventId: string;
  version: number;
  schemaVersion: number;
  publishedAt: Date | null;
};

export type PublishResult = {
  eventId: string;
  status: 'PUBLISHED';
  publishedConfigVersion: number;
  revision: number;
  brandSnapshot: EventBrandSnapshot;
};

type LockedEvent = {
  id: string;
  status: string;
  content_status: string;
  business_status: string;
  published_config_version: number | null;
  revision: number;
  published_brand_snapshot: EventBrandSnapshot | null;
};

type OperationRow = {
  id: string;
  request_hash: string;
  status: string;
  response_json: Prisma.JsonValue | null;
};

async function lockEvent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
): Promise<LockedEvent> {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      status: string;
      content_status: string;
      business_status: string;
      published_config_version: number | null;
      revision: number;
      published_brand_snapshot: EventBrandSnapshot | null;
    }>
  >`
    SELECT id, status, content_status, business_status, published_config_version,
           revision, published_brand_snapshot
    FROM events
    WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    throw new ConfigError(CONFIG_ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
  }
  return row;
}

function assertConfigMutable(event: LockedEvent): void {
  if (
    event.content_status === 'ARCHIVED' ||
    event.status === 'ARCHIVED' ||
    event.status === 'CLOSED'
  ) {
    throw new ConfigError(CONFIG_ERROR_CODES.EVENT_CLOSED, 'Event is archived');
  }
  if (event.business_status === 'CANCELLED') {
    throw new ConfigError(CONFIG_ERROR_CODES.EVENT_CLOSED, 'Event is cancelled');
  }
}

async function resolveBrandSnapshot(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  brand: EventBrandSnapshot,
): Promise<EventBrandSnapshot> {
  await assertAssetsReadyForBrand(tx, {
    tenantId,
    eventId,
    logoAssetId: brand.logoAssetId,
    bannerAssetId: brand.bannerAssetId,
  });
  const tenants = await tx.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM tenants WHERE id = ${tenantId}::uuid
  `;
  const tenantName = tenants[0]?.name?.trim() || 'Organization';
  const organizationName = brand.organizationName.trim() || tenantName;
  return {
    primaryColor: brand.primaryColor,
    organizationName,
    ...(brand.logoAssetId ? { logoAssetId: brand.logoAssetId } : {}),
    ...(brand.bannerAssetId ? { bannerAssetId: brand.bannerAssetId } : {}),
  };
}

function requireIdempotencyKey(key: string | undefined): string {
  const trimmed = key?.trim() ?? '';
  if (!UUID_RE.test(trimmed)) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      'Idempotency-Key must be a UUID',
    );
  }
  return trimmed;
}

async function beginOperation(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    command: string;
    clientKey: string;
    requestHash: string;
  },
): Promise<{ operationId: string; replayed: boolean; prior?: OperationRow }> {
  const operationId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO operations (
      tenant_id, event_id, id, actor_user_id, command, client_key,
      request_hash, status, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.eventId}::uuid,
      ${operationId}::uuid,
      ${input.actorUserId}::uuid,
      ${input.command},
      ${input.clientKey},
      ${input.requestHash},
      'IN_PROGRESS',
      now(),
      now()
    )
    ON CONFLICT (tenant_id, event_id, actor_user_id, command, client_key)
    DO NOTHING
  `;
  const existing = await tx.$queryRaw<OperationRow[]>`
    SELECT id, request_hash, status, response_json
    FROM operations
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND actor_user_id = ${input.actorUserId}::uuid
      AND command = ${input.command}
      AND client_key = ${input.clientKey}
    FOR UPDATE
  `;
  const prior = existing[0];
  if (!prior) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Idempotency conflict',
      true,
    );
  }
  if (prior.request_hash !== input.requestHash) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Idempotency-Key was reused with a different request',
    );
  }
  if (prior.status === 'COMPLETED' && prior.response_json) {
    return { operationId: prior.id, replayed: true, prior };
  }
  if (prior.status === 'FAILED') {
    throw new ConfigError(
      CONFIG_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Idempotency-Key already finished with a terminal failure; use a new key',
    );
  }
  return { operationId: prior.id, replayed: false, prior };
}

async function completeOperation(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    operationId: string;
    response: unknown;
  },
): Promise<void> {
  await tx.$executeRaw`
    UPDATE operations
    SET status = 'COMPLETED',
        response_json = ${JSON.stringify(input.response)}::jsonb,
        updated_at = now()
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.operationId}::uuid
  `;
}

export async function saveEventConfigVersion(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    schemaVersion?: number;
    payload: Record<string, unknown>;
  },
): Promise<ConfigVersionResult> {
  if (!input.payload || Array.isArray(input.payload)) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.CONFIG_PAYLOAD_REQUIRED,
      'Config payload must be an object',
    );
  }
  const raw =
    input.schemaVersion !== undefined && input.payload.schemaVersion === undefined
      ? { ...input.payload, schemaVersion: input.schemaVersion }
      : input.payload;
  const payload = requireValidConfigPayload(raw);

  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIG,
    eventId: input.eventId,
  });
  const event = await lockEvent(tx, input.tenantId, input.eventId);
  assertConfigMutable(event);

  await assertAssetsReadyForBrand(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    logoAssetId: payload.brand.logoAssetId,
    bannerAssetId: payload.brand.bannerAssetId,
  });

  const inserted = await tx.$queryRaw<Array<{ version: number }>>`
    INSERT INTO event_config_versions (
      tenant_id, event_id, version, schema_version, payload, author_user_id
    )
    SELECT
      ${input.tenantId}::uuid,
      ${input.eventId}::uuid,
      COALESCE(MAX(version), 0) + 1,
      ${payload.schemaVersion},
      ${JSON.stringify(payload)}::jsonb,
      ${input.actorUserId}::uuid
    FROM event_config_versions
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
    RETURNING version
  `;
  const version = inserted[0]?.version;
  if (!version) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.CONFIG_VERSION_NOT_FOUND,
      'Config version was not saved',
    );
  }
  return {
    eventId: input.eventId,
    version,
    schemaVersion: payload.schemaVersion,
    publishedAt: null,
  };
}

async function publishLockedVersion(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    version: number;
    event: LockedEvent;
    auditAction: string;
    auditMeta?: Record<string, unknown>;
  },
): Promise<PublishResult> {
  const rows = await tx.$queryRaw<
    Array<{
      version: number;
      schema_version: number;
      published_at: Date | null;
      payload: EventConfigPayload;
    }>
  >`
    SELECT version, schema_version, published_at, payload
    FROM event_config_versions
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND version = ${input.version}
    FOR UPDATE
  `;
  const version = rows[0];
  if (!version) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.CONFIG_VERSION_NOT_FOUND,
      'Config version not found',
    );
  }
  if (version.published_at) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ALREADY_PUBLISHED,
      'Config version is already published',
    );
  }
  if (!isSchemaCompatible(version.schema_version)) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.CONFIG_SCHEMA_UNSUPPORTED,
      `schemaVersion ${version.schema_version} is not supported`,
    );
  }
  const payload = requireValidConfigPayload(version.payload);
  const brandSnapshot = await resolveBrandSnapshot(
    tx,
    input.tenantId,
    input.eventId,
    payload.brand,
  );

  await tx.$executeRaw`
    UPDATE event_config_versions
    SET published_at = clock_timestamp()
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND version = ${input.version}
      AND published_at IS NULL
  `;
  const nextRevision = input.event.revision + 1;
  await tx.$executeRaw`
    UPDATE events
    SET status = 'PUBLISHED',
        content_status = 'PUBLISHED',
        published_config_version = ${input.version},
        published_brand_snapshot = ${JSON.stringify(brandSnapshot)}::jsonb,
        revision = ${nextRevision}
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.eventId}::uuid
  `;
  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type, resource_id,
      sanitized_diff
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.eventId}::uuid,
      gen_random_uuid(),
      ${input.actorUserId}::uuid,
      ${input.auditAction},
      'event_config_version',
      ${input.eventId}::uuid,
      ${JSON.stringify({
        version: input.version,
        ...(input.auditMeta ?? {}),
      })}::jsonb
    )
  `;
  return {
    eventId: input.eventId,
    status: 'PUBLISHED',
    publishedConfigVersion: input.version,
    revision: nextRevision,
    brandSnapshot,
  };
}

export async function publishEventConfig(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    expectedVersion: number;
  },
): Promise<PublishResult> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_PUBLISH,
    eventId: input.eventId,
  });
  const event = await lockEvent(tx, input.tenantId, input.eventId);
  assertConfigMutable(event);

  const latest = await tx.$queryRaw<Array<{ version: number }>>`
    SELECT MAX(version) AS version
    FROM event_config_versions
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
  `;
  if (latest[0]?.version !== input.expectedVersion) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.CONFIG_VERSION_MISMATCH,
      'expectedVersion is not the latest config version',
    );
  }

  return publishLockedVersion(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    version: input.expectedVersion,
    event,
    auditAction: 'event.publish',
  });
}

export async function listEventConfigVersions(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    cursor?: string | null;
    limit?: number;
  },
): Promise<ConfigVersionListPage> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIG,
    eventId: input.eventId,
  });
  const event = await lockEvent(tx, input.tenantId, input.eventId);
  void event;

  const limit = Math.min(
    Math.max(input.limit ?? CURSOR_PAGE_LIMIT.default, CURSOR_PAGE_LIMIT.min),
    CURSOR_PAGE_LIMIT.max,
  );
  let beforeVersion: number | null = null;
  if (input.cursor) {
    const parsed = Number.parseInt(input.cursor, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new ConfigError(
        CONFIG_ERROR_CODES.CONFIG_VERSION_NOT_FOUND,
        'Invalid history cursor',
      );
    }
    beforeVersion = parsed;
  }

  const rows = await tx.$queryRaw<
    Array<{
      version: number;
      schema_version: number;
      author_user_id: string;
      created_at: Date;
      published_at: Date | null;
    }>
  >`
    SELECT version, schema_version, author_user_id, created_at, published_at
    FROM event_config_versions
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND (${beforeVersion}::integer IS NULL OR version < ${beforeVersion}::integer)
    ORDER BY version DESC
    LIMIT ${limit + 1}
  `;
  const page = rows.slice(0, limit);
  const items: ConfigVersionSummary[] = page.map((row) => ({
    version: row.version,
    schemaVersion: row.schema_version,
    authorUserId: row.author_user_id,
    createdAt: row.created_at.toISOString(),
    published: row.published_at != null,
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
  }));
  const nextCursor =
    rows.length > limit ? String(page[page.length - 1]!.version) : null;
  return { items, nextCursor };
}

export async function previewEventConfigVersion(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    version: number;
  },
): Promise<ConfigPreviewResponse> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIG,
    eventId: input.eventId,
  });
  // Existence check (also scopes tenant/event).
  await lockEvent(tx, input.tenantId, input.eventId);

  const rows = await tx.$queryRaw<
    Array<{
      version: number;
      schema_version: number;
      payload: unknown;
    }>
  >`
    SELECT version, schema_version, payload
    FROM event_config_versions
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND version = ${input.version}
  `;
  const row = rows[0];
  if (!row) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.CONFIG_VERSION_NOT_FOUND,
      'Config version not found',
    );
  }

  let payload: EventConfigPayload;
  if (isSchemaCompatible(row.schema_version)) {
    try {
      payload = requireValidConfigPayload(row.payload);
    } catch {
      // Old/legacy stored payload: return sanitized best-effort object without
      // claiming typed validity for publish/rollback.
      payload = row.payload as EventConfigPayload;
    }
  } else {
    payload = row.payload as EventConfigPayload;
  }

  return {
    eventId: input.eventId,
    version: row.version,
    schemaVersion: row.schema_version,
    payload,
    cacheControl: 'no-store',
  };
}

export async function rollbackEventConfig(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    targetVersion: number;
    expectedPublishedVersion: number;
    expectedRevision: number;
    idempotencyKey: string;
  },
): Promise<ConfigRollbackResponse> {
  const clientKey = requireIdempotencyKey(input.idempotencyKey);
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_PUBLISH,
    eventId: input.eventId,
  });

  const requestHash = createHash('sha256')
    .update(
      JSON.stringify({
        tenantId: input.tenantId,
        eventId: input.eventId,
        targetVersion: input.targetVersion,
        expectedPublishedVersion: input.expectedPublishedVersion,
        expectedRevision: input.expectedRevision,
      }),
    )
    .digest('hex');

  const op = await beginOperation(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    command: CONFIG_ROLLBACK_COMMAND,
    clientKey,
    requestHash,
  });
  if (op.replayed && op.prior?.response_json) {
    return op.prior.response_json as unknown as ConfigRollbackResponse;
  }

  const event = await lockEvent(tx, input.tenantId, input.eventId);
  assertConfigMutable(event);

  if (event.revision !== input.expectedRevision) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.REVISION_CONFLICT,
      'expectedRevision does not match current event revision',
    );
  }
  if (event.published_config_version !== input.expectedPublishedVersion) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.CONFIG_VERSION_MISMATCH,
      'expectedPublishedVersion does not match live published version',
    );
  }

  const targetRows = await tx.$queryRaw<
    Array<{
      version: number;
      schema_version: number;
      payload: unknown;
    }>
  >`
    SELECT version, schema_version, payload
    FROM event_config_versions
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND version = ${input.targetVersion}
    FOR UPDATE
  `;
  const target = targetRows[0];
  if (!target) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.CONFIG_VERSION_NOT_FOUND,
      'Rollback target version not found',
    );
  }
  if (!isSchemaCompatible(target.schema_version)) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.CONFIG_INCOMPATIBLE,
      'Rollback target schema is not compatible',
    );
  }
  const payload = requireValidConfigPayload(target.payload);

  const inserted = await tx.$queryRaw<Array<{ version: number }>>`
    INSERT INTO event_config_versions (
      tenant_id, event_id, version, schema_version, payload, author_user_id
    )
    SELECT
      ${input.tenantId}::uuid,
      ${input.eventId}::uuid,
      COALESCE(MAX(version), 0) + 1,
      ${payload.schemaVersion},
      ${JSON.stringify(payload)}::jsonb,
      ${input.actorUserId}::uuid
    FROM event_config_versions
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
    RETURNING version
  `;
  const newVersion = inserted[0]?.version;
  if (!newVersion) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.CONFIG_VERSION_NOT_FOUND,
      'Rollback version was not created',
    );
  }

  // Re-lock after insert so publish sees fresh revision base (still same row).
  const eventAfter = await lockEvent(tx, input.tenantId, input.eventId);
  const published = await publishLockedVersion(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    version: newVersion,
    event: eventAfter,
    auditAction: 'event.config.rollback',
    auditMeta: { sourceVersion: input.targetVersion, newVersion },
  });

  const response: ConfigRollbackResponse = {
    newVersion,
    publishedVersion: published.publishedConfigVersion,
    sourceVersion: input.targetVersion,
    revision: published.revision,
    replayed: false,
  };
  await completeOperation(tx, {
    tenantId: input.tenantId,
    operationId: op.operationId,
    response,
  });
  return response;
}

export function newIdempotencyKey(): string {
  return randomUUID();
}
