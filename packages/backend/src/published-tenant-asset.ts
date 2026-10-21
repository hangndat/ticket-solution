/**
 * Stream a READY tenant branding asset (org logo — fail-closed; no auth).
 */
import type { PrismaClient } from './generated/prisma/client';
import {
  isValidPublicTenantSlug,
  resolveActiveTenantBySlug,
} from './published-events';
import { getObject, requireMinioConfig, type MinioConfig } from './minio';
import { withTenant } from './tenant-context';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PublishedTenantAssetResult =
  | {
      ok: true;
      body: Buffer;
      contentType: string;
      cacheControl: string;
    }
  | { ok: false; reason: 'not_found' | 'misconfigured' };

export async function readPublishedTenantAsset(
  db: PrismaClient,
  input: {
    tenantSlug: string;
    assetId: string;
    minio?: MinioConfig;
  },
): Promise<PublishedTenantAssetResult> {
  const tenantSlug = input.tenantSlug.trim().toLowerCase();
  if (!isValidPublicTenantSlug(tenantSlug) || !UUID_RE.test(input.assetId)) {
    return { ok: false, reason: 'not_found' };
  }

  const tenant = await resolveActiveTenantBySlug(db, tenantSlug);
  if (!tenant) return { ok: false, reason: 'not_found' };

  const allowed = await withTenant(db, tenant.id, async (tx) => {
    const rows = await tx.$queryRaw<Array<{ logo_asset_id: string | null }>>`
      SELECT logo_asset_id
      FROM tenants
      WHERE id = ${tenant.id}::uuid
      LIMIT 1
    `;
    const logoId = rows[0]?.logo_asset_id;
    return logoId === input.assetId;
  });
  if (!allowed) return { ok: false, reason: 'not_found' };

  let minio: MinioConfig;
  try {
    minio = input.minio ?? requireMinioConfig(process.env);
  } catch {
    return { ok: false, reason: 'misconfigured' };
  }

  const row = await withTenant(db, tenant.id, async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ ready_key: string; content_type: string }>
    >`
      SELECT ready_key, content_type
      FROM tenant_assets
      WHERE tenant_id = ${tenant.id}::uuid
        AND id = ${input.assetId}::uuid
        AND status = 'READY'
        AND ready_key IS NOT NULL
      LIMIT 1
    `;
    return rows[0];
  });

  if (!row?.ready_key || !row.content_type) {
    return { ok: false, reason: 'not_found' };
  }

  try {
    const body = await getObject(minio, row.ready_key);
    return {
      ok: true,
      body,
      contentType: row.content_type,
      cacheControl: 'public, max-age=300',
    };
  } catch {
    return { ok: false, reason: 'not_found' };
  }
}
