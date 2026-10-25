/**
 * sRGB channel mix — mirrors CSS `color-mix(in srgb, A p%, B)`.
 */
export function colorMixInSrgb(
  hexA: string,
  hexB: string,
  weightA: number,
): string {
  const a = parseHexRgb(hexA);
  const b = parseHexRgb(hexB);
  const w = Math.min(1, Math.max(0, weightA));
  const mix = (ca: number, cb: number) =>
    Math.round(ca * w + cb * (1 - w));
  return rgbToHex(mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b));
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.trim().replace(/^#/, '');
  if (normalized.length !== 6) {
    throw new Error(`colorMixInSrgb: expected #RRGGBB, got ${hex}`);
  }
  const n = Number.parseInt(normalized, 16);
  return {
    r: (n >> 16) & 0xff,
    g: (n >> 8) & 0xff,
    b: n & 0xff,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (c: number) => c.toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
