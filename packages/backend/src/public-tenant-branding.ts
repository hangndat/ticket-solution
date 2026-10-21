/**
 * Public tenant branding (unauthenticated chrome — D8 / Epic #686 logoUrl).
 */
import type { PublicTenantBranding } from '@ticket/contracts';
import type { PrismaClient } from './generated/prisma/client';
import {
  readPublishedAssetPublicBase,
  resolveTenantLogoPublicUrl,
} from './published-asset-url';
import {
  isValidPublicTenantSlug,
  resolveActiveTenantBySlug,
} from './published-events';
import { withTenant } from './tenant-context';

const DEFAULT_PRIMARY = '#0B3D2E';

type BrandingRow = {
  slug: string;
  display_name: string | null;
  name: string;
  primary_color: string | null;
  secondary_color: string | null;
  logo_asset_id: string | null;
};

/**
 * GET /v1/public/tenants/:slug/branding — unknown/inactive tenant → null (404).
 */
export async function getPublicTenantBranding(
  db: PrismaClient,
  tenantSlug: string,
): Promise<PublicTenantBranding | null> {
  const slug = tenantSlug.trim().toLowerCase();
  if (!isValidPublicTenantSlug(slug)) return null;
  const tenant = await resolveActiveTenantBySlug(db, slug);
  if (!tenant) return null;

  return withTenant(db, tenant.id, async (tx) => {
    const rows = await tx.$queryRaw<BrandingRow[]>`
      SELECT slug, display_name, name, primary_color, secondary_color, logo_asset_id
      FROM tenants
      WHERE id = ${tenant.id}::uuid
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;

    const displayName =
      row.display_name?.trim() || row.name?.trim() || 'Organization';
    const primaryColor = row.primary_color?.trim() || DEFAULT_PRIMARY;
    const secondaryColor = row.secondary_color?.trim() || null;
    const logoAssetId = row.logo_asset_id;

    const publicBase = readPublishedAssetPublicBase();
    const logoUrl = await resolveTenantLogoPublicUrl(tx, {
      publicBase,
      tenantId: tenant.id,
      tenantSlug: row.slug,
      logoAssetId,
    });

    return {
      tenantSlug: row.slug,
      displayName,
      primaryColor,
      secondaryColor,
      logoAssetId,
      ...(logoUrl ? { logoUrl } : {}),
    };
  });
}
