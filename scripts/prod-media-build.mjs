#!/usr/bin/env node
/**
 * Epic #686 — reproducible prod seed raster (SVG → sharp).
 *
 *   node scripts/prod-media-build.mjs
 *   node scripts/prod-media-build.mjs --contact-sheet
 *
 * Output: brand/prod/** + brand/prod/manifest.json
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), '../packages/backend/package.json'),
);
const sharp = require('sharp');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_ROOT = join(ROOT, 'brand/prod');

const INK = '#0B1220';
const PAPER = '#F4F6F8';

/** @type {const} */
const ORGS = [
  {
    slug: 'luc-bao-live',
    name: 'Lục Bảo Live',
    tenantId: '686f0001-0001-4000-8000-000000000001',
    primary: '#1B4D3E',
    accent: '#245B47',
    motif: 'grid',
    logoAssetId: '686f0001-0008-4000-8000-00000101',
  },
  {
    slug: 'saigon-pulse',
    name: 'Saigon Pulse',
    tenantId: '686f0001-0001-4000-8000-000000000002',
    primary: '#E85D04',
    accent: '#0D9488',
    motif: 'wave',
    logoAssetId: '686f0001-0008-4000-8000-00000201',
  },
  {
    slug: 'heritage-hoi-an',
    name: 'Di sản Hội An',
    tenantId: '686f0001-0001-4000-8000-000000000003',
    primary: '#8B4513',
    accent: '#6D28D9',
    motif: 'lantern',
    logoAssetId: '686f0001-0008-4000-8000-00000301',
  },
  {
    slug: 'mekong-makers',
    name: 'Mekong Makers',
    tenantId: '686f0001-0001-4000-8000-000000000004',
    primary: '#2A6F97',
    accent: '#C2410C',
    motif: 'track',
    logoAssetId: '686f0001-0008-4000-8000-00000401',
  },
];

/** @type {const} */
const EVENTS = [
  {
    orgSlug: 'luc-bao-live',
    slug: 'dem-am-indie',
    title: 'Đêm Nhạc Indie Lục Bảo',
    eventId: '686f0001-0002-4000-8000-000000000001',
    primary: '#245B47',
    bannerStyle: 'forest-light',
    logoAssetId: '686f0001-0008-4000-8000-00010101',
    bannerAssetId: '686f0001-0008-4000-8000-00010102',
  },
  {
    orgSlug: 'saigon-pulse',
    slug: 'pulse-afterhours',
    title: 'Pulse Afterhours',
    eventId: '686f0001-0002-4000-8000-000000000002',
    primary: '#0D9488',
    bannerStyle: 'night-teal',
    logoAssetId: '686f0001-0008-4000-8000-00020101',
    bannerAssetId: '686f0001-0008-4000-8000-00020102',
  },
  {
    orgSlug: 'saigon-pulse',
    slug: 'pulse-rooftop',
    title: 'Pulse Rooftop Session',
    eventId: '686f0001-0002-4000-8000-000000000003',
    primary: '#14B8A6',
    bannerStyle: 'sunset-rooftop',
    logoAssetId: '686f0001-0008-4000-8000-00030101',
    bannerAssetId: '686f0001-0008-4000-8000-00030102',
  },
  {
    orgSlug: 'heritage-hoi-an',
    slug: 'pho-co-dem',
    title: 'Phố Cổ Về Đêm',
    eventId: '686f0001-0002-4000-8000-000000000004',
    primary: '#8B4513',
    bannerStyle: 'lantern-night',
    logoAssetId: '686f0001-0008-4000-8000-00040101',
    bannerAssetId: '686f0001-0008-4000-8000-00040102',
  },
  {
    orgSlug: 'heritage-hoi-an',
    slug: 'song-thu-workshop',
    title: 'Workshop Sông Thu',
    eventId: '686f0001-0002-4000-8000-000000000005',
    primary: '#A0522D',
    bannerStyle: 'paper-craft',
    logoAssetId: '686f0001-0008-4000-8000-00050101',
    bannerAssetId: '686f0001-0008-4000-8000-00050102',
  },
  {
    orgSlug: 'heritage-hoi-an',
    slug: 'festival-an-song',
    title: 'Festival Ăn Sống Hội An',
    eventId: '686f0001-0002-4000-8000-000000000006',
    primary: '#5B21B6',
    bannerStyle: 'festival-band',
    logoAssetId: '686f0001-0008-4000-8000-00060101',
    bannerAssetId: '686f0001-0008-4000-8000-00060102',
  },
];

