/**
 * Public URLs for published event raster assets (private MinIO behind GET proxy).
 */
import type { Prisma } from './generated/prisma/client';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readPublishedAssetPublicBase(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raw =
    env.PUBLISHED_ASSET_PUBLIC_BASE?.trim() ||
    env.API_PUBLIC_ORIGIN?.trim() ||
    env.PUBLIC_API_URL?.trim() ||
    'http://127.0.0.1:3100';
  return raw.replace(/\/$/, '');
}

export function publishedEventAssetPublicUrl(
  publicBase: string,
  tenantSlug: string,
  eventSlug: string,
  assetId: string,
): string {
  if (!UUID_RE.test(assetId)) return '';
  const base = publicBase.replace(/\/$/, '');
  return `${base}/v1/public/tenants/${encodeURIComponent(tenantSlug)}/events/${encodeURIComponent(eventSlug)}/assets/${encodeURIComponent(assetId)}`;
}

export function publishedTenantAssetPublicUrl(
  publicBase: string,
  tenantSlug: string,
  assetId: string,
): string {
  if (!UUID_RE.test(assetId)) return '';
  const base = publicBase.replace(/\/$/, '');
  return `${base}/v1/public/tenants/${encodeURIComponent(tenantSlug)}/assets/${encodeURIComponent(assetId)}`;
}

export async function resolveTenantLogoPublicUrl(
  tx: Prisma.TransactionClient,
  input: {
    publicBase: string;
    tenantId: string;
    tenantSlug: string;
    logoAssetId?: string | null;
  },
): Promise<string | undefined> {
  const assetId = input.logoAssetId?.trim();
  if (!assetId || !UUID_RE.test(assetId)) return undefined;
  const rows = await tx.$queryRaw<Array<{ status: string }>>`
    SELECT status
    FROM tenant_assets
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${assetId}::uuid
  `;
  const row = rows[0];
  if (!row || row.status !== 'READY') return undefined;
  const url = publishedTenantAssetPublicUrl(
    input.publicBase,
    input.tenantSlug,
    assetId,
  );
  return url || undefined;
}

export async function resolvePublishedBrandAssetUrls(
  tx: Prisma.TransactionClient,
  input: {
    publicBase: string;
    tenantId: string;
    tenantSlug: string;
    eventId: string;
    eventSlug: string;
    logoAssetId?: string;
    bannerAssetId?: string;
  },
): Promise<{ logoUrl?: string; bannerUrl?: string }> {
  const out: { logoUrl?: string; bannerUrl?: string } = {};
  for (const [field, assetId] of [
    ['logoUrl', input.logoAssetId],
    ['bannerUrl', input.bannerAssetId],
  ] as const) {
    if (!assetId || !UUID_RE.test(assetId)) continue;
    const rows = await tx.$queryRaw<Array<{ status: string; event_id: string }>>`
      SELECT status, event_id
      FROM event_assets
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${assetId}::uuid
    `;
    const row = rows[0];
    if (!row || row.event_id !== input.eventId || row.status !== 'READY') {
      continue;
    }
    const url = publishedEventAssetPublicUrl(
      input.publicBase,
      input.tenantSlug,
      input.eventSlug,
      assetId,
    );
    if (url) out[field] = url;
  }
  return out;
}
