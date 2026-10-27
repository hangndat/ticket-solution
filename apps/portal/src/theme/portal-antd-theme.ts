import type { ThemeConfig } from 'antd';

/** Ant Design seed `#1677ff` is ~4.0:1 on white — below WCAG 2 AA for normal text. */
export const PORTAL_AA_PRIMARY = '#0958d9';
export const PORTAL_AA_TEXT_SECONDARY = 'rgba(0, 0, 0, 0.75)';
export const PORTAL_AA_TEXT_TERTIARY = 'rgba(0, 0, 0, 0.65)';

/**
 * Keep Ant Design hue; darken text/link tokens so guests/shell meet 4.5:1.
 * Not a Vemoki brand restyle (O26: portal stays on antd defaults + AA floor).
 */
export const PORTAL_ANTD_THEME = {
  token: {
    colorPrimary: PORTAL_AA_PRIMARY,
    colorInfo: PORTAL_AA_PRIMARY,
    colorLink: PORTAL_AA_PRIMARY,
    colorLinkHover: '#003eb3',
    colorTextSecondary: PORTAL_AA_TEXT_SECONDARY,
    colorTextTertiary: PORTAL_AA_TEXT_TERTIARY,
    colorTextQuaternary: PORTAL_AA_TEXT_TERTIARY,
    colorTextPlaceholder: PORTAL_AA_TEXT_TERTIARY,
    colorTextDescription: PORTAL_AA_TEXT_TERTIARY,
    colorTextDisabled: 'rgba(0, 0, 0, 0.55)',
  },
} satisfies ThemeConfig;

export function srgbChannel(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hexOrRgba: string, onWhite = true): number {
  const rgba = parseCssColor(hexOrRgba);
  const r = onWhite ? rgba.r * rgba.a + 255 * (1 - rgba.a) : rgba.r;
  const g = onWhite ? rgba.g * rgba.a + 255 * (1 - rgba.a) : rgba.g;
  const b = onWhite ? rgba.b * rgba.a + 255 * (1 - rgba.a) : rgba.b;
  return (
    0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
  );
}

export function contrastRatio(fg: string, bg = '#ffffff'): number {
  const l1 = relativeLuminance(fg, bg.toLowerCase() === '#ffffff');
  const l2 = relativeLuminance(bg, false);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseCssColor(value: string): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  const trimmed = value.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(trimmed);
  if (hex) {
    const n = Number.parseInt(hex[1]!, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba =
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i.exec(
      trimmed,
    );
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  throw new Error(`unsupported color: ${value}`);
}