const FONT =
  'DejaVu Sans, Liberation Sans, Helvetica, Arial, sans-serif';

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function motifLayer(motif, w, h, color, opacity = 0.35) {
  const parts = [];
  const c = color;
  const o = opacity;
  if (motif === 'grid') {
    for (let x = 40; x < w; x += 48) {
      for (let y = 40; y < h; y += 48) {
        parts.push(
          `<circle cx="${x}" cy="${y}" r="3" fill="${c}" opacity="${o}"/>`,
        );
      }
    }
  } else if (motif === 'wave') {
    for (let i = 0; i < 6; i++) {
      const cy = h * 0.35 + i * 28;
      parts.push(
        `<ellipse cx="${w / 2}" cy="${cy}" rx="${w * 0.42}" ry="${18 + i * 4}" fill="none" stroke="${c}" stroke-width="2" opacity="${o}"/>`,
      );
    }
  } else if (motif === 'lantern') {
    for (let i = 0; i < 5; i++) {
      const x = 120 + i * (w / 5.5);
      parts.push(
        `<rect x="${x}" y="${h * 0.25}" width="36" height="52" rx="8" fill="${c}" opacity="${o}"/>`,
        `<ellipse cx="${x + 18}" cy="${h * 0.25}" rx="18" ry="8" fill="${c}" opacity="${o * 0.8}"/>`,
      );
    }
  } else if (motif === 'track') {
    for (let i = 0; i < 4; i++) {
      const y = 60 + i * 45;
      parts.push(
        `<line x1="80" y1="${y}" x2="${w - 80}" y2="${y}" stroke="${c}" stroke-width="3" opacity="${o}"/>`,
        `<circle cx="${120 + i * 90}" cy="${y}" r="6" fill="${c}" opacity="${o + 0.15}"/>`,
      );
    }
  }
  return parts.join('\n');
}

function markGlyph(x, y, size, color) {
  const s = size;
  return `
    <path d="M ${x} ${y + s} L ${x + s * 0.45} ${y} L ${x + s * 0.9} ${y + s}" fill="none" stroke="${color}" stroke-width="${Math.max(3, s * 0.08)}" stroke-linecap="round"/>
    <circle cx="${x + s * 0.9}" cy="${y + s * 0.15}" r="${s * 0.09}" fill="#E11D48"/>
  `;
}

