/**
 * Epic #686 — prod media manifest (`brand/prod/manifest.json`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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
  /** Tenant-level logo (Epic #686); preferred over tenantBrand.logo when set. */
  logo?: ProdMediaAssetDef;
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

function resolveRepoRoot(repoRoot?: string): string {
  const explicit = repoRoot?.trim() || process.env.PROD_REPO_ROOT?.trim();
  if (explicit) return explicit;
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'brand/prod/manifest.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function prodMediaManifestPath(repoRoot?: string): string {
  return join(resolveRepoRoot(repoRoot), 'brand/prod/manifest.json');
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

/** Org logo object key — no event anchor (Mekong / tenant chrome). */
export function tenantReadyObjectKey(
  tenantId: string,
  assetId: string,
  extension: string,
): string {
  return `tenants/${tenantId}/assets/ready/${assetId}.${extension}`;
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
  const tenant = findTenantManifest(manifest, tenantId);
  if (!tenant) return undefined;
  return tenant.logo ?? tenant.tenantBrand?.logo;
}
