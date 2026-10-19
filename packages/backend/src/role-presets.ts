import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from './generated/prisma/client';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';
import {
  assertCatalogPermissions,
  isPresetId,
  ROLE_SCHEMA_VERSION,
} from './role-map';
import { withTenant } from './tenant-context';
import { requireTenantPermission } from './membership';
import {
  assertTenantAllowsAdminMutation,
  lockTenantPolicyForUpdate,
} from './tenant-policy';

export type RolePresetRecord = {
  presetId: string;
  tenantId: string | null;
  name: string;
  schemaVersion: number;
  tenantPermissions: string[];
  eventPermissions: string[];
  createdAt: string;
};

function mapPreset(row: {
  id: string;
  tenant_id: string | null;
  name: string;
  schema_version: number;
  tenant_permissions: string[];
  event_permissions: string[];
  created_at: Date;
}): RolePresetRecord {
  return {
    presetId: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    schemaVersion: row.schema_version,
    tenantPermissions: row.tenant_permissions ?? [],
    eventPermissions: row.event_permissions ?? [],
    createdAt: row.created_at.toISOString(),
  };
}

function normalizePerms(input: string[] | undefined): string[] {
  const raw = input ?? [];
  const dedup = [...new Set(raw.map((p) => p.trim()).filter(Boolean))];
  try {
    assertCatalogPermissions(dedup);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    const unknown = msg.startsWith('unknown_permission:')
      ? msg.slice('unknown_permission:'.length)
      : 'unknown';
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      `Permission not in catalog: ${unknown}`,
    );
  }
  return dedup;
}

export async function createRolePreset(
  db: PrismaClient,
  input: {
    tenantId: string;
    actorUserId: string;
    name: string;
    tenantPermissions?: string[];
    eventPermissions?: string[];
  },
): Promise<RolePresetRecord> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 120) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'name must be 1..120 chars',
    );
  }
  const tenantPermissions = normalizePerms(input.tenantPermissions);
  const eventPermissions = normalizePerms(input.eventPermissions);

  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: 'members.manage',
    });
    const policy = await lockTenantPolicyForUpdate(tx, input.tenantId);
    assertTenantAllowsAdminMutation(policy.status);

    const presetId = randomUUID();
    try {
      await tx.$executeRaw`
        INSERT INTO role_presets (
          id, tenant_id, name, schema_version,
          tenant_permissions, event_permissions, created_at
        ) VALUES (
          ${presetId}::uuid, ${input.tenantId}::uuid, ${name},
          ${ROLE_SCHEMA_VERSION},
          ${tenantPermissions}::text[], ${eventPermissions}::text[], now()
        )
      `;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (/role_presets_tenant_name_unique|unique/i.test(msg)) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.INVALID_INPUT,
          'Preset name already exists',
        );
      }
      throw error;
    }

    const rows = await tx.$queryRaw<
      {
        id: string;
        tenant_id: string | null;
        name: string;
        schema_version: number;
        tenant_permissions: string[];
        event_permissions: string[];
        created_at: Date;
      }[]
    >`
      SELECT id, tenant_id, name, schema_version,
             tenant_permissions, event_permissions, created_at
      FROM role_presets WHERE id = ${presetId}::uuid
    `;
    if (!rows[0]) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.DEPENDENCY_UNAVAILABLE,
        'Preset create failed',
      );
    }
    return mapPreset(rows[0]);
  });
}

export async function listRolePresets(
  db: PrismaClient,
  input: { tenantId: string; actorUserId: string },
): Promise<RolePresetRecord[]> {
  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: 'members.manage',
    });
    const rows = await tx.$queryRaw<
      {
        id: string;
        tenant_id: string | null;
        name: string;
        schema_version: number;
        tenant_permissions: string[];
        event_permissions: string[];
        created_at: Date;
      }[]
    >`
      SELECT id, tenant_id, name, schema_version,
             tenant_permissions, event_permissions, created_at
      FROM role_presets
      ORDER BY tenant_id NULLS FIRST, lower(name), id
    `;
    return rows.map(mapPreset);
  });
}

/**
 * Resolve a preset visible in the tenant context.
 * Cross-tenant / missing → RESOURCE_NOT_FOUND (404 semantics).
 */
export async function getRolePreset(
  db: PrismaClient,
  input: { tenantId: string; actorUserId: string; presetId: string },
): Promise<RolePresetRecord> {
  if (!isPresetId(input.presetId)) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
      'Role preset not found',
    );
  }
  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: 'members.manage',
    });
    return loadPresetInTenant(tx, input.presetId);
  });
}

/** Internal: load preset under an open withTenant transaction (RLS applied). */
export async function loadPresetInTenant(
  tx: Prisma.TransactionClient,
  presetId: string,
): Promise<RolePresetRecord> {
  if (!isPresetId(presetId)) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
      'Role preset not found',
    );
  }
  const rows = await tx.$queryRaw<
    {
      id: string;
      tenant_id: string | null;
      name: string;
      schema_version: number;
      tenant_permissions: string[];
      event_permissions: string[];
      created_at: Date;
    }[]
  >`
    SELECT id, tenant_id, name, schema_version,
           tenant_permissions, event_permissions, created_at
    FROM role_presets WHERE id = ${presetId}::uuid
  `;
  if (!rows[0]) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
      'Role preset not found',
    );
  }
  return mapPreset(rows[0]);
}
