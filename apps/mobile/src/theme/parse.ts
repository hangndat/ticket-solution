import type { TenantBrandingDto } from './types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Accept #RGB / #RRGGBB / #RRGGBBAA (case-insensitive). Returns lowercase hex or null.
 * Matches BE tenant color check; never invents a color.
 */
export function normalizeHexColor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const short = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (short) {
    const [r, g, b] = short[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const full = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  if (full) return `#${full[1]}`.toLowerCase();
  const alpha = /^#([0-9a-fA-F]{8})$/.exec(trimmed);
  if (alpha) return `#${alpha[1]}`.toLowerCase();
  return null;
}

/**
 * http(s) absolute or root-relative path. Rejects data:/javascript:/protocol-relative.
 */
export function normalizeAssetUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return undefined;
  if (trimmed.startsWith('/')) {
    if (
      trimmed.startsWith('//') ||
      trimmed.includes('\\') ||
      trimmed.includes('..')
    ) {
      return undefined;
    }
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function nonEmptyString(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Defensive parse of branding API JSON (BE auth DTO + public/flexible DTO).
 * Returns null when no usable tenant signal — caller falls back to Vemoki.
 */
export function parseTenantBranding(value: unknown): TenantBrandingDto | null {
  if (!isRecord(value)) return null;

  const tenantSlug =
    nonEmptyString(value.tenantSlug) ?? nonEmptyString(value.slug);
  const organizationName =
    nonEmptyString(value.organizationName) ??
    nonEmptyString(value.displayName) ??
    nonEmptyString(value.name);
  const primaryColor = normalizeHexColor(value.primaryColor);
  const secondaryRaw = value.secondaryColor;
  const secondaryColor =
    secondaryRaw === null || secondaryRaw === undefined
      ? null
      : normalizeHexColor(secondaryRaw);
  const logoUrl = normalizeAssetUrl(value.logoUrl);
  const logoAssetId = nonEmptyString(value.logoAssetId) ?? null;
  const tenantId = nonEmptyString(value.tenantId);
  const wordmark = nonEmptyString(value.wordmark);
  const signalGlyph =
    typeof value.signalGlyph === 'string'
      ? value.signalGlyph.trim().slice(0, 8)
      : undefined;
  const brandVersion =
    typeof value.version === 'number' &&
    Number.isFinite(value.version) &&
    value.version >= 0
      ? Math.floor(value.version)
      : typeof value.brandVersion === 'number' &&
          Number.isFinite(value.brandVersion) &&
          value.brandVersion >= 0
        ? Math.floor(value.brandVersion)
        : undefined;

  const hasTenantSignal =
    Boolean(tenantSlug) ||
    Boolean(organizationName) ||
    Boolean(primaryColor) ||
    Boolean(secondaryColor) ||
    Boolean(logoUrl) ||
    Boolean(logoAssetId) ||
    Boolean(tenantId);

  if (!hasTenantSignal) return null;

  // Need a display name + color to drive chrome safely (BE always sends both).
  if (!organizationName || !primaryColor) return null;

  return {
    organizationName,
    primaryColor,
    secondaryColor,
    ...(tenantSlug ? { tenantSlug } : {}),
    ...(tenantId ? { tenantId } : {}),
    ...(logoUrl ? { logoUrl } : {}),
    logoAssetId,
    ...(wordmark ? { wordmark } : {}),
    ...(signalGlyph !== undefined ? { signalGlyph } : {}),
    ...(brandVersion !== undefined ? { brandVersion } : {}),
  };
}
