/**
 * D8-S1 — Tenant branding read/update (RLS via withTenant; deny-by-default).
 */
import { randomUUID } from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import {
  BrandingError,
  BRANDING_ERROR_CODES,
} from './branding-error';
import {
  lockActiveMembershipForShare,
  requireTenantPermission,
} from './membership';

const HEX_COLOR = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const DEFAULT_PRIMARY_COLOR = '#0B3D2E';
const DISPLAY_NAME_MAX = 200;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TenantBrandingRecord = {
  tenantId: string;
  slug: string;
  displayName: string;
  primaryColor: string;
  secondaryColor: string | null;
  logoAssetId: string | null;
  version: number;
};

export type UpdateTenantBrandingInput = {
  tenantId: string;
  actorUserId: string;
  expectedVersion: number;
  displayName?: string;
  primaryColor?: string;
  secondaryColor?: string | null;
  logoAssetId?: string | null;
};

type TenantBrandingRow = {
  id: string;
  slug: string;
  name: string;
  display_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_asset_id: string | null;
  version: number;
};

function mapRow(row: TenantBrandingRow): TenantBrandingRecord {
  const display =
    row.display_name?.trim() || row.name?.trim() || 'Organization';
  return {
    tenantId: row.id,
    slug: row.slug,
    displayName: display,
    primaryColor: row.primary_color?.trim() || DEFAULT_PRIMARY_COLOR,
    secondaryColor: row.secondary_color?.trim() || null,
    logoAssetId: row.logo_asset_id,
    version: row.version,
  };
}

function assertHexColor(field: string, value: string): string {
  const trimmed = value.trim();
  if (!HEX_COLOR.test(trimmed)) {
    throw new BrandingError(
      BRANDING_ERROR_CODES.INVALID_INPUT,
      `${field} must be #RGB/#RRGGBB/#RRGGBBAA hex`,
    );
  }
  return trimmed;
}

function assertDisplayName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > DISPLAY_NAME_MAX) {
    throw new BrandingError(
      BRANDING_ERROR_CODES.INVALID_INPUT,
      `displayName length must be 1–${DISPLAY_NAME_MAX}`,
    );
  }
  // Reject C0 controls (except TAB/LF/CR) and angle brackets — charCodes avoid
  // eslint no-control-regex on a literal character class.
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    const isDisallowedControl =
      code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d;
    if (isDisallowedControl || code === 0x3c || code === 0x3e) {
      throw new BrandingError(
        BRANDING_ERROR_CODES.INVALID_INPUT,
        'displayName contains disallowed characters',
      );
    }
  }
  return trimmed;
}

async function lockTenantBranding(
  tx: Prisma.TransactionClient,
  tenantId: string,
  forUpdate: boolean,
): Promise<TenantBrandingRow> {
  const rows = forUpdate
    ? await tx.$queryRaw<TenantBrandingRow[]>`
        SELECT id, slug, name, display_name, primary_color, secondary_color,
               logo_asset_id, version
        FROM tenants
        WHERE id = ${tenantId}::uuid
        FOR UPDATE
      `
    : await tx.$queryRaw<TenantBrandingRow[]>`
        SELECT id, slug, name, display_name, primary_color, secondary_color,
               logo_asset_id, version
        FROM tenants
        WHERE id = ${tenantId}::uuid
      `;
  const row = rows[0];
  if (!row) {
    throw new BrandingError(
      BRANDING_ERROR_CODES.TENANT_NOT_FOUND,
      'Tenant not found in tenant context',
    );
  }
  return row;
}

/**
 * GET branding — any active tenant membership; RLS isolates rows.
 * Deny-by-default when membership is missing/inactive.
 */
export async function getTenantBranding(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; actorUserId: string },
): Promise<TenantBrandingRecord> {
  await lockActiveMembershipForShare(tx, input.tenantId, input.actorUserId);
  const row = await lockTenantBranding(tx, input.tenantId, false);
  return mapRow(row);
}

/**
 * Admin update — requires tenant.profile (Owner). Optimistic concurrency on version.
 */
export async function updateTenantBranding(
  tx: Prisma.TransactionClient,
  input: UpdateTenantBrandingInput,
): Promise<TenantBrandingRecord> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: 'tenant.profile',
  });

  const row = await lockTenantBranding(tx, input.tenantId, true);
  if (row.version !== input.expectedVersion) {
    throw new BrandingError(
      BRANDING_ERROR_CODES.STALE_VERSION,
      'Stale tenant branding version',
    );
  }

  let displayName = row.display_name;
  let primaryColor = row.primary_color;
  let secondaryColor = row.secondary_color;
  let logoAssetId = row.logo_asset_id;

  if (input.displayName !== undefined) {
    displayName = assertDisplayName(input.displayName);
  }
  if (input.primaryColor !== undefined) {
    primaryColor = assertHexColor('primaryColor', input.primaryColor);
  }
  if (input.secondaryColor !== undefined) {
    if (input.secondaryColor === null || input.secondaryColor.trim() === '') {
      secondaryColor = null;
    } else {
      secondaryColor = assertHexColor('secondaryColor', input.secondaryColor);
    }
  }
  if (input.logoAssetId !== undefined) {
    if (input.logoAssetId === null || input.logoAssetId.trim() === '') {
      logoAssetId = null;
    } else {
      const id = input.logoAssetId.trim();
      if (!UUID_RE.test(id)) {
        throw new BrandingError(
          BRANDING_ERROR_CODES.INVALID_INPUT,
          'logoAssetId must be a UUID',
        );
      }
      logoAssetId = id;
    }
  }

  const nextVersion = row.version + 1;
  await tx.$executeRaw`
    UPDATE tenants
    SET display_name = ${displayName},
        primary_color = ${primaryColor},
        secondary_color = ${secondaryColor},
        logo_asset_id = ${logoAssetId}::uuid,
        version = ${nextVersion},
        updated_at = now()
    WHERE id = ${input.tenantId}::uuid
  `;

  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, id, actor_user_id, action, resource_type, resource_id,
      sanitized_diff
    ) VALUES (
      ${input.tenantId}::uuid,
      ${randomUUID()}::uuid,
      ${input.actorUserId}::uuid,
      'tenant.branding.update',
      'tenant',
      ${input.tenantId}::uuid,
      ${JSON.stringify({
        version: nextVersion,
        hasDisplayName: displayName != null,
        hasPrimaryColor: primaryColor != null,
        hasSecondaryColor: secondaryColor != null,
        hasLogo: logoAssetId != null,
      })}::jsonb
    )
  `;

  return mapRow({
    ...row,
    display_name: displayName,
    primary_color: primaryColor,
    secondary_color: secondaryColor,
    logo_asset_id: logoAssetId,
    version: nextVersion,
  });
}
