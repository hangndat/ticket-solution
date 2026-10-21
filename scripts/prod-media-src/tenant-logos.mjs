/**
 * Epic #686 — distinct tenant marks + wordmarks (SVG strings).
 * Consumed by scripts/prod-media-build.mjs; sources mirrored under prod-media-src/{slug}/.
 */

export const INK = '#0B1220';
export const PAPER = '#F4F6F8';
export const SIGNAL = '#E11D48';

export const FONT =
  'DejaVu Sans, Liberation Sans, Helvetica, Arial, sans-serif';

/** @typedef {'luc-bao-live'|'saigon-pulse'|'heritage-hoi-an'|'mekong-makers'} TenantSlug */

/**
 * @type {Record<TenantSlug, { primary: string, accent: string, wordmark: string, tagline?: string, lockupCase: 'upper'|'title' }>}
 */
export const TENANT_META = {
  'luc-bao-live': {
    primary: '#1B4D3E',
    accent: '#245B47',
    wordmark: 'LỤC BẢO LIVE',
    tagline: 'INDIE · HÀ NỘI',
    lockupCase: 'upper',
  },
  'saigon-pulse': {
    primary: '#E85D04',
    accent: '#0D9488',
    wordmark: 'Saigon Pulse',
    tagline: 'NIGHT & ROOFTOP',
    lockupCase: 'title',
  },
  'heritage-hoi-an': {
    primary: '#8B4513',
    accent: '#6D28D9',
    wordmark: 'Di sản Hội An',
    tagline: 'PHỐ CỔ · LỄ HỘI',
    lockupCase: 'title',
  },
  'mekong-makers': {
    primary: '#2A6F97',
    accent: '#C2410C',
    wordmark: 'MEKONG MAKERS',
    tagline: 'DELTA · CRAFT',
    lockupCase: 'upper',
  },
};

export function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Unique mark geometry per tenant. Coordinates relative to square viewBox 0 0 100 100.
 * @param {TenantSlug} slug
 * @param {string} fill Primary stroke/fill
 * @param {string} accent Secondary accent
 */
export function markPaths(slug, fill, accent) {
  switch (slug) {
    case 'luc-bao-live':
      return `
        <path d="M50 12 L78 28 L78 58 L50 74 L22 58 L22 28 Z" fill="none" stroke="${fill}" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M50 26 L62 34 L62 50 L50 58 L38 50 L38 34 Z" fill="${fill}" opacity="0.92"/>
        <circle cx="72" cy="24" r="4" fill="${accent}"/>
        <circle cx="80" cy="24" r="2.5" fill="${accent}" opacity="0.55"/>
        <circle cx="88" cy="24" r="1.8" fill="${accent}" opacity="0.35"/>
      `;
    case 'saigon-pulse':
      return `
        <path d="M28 62 Q28 38 50 38 Q72 38 72 62" fill="none" stroke="${fill}" stroke-width="4" stroke-linecap="round"/>
        <path d="M22 62 Q22 32 50 32 Q78 32 78 62" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" opacity="0.85"/>
        <path d="M16 62 Q16 26 50 26 Q84 26 84 62" fill="none" stroke="${fill}" stroke-width="2.5" stroke-linecap="round" opacity="0.45"/>
        <path d="M44 68 L50 58 L56 68 Z" fill="${fill}"/>
        <rect x="47" y="68" width="6" height="14" rx="1" fill="${fill}"/>
      `;
    case 'heritage-hoi-an':
      return `
        <ellipse cx="50" cy="28" rx="22" ry="8" fill="${accent}" opacity="0.35"/>
        <rect x="34" y="28" width="32" height="44" rx="10" fill="${fill}"/>
        <rect x="38" y="36" width="24" height="20" rx="4" fill="${PAPER}" opacity="0.22"/>
        <path d="M42 72 L58 72 L54 82 L46 82 Z" fill="${accent}"/>
        <line x1="50" y1="20" x2="50" y2="28" stroke="${fill}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="50" cy="18" r="3" fill="${accent}"/>
      `;
    case 'mekong-makers':
      return `
        <path d="M20 78 C35 55 40 55 50 68 C60 55 65 55 80 78" fill="none" stroke="${fill}" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M32 78 C42 62 44 62 50 72 C56 62 58 62 68 78" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" opacity="0.9"/>
        <circle cx="28" cy="42" r="5" fill="${fill}"/>
        <circle cx="50" cy="36" r="5" fill="${accent}"/>
        <circle cx="72" cy="42" r="5" fill="${fill}"/>
        <line x1="28" y1="42" x2="50" y2="36" stroke="${fill}" stroke-width="2" opacity="0.5"/>
        <line x1="50" y1="36" x2="72" y2="42" stroke="${fill}" stroke-width="2" opacity="0.5"/>
      `;
    default:
      throw new Error(`unknown tenant mark ${slug}`);
  }
}