function svgLogoLockup({ orgName, eventTitle, primary, motif, mono = false }) {
  const w = 760;
  const h = 200;
  const textColor = mono ? '#FFFFFF' : primary;
  const markColor = mono ? '#FFFFFF' : primary;
  const title = eventTitle || orgName;
  const subtitle = eventTitle ? orgName : '';
  const titleSize = eventTitle ? 32 : 36;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${mono ? '' : `<rect width="${w}" height="${h}" fill="none"/>`}
  ${markGlyph(48, 52, 96, markColor)}
  <text x="168" y="108" font-family="${FONT}" font-size="${titleSize}" font-weight="700" fill="${textColor}">${escapeXml(title)}</text>
  ${
    subtitle
      ? `<text x="168" y="142" font-family="${FONT}" font-size="22" font-weight="500" fill="${textColor}" opacity="0.75">${escapeXml(subtitle)}</text>`
      : ''
  }
  ${mono ? '' : motifLayer(motif, w, h, primary, 0.12)}
</svg>`;
}

function bannerDefs(style, primary) {
  const stops = {
    'forest-light': [
      ['0%', '#1B4D3E'],
      ['55%', '#245B47'],
      ['100%', INK],
    ],
    'night-teal': [
      ['0%', '#0F766E'],
      ['50%', '#0B1220'],
      ['100%', '#020617'],
    ],
    'sunset-rooftop': [
      ['0%', '#FDBA74'],
      ['40%', '#E85D04'],
      ['100%', '#1E3A5F'],
    ],
    'lantern-night': [
      ['0%', '#4C1D95'],
      ['45%', '#8B4513'],
      ['100%', INK],
    ],
    'paper-craft': [
      ['0%', PAPER],
      ['60%', '#E8DCC8'],
      ['100%', primary],
    ],
    'festival-band': [
      ['0%', '#5B21B6'],
      ['35%', primary],
      ['100%', INK],
    ],
  };
  const s = stops[style] || stops['forest-light'];
  return `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    ${s.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}
  </linearGradient>`;
}

function svgBanner({ style, primary, motif, orgName }) {
  const w = 1200;
  const h = 630;
  const safe = 0.1;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${bannerDefs(style, primary)}</defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  ${motifLayer(motif, w, h, '#FFFFFF', 0.22)}
  <rect x="${w * safe}" y="${h * safe}" width="${w * (1 - 2 * safe)}" height="${h * (1 - 2 * safe)}" fill="none" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="2" rx="12"/>
  ${markGlyph(w * 0.08, h * 0.38, 72, '#FFFFFF')}
  <text x="${w * 0.08 + 100}" y="${h * 0.52}" font-family="${FONT}" font-size="28" font-weight="600" fill="#FFFFFF" opacity="0.85">${escapeXml(orgName)}</text>
</svg>`;
}

async function rasterize(svg, { width, height, format }) {
  const pipeline = sharp(Buffer.from(svg)).resize(width, height);
  if (format === 'png') {
    return pipeline.png({ compressionLevel: 9 }).toBuffer();
  }
  return pipeline.webp({ quality: 88 }).toBuffer();
}

function orgBySlug(slug) {
  const o = ORGS.find((x) => x.slug === slug);
  if (!o) throw new Error(`unknown org ${slug}`);
  return o;
}

async function writeFile(relPath, buf) {
  const abs = join(ROOT, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, buf);
  return relPath;
}

