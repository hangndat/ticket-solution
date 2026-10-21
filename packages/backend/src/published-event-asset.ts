/**
 * Stream a READY published event asset (fail-closed; no auth).
 */
import type { EventBrandSnapshot } from '@ticket/contracts';
import type { PrismaClient } from './generated/prisma/client';
import {
  isValidPublicEventSlug,
  isValidPublicTenantSlug,
} from './published-events';
import { getObject, requireMinioConfig, type MinioConfig } from './minio';

export type PublishedEventAssetResult =
  | {
      ok: true;
      body: Buffer;
      contentType: string;
      cacheControl: string;
    }
  | { ok: false; reason: 'not_found' | 'misconfigured' };

export async function readPublishedEventAsset(
  db: PrismaClient,
  input: {
    tenantSlug: string;
    eventSlug: string;
    assetId: string;
    minio?: MinioConfig;
  },
): Promise<PublishedEventAssetResult> {
  const tenantSlug = input.tenantSlug.trim().toLowerCase();
  const eventSlug = input.eventSlug.trim().toLowerCase();
  if (!isValidPublicTenantSlug(tenantSlug) || !isValidPublicEventSlug(eventSlug)) {
    return { ok: false, reason: 'not_found' };
  }

  const meta = await db.$queryRaw<
    Array<{
      tenant_id: string;
      event_id: string;
      published_brand_snapshot: EventBrandSnapshot | null;
      payload: { brand?: EventBrandSnapshot } | null;
    }>
  >`
    SELECT e.tenant_id, e.id AS event_id, e.published_brand_snapshot, v.payload
    FROM events e
    INNER JOIN tenants t ON t.id = e.tenant_id
    INNER JOIN event_config_versions v
      ON v.tenant_id = e.tenant_id
     AND v.event_id = e.id
     AND v.version = e.published_config_version
     AND v.published_at IS NOT NULL
    WHERE t.slug = ${tenantSlug}
      AND e.slug = ${eventSlug}
      AND e.visibility = 'PUBLIC'
      AND e.content_status = 'PUBLISHED'
      AND e.business_status = 'ACTIVE'
      AND e.published_config_version IS NOT NULL
    LIMIT 1
  `;
  const rowMeta = meta[0];
  if (!rowMeta) return { ok: false, reason: 'not_found' };

  const snap = rowMeta.published_brand_snapshot;
  const payloadBrand = rowMeta.payload?.brand;
  const logoId = snap?.logoAssetId ?? payloadBrand?.logoAssetId;
  const bannerId = snap?.bannerAssetId ?? payloadBrand?.bannerAssetId;
  const allowed = new Set(
    [logoId, bannerId].filter((id): id is string => typeof id === 'string'),
  );
  if (!allowed.has(input.assetId)) {
    return { ok: false, reason: 'not_found' };
  }

  let minio: MinioConfig;
  try {
    minio = input.minio ?? requireMinioConfig(process.env);
  } catch {
    return { ok: false, reason: 'misconfigured' };
  }

  const rows = await db.$queryRaw<
    Array<{ ready_key: string; content_type: string }>
  >`
    SELECT ea.ready_key, ea.content_type
    FROM event_assets ea
    INNER JOIN tenants t ON t.id = ea.tenant_id
    INNER JOIN events e ON e.tenant_id = ea.tenant_id AND e.id = ea.event_id
    WHERE t.slug = ${tenantSlug}
      AND e.slug = ${eventSlug}
      AND ea.id = ${input.assetId}::uuid
      AND ea.status = 'READY'
      AND ea.ready_key IS NOT NULL
    LIMIT 1
  `;
  const row = rows[0];
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
