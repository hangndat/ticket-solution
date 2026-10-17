import type { Prisma } from './generated/prisma/client';
import { ConfigError, CONFIG_ERROR_CODES } from './config-error';
import { requireTenantPermission } from './membership';

const PERMISSION_CONFIG = 'event.config';
const PERMISSION_PUBLISH = 'event.publish';

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
};

async function lockEvent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
): Promise<{
  id: string;
  status: string;
  content_status: string;
  business_status: string;
  published_config_version: number | null;
}> {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      status: string;
      content_status: string;
      business_status: string;
      published_config_version: number | null;
    }>
  >`
    SELECT id, status, content_status, business_status, published_config_version
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

function assertConfigMutable(event: {
  status: string;
  content_status: string;
  business_status: string;
}): void {
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
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIG,
    eventId: input.eventId,
  });
  const event = await lockEvent(tx, input.tenantId, input.eventId);
  assertConfigMutable(event);
  const schemaVersion = input.schemaVersion ?? 1;
  const inserted = await tx.$queryRaw<Array<{ version: number }>>`
    INSERT INTO event_config_versions (
      tenant_id, event_id, version, schema_version, payload, author_user_id
    )
    SELECT
      ${input.tenantId}::uuid,
      ${input.eventId}::uuid,
      COALESCE(MAX(version), 0) + 1,
      ${schemaVersion},
      ${JSON.stringify(input.payload)}::jsonb,
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
    schemaVersion,
    publishedAt: null,
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
  const rows = await tx.$queryRaw<
    Array<{ version: number; published_at: Date | null }>
  >`
    SELECT version, published_at
    FROM event_config_versions
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND version = ${input.expectedVersion}
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
  await tx.$executeRaw`
    UPDATE event_config_versions
    SET published_at = clock_timestamp()
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND version = ${input.expectedVersion}
      AND published_at IS NULL
  `;
  await tx.$executeRaw`
    UPDATE events
    SET status = 'PUBLISHED',
        content_status = 'PUBLISHED',
        published_config_version = ${input.expectedVersion}
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.eventId}::uuid
  `;
  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type, resource_id
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.eventId}::uuid,
      gen_random_uuid(),
      ${input.actorUserId}::uuid,
      'event.publish',
      'event_config_version',
      ${input.eventId}::uuid
    )
  `;
  return {
    eventId: input.eventId,
    status: 'PUBLISHED',
    publishedConfigVersion: input.expectedVersion,
  };
}