async function buildAll() {
  const built = [];

  for (const org of ORGS) {
    const rel = `brand/prod/${org.slug}/logo.png`;
    const svg = svgLogoLockup({
      orgName: org.name,
      primary: org.primary,
      motif: org.motif,
    });
    const buf = await rasterize(svg, { width: 760, height: 200, format: 'png' });
    await writeFile(rel, buf);
    built.push({ rel, width: 760, height: 200, bytes: buf.length, mime: 'image/png' });
  }

  for (const ev of EVENTS) {
    const org = orgBySlug(ev.orgSlug);
    const base = `brand/prod/${ev.orgSlug}/${ev.slug}`;
    const logoRel = `${base}/logo.png`;
    const bannerRel = `${base}/banner.webp`;

    const logoSvg = svgLogoLockup({
      orgName: org.name,
      eventTitle: ev.title,
      primary: ev.primary,
      motif: org.motif,
    });
    const logoBuf = await rasterize(logoSvg, {
      width: 760,
      height: 200,
      format: 'png',
    });
    await writeFile(logoRel, logoBuf);
    built.push({
      rel: logoRel,
      width: 760,
      height: 200,
      bytes: logoBuf.length,
      mime: 'image/png',
    });

    const bannerSvg = svgBanner({
      style: ev.bannerStyle,
      primary: ev.primary,
      motif: org.motif,
      orgName: org.name,
    });
    const bannerBuf = await rasterize(bannerSvg, {
      width: 1200,
      height: 630,
      format: 'webp',
    });
    await writeFile(bannerRel, bannerBuf);
    built.push({
      rel: bannerRel,
      width: 1200,
      height: 630,
      bytes: bannerBuf.length,
      mime: 'image/webp',
    });
  }

  const tenants = ORGS.map((org) => {
    const events = EVENTS.filter((e) => e.orgSlug === org.slug);
    return {
      slug: org.slug,
      tenantId: org.tenantId,
      tenantBrand: {
        primaryColor: org.primary,
        organizationName: org.name,
        logo: {
          role: 'tenant-logo',
          assetId: org.logoAssetId,
          source: `brand/prod/${org.slug}/logo.png`,
          contentType: 'image/png',
          extension: 'png',
          widthPx: 760,
          heightPx: 200,
        },
      },
      events: events.map((ev) => ({
        slug: ev.slug,
        eventId: ev.eventId,
        assets: [
          {
            role: 'logo',
            assetId: ev.logoAssetId,
            source: `brand/prod/${ev.orgSlug}/${ev.slug}/logo.png`,
            contentType: 'image/png',
            extension: 'png',
            widthPx: 760,
            heightPx: 200,
          },
          {
            role: 'banner',
            assetId: ev.bannerAssetId,
            source: `brand/prod/${ev.orgSlug}/${ev.slug}/banner.webp`,
            contentType: 'image/webp',
            extension: 'webp',
            widthPx: 1200,
            heightPx: 630,
            ogShare: true,
          },
        ],
      })),
    };
  });

  const manifest = {
    $schemaComment:
      'Epic #686 prod media — stable UUIDs; align PROD-SEED-DATASET.md',
    bucketEnv: 'MINIO_BUCKET_ASSETS',
    defaultBucket: 'vemoki-assets',
    generatedAt: new Date().toISOString(),
    generator: 'scripts/prod-media-build.mjs',
    tenants,
  };

  const manifestPath = join(OUT_ROOT, 'manifest.json');
  mkdirSync(OUT_ROOT, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  return { built, manifestPath };
}

async function buildContactSheet(built) {
  const thumbH = 120;
  const cols = 4;
  const rows = Math.ceil(built.length / cols);
  const cellW = 320;
  const pad = 16;
  const sheetW = cols * cellW + pad * 2;
  const sheetH = rows * (thumbH + 48) + pad * 2;

  const composites = [];
  let i = 0;
  for (const item of built) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const abs = join(ROOT, item.rel);
    const meta = await sharp(abs).metadata();
    const thumbW = Math.round((meta.width / meta.height) * thumbH);
    const thumb = await sharp(abs)
      .resize(thumbW, thumbH, { fit: 'inside' })
      .toBuffer();
    composites.push({
      input: thumb,
      left: pad + col * cellW + 8,
      top: pad + row * (thumbH + 48) + 8,
    });
    i++;
  }

  const labelSvg = (text, x, y) =>
    `<text x="${x}" y="${y}" font-family="${FONT}" font-size="11" fill="${INK}">${escapeXml(text)}</text>`;

  const labels = built
    .map((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = pad + col * cellW + 8;
      const y = pad + row * (thumbH + 48) + thumbH + 28;
      const short = item.rel.replace('brand/prod/', '');
      return labelSvg(short, x, y);
    })
    .join('\n');

  const bg = Buffer.from(
    `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">
      <rect width="100%" height="100%" fill="${PAPER}"/>
      ${labels}
    </svg>`,
  );

  const out = join(ROOT, 'docs/reviews/EPIC686-MEDIA-contact-sheet.png');
  mkdirSync(dirname(out), { recursive: true });
  await sharp(bg)
    .composite(composites)
    .png()
    .toFile(out);
  return out;
}

async function main() {
  const contactSheet = process.argv.includes('--contact-sheet');
  const { built } = await buildAll();
  console.log(`Built ${built.length} raster files + manifest.json`);
  for (const b of built) {
    console.log(`  ${b.rel}  ${b.width}x${b.height}  ${b.bytes} B`);
  }
  if (contactSheet) {
    const path = await buildContactSheet(built);
    console.log(`Contact sheet: ${path}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
