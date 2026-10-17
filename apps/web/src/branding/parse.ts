import type { TenantBranding, TenantBrandingDto } from './types';
import { VEMOKI_BRANDING } from './vemoki';

/** Allowlisted hex: #RGB / #RRGGBB / #RRGGBBAA (matches BE tenant color chk). */
const HEX_COLOR =
  /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

const MAX_NAME = 200;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function parseHex(value: unknown): string | null {
  const s = asTrimmedString(value);
  if (!s || !HEX_COLOR.test(s)) return null;
  return s;
}

/**
 * Fail-closed logo URL: https absolute or root-relative path only.
 * Rejects javascript:, data:, and protocol-relative //evil.
 */
export function sanitizeLogoUrl(value: unknown): string | null {
  const s = asTrimmedString(value);
  if (!s || s.length > 2048) return null;
  if (s.startsWith('/')) {
    if (s.startsWith('//') || s.includes('\\') || s.includes('..')) return null;
    return s;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function clampName(value: string): string {
  return value.length > MAX_NAME ? value.slice(0, MAX_NAME) : value;
}

/**
 * Parse upstream / BFF branding JSON into a safe TenantBranding.
 * Invalid / empty payload → null (caller applies Vemoki fallback).
 */
export function parseTenantBranding(
  raw: unknown,
  fallback: TenantBranding = VEMOKI_BRANDING,
): TenantBranding | null {
  const body = asRecord(raw);
  if (!body) return null;

  const displayNameRaw =
    asTrimmedString(body.displayName) ?? asTrimmedString(body.organizationName);
  const wordmarkRaw =
    asTrimmedString(body.wordmark) ?? displayNameRaw ?? null;
  const primary = parseHex(body.primaryColor);
  const secondary = parseHex(body.secondaryColor);
  const logoUrl = sanitizeLogoUrl(body.logoUrl);
  const logoAssetId = asTrimmedString(body.logoAssetId);
  const tenantSlug = asTrimmedString(body.tenantSlug);
  const signalGlyph =
    typeof body.signalGlyph === 'string'
      ? body.signalGlyph.trim().slice(0, 8)
      : fallback.signalGlyph;

  // Need at least one tenant-specific signal to treat as tenant branding.
  const hasTenantSignal =
    Boolean(displayNameRaw) ||
    Boolean(primary) ||
    Boolean(secondary) ||
    Boolean(logoUrl) ||
    Boolean(logoAssetId) ||
    Boolean(tenantSlug);

  if (!hasTenantSignal) return null;

  const displayName = clampName(displayNameRaw ?? fallback.displayName);
  const wordmark = clampName(
    (wordmarkRaw ?? displayName).toLocaleLowerCase('vi-VN'),
  );
  const signal = primary ?? fallback.colors.signal;
  const focus = secondary ?? fallback.colors.focus;

  return {
    wordmark,
    displayName,
    signalGlyph,
    colors: {
      ink: fallback.colors.ink,
      paper: fallback.colors.paper,
      signal,
      focus,
    },
    primaryColor: primary ?? signal,
    secondaryColor: secondary,
    logoUrl,
    logoAssetId,
    source: 'tenant',
    tenantSlug,
  };
}

/** Map demo / event brand snapshot onto chrome tokens (keeps D6 event themes). */
export function brandingFromEventBrand(
  brand: { primaryColor: string; organizationName: string },
  tenantSlug: string,
): TenantBranding {
  const primary = parseHex(brand.primaryColor) ?? VEMOKI_BRANDING.colors.signal;
  const name = clampName(
    brand.organizationName.trim() || VEMOKI_BRANDING.displayName,
  );
  return {
    wordmark: name.toLocaleLowerCase('vi-VN'),
    displayName: name,
    signalGlyph: VEMOKI_BRANDING.signalGlyph,
    colors: {
      ink: VEMOKI_BRANDING.colors.ink,
      paper: VEMOKI_BRANDING.colors.paper,
      signal: primary,
      focus: VEMOKI_BRANDING.colors.focus,
    },
    primaryColor: primary,
    secondaryColor: null,
    logoUrl: null,
    logoAssetId: null,
    source: 'demo-event',
    tenantSlug,
  };
}

/** Normalize DTO object for tests / BFF responses. */
export function toBrandingDto(b: TenantBranding): TenantBrandingDto {
  return {
    tenantSlug: b.tenantSlug,
    displayName: b.displayName,
    wordmark: b.wordmark,
    primaryColor: b.primaryColor,
    secondaryColor: b.secondaryColor,
    logoUrl: b.logoUrl,
    logoAssetId: b.logoAssetId,
    signalGlyph: b.signalGlyph,
  };
}