/**
 * @param {TenantSlug} slug
 * @param {number} size viewBox / width (square)
 */
export function svgMark(slug, size = 100) {
  const meta = TENANT_META[slug];
  const paths = markPaths(slug, meta.primary, meta.accent);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  ${paths}
</svg>`;
}

/**
 * @param {TenantSlug} slug
 * @param {'light'|'dark'} variant light = colored on transparent; dark = white on transparent
 * @param {{ eventTitle?: string, primary?: string }} [opts]
 */
export function svgLockup(slug, variant, opts = {}) {
  const w = 760;
  const h = 200;
  const meta = TENANT_META[slug];
  const primary = opts.primary || meta.primary;
  const onDark = variant === 'dark';
  const textColor = onDark ? '#FFFFFF' : primary;
  const markFill = onDark ? '#FFFFFF' : primary;
  const markAccent = onDark ? '#FFFFFF' : meta.accent;
  const subtitleColor = onDark ? '#FFFFFF' : primary;

  const title = opts.eventTitle || meta.wordmark;
  const subtitle = opts.eventTitle ? meta.wordmark : meta.tagline || '';
  const titleSize = opts.eventTitle ? 30 : meta.lockupCase === 'upper' ? 34 : 36;
  const titleWeight = meta.lockupCase === 'upper' ? 800 : 700;
  const letterSpacing = meta.lockupCase === 'upper' ? '2' : '0';

  const markGraphic = markPaths(slug, markFill, markAccent);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <g transform="translate(28, 28) scale(1.45)">
    ${markGraphic}
  </g>
  <text x="168" y="98" font-family="${FONT}" font-size="${titleSize}" font-weight="${titleWeight}" letter-spacing="${letterSpacing}" fill="${textColor}">${escapeXml(title)}</text>
  ${
    subtitle
      ? `<text x="168" y="132" font-family="${FONT}" font-size="20" font-weight="500" fill="${subtitleColor}" opacity="${onDark ? 0.75 : 0.65}">${escapeXml(subtitle)}</text>`
      : ''
  }
  <rect x="168" y="148" width="120" height="3" rx="1.5" fill="${onDark ? '#FFFFFF' : meta.accent}" opacity="${onDark ? 0.5 : 0.85}"/>
</svg>`;
}

/**
 * Avatar / iOS tile — mark on soft radial field (still rasterized to PNG/WebP).
 * @param {TenantSlug} slug
 */
export function svgTile(slug) {
  const size = 1024;
  const meta = TENANT_META[slug];
  const markGraphic = markPaths(slug, meta.primary, meta.accent);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="g" cx="50%" cy="42%" r="68%">
      <stop offset="0%" stop-color="${PAPER}"/>
      <stop offset="55%" stop-color="${meta.primary}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${INK}" stop-opacity="0.08"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <g transform="translate(312, 280) scale(4.4)">
    ${markGraphic}
  </g>
</svg>`;
}

/** Mark for banner overlay (white) */
export function svgMarkWhite(slug, x, y, scale) {
  const meta = TENANT_META[slug];
  const inner = markPaths(slug, '#FFFFFF', '#FFFFFF');
  return `<g transform="translate(${x}, ${y}) scale(${scale})">${inner}</g>`;
}

export const TENANT_SLUGS = Object.keys(TENANT_META);
