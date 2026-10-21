/**
 * Epic #686 — prod media manifest (`brand/prod/manifest.json`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ProdMediaAssetDef = {
  role: string;
  assetId: string;
  source: string;
  contentType: string;
  extension: string;
  widthPx?: number;
  heightPx?: number;
  ogShare?: boolean;
};

export type ProdMediaEventDef = {
  slug: string;
  eventId: string;
  assets: ProdMediaAssetDef[];
};

export type ProdMediaTenantDef = {
  slug: string;
  tenantId: string;
  tenantBrand?: {
    primaryColor?: string;
    organizationName?: string;
    logo?: ProdMediaAssetDef;
  };
  events: ProdMediaEventDef[];
};

export type ProdMediaManifest = {
  tenants: ProdMediaTenantDef[];
};

export function prodMediaManifestPath(repoRoot?: string): string {
  const root = repoRoot?.trim() || process.env.PROD_REPO_ROOT?.trim() || process.cwd();
  return join(root, 'brand/prod/manifest.json');
}

export function loadProdMediaManifest(repoRoot?: string): ProdMediaManifest {
  const raw = readFileSync(prodMediaManifestPath(repoRoot), 'utf8');
  return JSON.parse(raw) as ProdMediaManifest;
}

export function readyObjectKey(
  tenantId: string,
  eventId: string,
  assetId: string,
  extension: string,
): string {
  return `tenants/${tenantId}/events/${eventId}/assets/ready/${assetId}.${extension}`;
}

export function findTenantManifest(
  manifest: ProdMediaManifest,
  tenantId: string,
): ProdMediaTenantDef | undefined {
  return manifest.tenants.find((t) => t.tenantId === tenantId);
}

export function findEventManifest(
  manifest: ProdMediaManifest,
  eventId: string,
): { tenant: ProdMediaTenantDef; event: ProdMediaEventDef } | undefined {
  for (const tenant of manifest.tenants) {
    const event = tenant.events.find((e) => e.eventId === eventId);
    if (event) return { tenant, event };
  }
  return undefined;
}

export function eventBrandAssetIds(
  manifest: ProdMediaManifest,
  tenantId: string,
  eventId: string,
): { logoAssetId?: string; bannerAssetId?: string } {
  const tenant = findTenantManifest(manifest, tenantId);
  const event = tenant?.events.find((e) => e.eventId === eventId);
  if (!event) return {};
  const logo = event.assets.find((a) => a.role === 'logo');
  const banner = event.assets.find((a) => a.role === 'banner');
  return {
    ...(logo ? { logoAssetId: logo.assetId } : {}),
    ...(banner ? { bannerAssetId: banner.assetId } : {}),
  };
}

/** First published event on tenant — anchor for org-level logo object + event_assets row. */
export function tenantBrandingAnchorEventId(
  manifest: ProdMediaManifest,
  tenantId: string,
): string | null {
  const tenant = findTenantManifest(manifest, tenantId);
  return tenant?.events[0]?.eventId ?? null;
}

export function tenantOrgLogoAsset(
  manifest: ProdMediaManifest,
  tenantId: string,
): ProdMediaAssetDef | undefined {
  return findTenantManifest(manifest, tenantId)?.tenantBrand?.logo;
}
