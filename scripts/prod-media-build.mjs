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
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  escapeXml,
  FONT,
  INK,
  PAPER,
  svgLockup,
  svgMark,
  svgMarkWhite,
  svgTile,
} from './prod-media-src/tenant-logos.mjs';

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), '../packages/backend/package.json'),
);
const sharp = require('sharp');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_ROOT = join(ROOT, 'brand/prod');

const SRC_ROOT = join(__dirname, 'prod-media-src');

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

function svgBanner({ style, primary, motif, orgName, orgSlug }) {
  const w = 1200;
  const h = 630;
  const safe = 0.1;
  const markScale = 0.72;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${bannerDefs(style, primary)}</defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  ${motifLayer(motif, w, h, '#FFFFFF', 0.22)}
  <rect x="${w * safe}" y="${h * safe}" width="${w * (1 - 2 * safe)}" height="${h * (1 - 2 * safe)}" fill="none" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="2" rx="12"/>
  ${svgMarkWhite(orgSlug, w * 0.06, h * 0.34, markScale)}
  <text x="${w * 0.06 + 100}" y="${h * 0.52}" font-family="${FONT}" font-size="28" font-weight="600" fill="#FFFFFF" opacity="0.85">${escapeXml(orgName)}</text>
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

function writeTenantSourceSvgs(org) {
  const dir = join(SRC_ROOT, org.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'mark.svg'), svgMark(org.slug, 100));
  writeFileSync(join(dir, 'lockup-light.svg'), svgLockup(org.slug, 'light'));
  writeFileSync(join(dir, 'lockup-dark.svg'), svgLockup(org.slug, 'dark'));
}

/**
 * @param {typeof ORGS[number]} org
 * @param {{ built: object[] }} acc
 */
async function buildTenantLogoSuite(org, acc) {
  writeTenantSourceSvgs(org);
  const base = `brand/prod/${org.slug}`;
  const slug = org.slug;

  const push = async (rel, svg, width, height, format) => {
    const buf = await rasterize(svg, { width, height, format });
    await writeFile(rel, buf);
    const mime =
      format === 'png'
        ? 'image/png'
        : format === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
    acc.built.push({ rel, width, height, bytes: buf.length, mime });
    return { rel, width, height, bytes: buf.length, mime, contentType: mime };
  };

  const mark512 = await push(
    `${base}/mark-512.png`,
    svgMark(slug, 512),
    512,
    512,
    'png',
  );
  const lockLight = await push(
    `${base}/logo.png`,
    svgLockup(slug, 'light'),
    760,
    200,
    'png',
  );
  const lockDark = await push(
    `${base}/logo-dark.png`,
    svgLockup(slug, 'dark'),
    760,
    200,
    'png',
  );
  await push(`${base}/logo.webp`, svgLockup(slug, 'light'), 760, 200, 'webp');
  await push(
    `${base}/logo-dark.webp`,
    svgLockup(slug, 'dark'),
    760,
    200,
    'webp',
  );

  const tileSvg = svgTile(slug);
  const tile1024 = await push(`${base}/tile-1024.png`, tileSvg, 1024, 1024, 'png');
  await push(`${base}/tile-682.png`, tileSvg, 682, 682, 'png');
  await push(`${base}/tile-341.png`, tileSvg, 341, 341, 'png');
  await push(`${base}/tile-1024.webp`, tileSvg, 1024, 1024, 'webp');

  return {
    mark512,
    lockLight,
    lockDark,
    tile1024,
  };
}

async function buildAll() {
  const built = [];

  for (const org of ORGS) {
    await buildTenantLogoSuite(org, { built });
  }

  for (const ev of EVENTS) {
    const org = orgBySlug(ev.orgSlug);
    const base = `brand/prod/${ev.orgSlug}/${ev.slug}`;
    const logoRel = `${base}/logo.png`;
    const bannerRel = `${base}/banner.webp`;

    const logoSvg = svgLockup(org.slug, 'light', {
      eventTitle: ev.title,
      primary: ev.primary,
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
      orgSlug: org.slug,
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
        assets: [
          {
            role: 'tenant-mark',
            source: `brand/prod/${org.slug}/mark-512.png`,
            contentType: 'image/png',
            extension: 'png',
            widthPx: 512,
            heightPx: 512,
          },
          {
            role: 'tenant-logo',
            assetId: org.logoAssetId,
            source: `brand/prod/${org.slug}/logo.png`,
            contentType: 'image/png',
            extension: 'png',
            widthPx: 760,
            heightPx: 200,
          },
          {
            role: 'tenant-lockup-light',
            source: `brand/prod/${org.slug}/logo.png`,
            contentType: 'image/png',
            extension: 'png',
            widthPx: 760,
            heightPx: 200,
          },
          {
            role: 'tenant-lockup-dark',
            source: `brand/prod/${org.slug}/logo-dark.png`,
            contentType: 'image/png',
            extension: 'png',
            widthPx: 760,
            heightPx: 200,
          },
          {
            role: 'tenant-lockup-light-webp',
            source: `brand/prod/${org.slug}/logo.webp`,
            contentType: 'image/webp',
            extension: 'webp',
            widthPx: 760,
            heightPx: 200,
          },
          {
            role: 'tenant-lockup-dark-webp',
            source: `brand/prod/${org.slug}/logo-dark.webp`,
            contentType: 'image/webp',
            extension: 'webp',
            widthPx: 760,
            heightPx: 200,
          },
          {
            role: 'tenant-tile',
            source: `brand/prod/${org.slug}/tile-1024.png`,
            contentType: 'image/png',
            extension: 'png',
            widthPx: 1024,
            heightPx: 1024,
          },
          {
            role: 'tenant-tile-2x',
            source: `brand/prod/${org.slug}/tile-682.png`,
            contentType: 'image/png',
            extension: 'png',
            widthPx: 682,
            heightPx: 682,
          },
          {
            role: 'tenant-tile-1x',
            source: `brand/prod/${org.slug}/tile-341.png`,
            contentType: 'image/png',
            extension: 'png',
            widthPx: 341,
            heightPx: 341,
          },
          {
            role: 'tenant-tile-webp',
            source: `brand/prod/${org.slug}/tile-1024.webp`,
            contentType: 'image/webp',
            extension: 'webp',
            widthPx: 1024,
            heightPx: 1024,
          },
        ],
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

async function buildTenantLogoContactSheet() {
  const pad = 24;
  const colW = 360;
  const rowH = 200;
  const cols = 2;
  const rows = ORGS.length;
  const sheetW = cols * colW + pad * 3;
  const sheetH = rows * rowH + pad * 2 + 40;

  const composites = [];
  const labels = [];

  for (let i = 0; i < ORGS.length; i++) {
    const org = ORGS[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x0 = pad + col * (colW + pad);
    const y0 = pad + 32 + row * rowH;

    const markPath = join(ROOT, `brand/prod/${org.slug}/mark-512.png`);
    const lockLight = join(ROOT, `brand/prod/${org.slug}/logo.png`);
    const lockDark = join(ROOT, `brand/prod/${org.slug}/logo-dark.png`);

    const sizes = [
      { file: markPath, w: 32, h: 32, left: x0, top: y0, bg: PAPER },
      { file: markPath, w: 32, h: 32, left: x0 + 48, top: y0, bg: INK },
      { file: markPath, w: 64, h: 64, left: x0 + 110, top: y0 - 8, bg: PAPER },
      {
        file: lockLight,
        w: 200,
        h: 52,
        left: x0,
        top: y0 + 56,
        bg: PAPER,
      },
      {
        file: lockDark,
        w: 200,
        h: 52,
        left: x0,
        top: y0 + 120,
        bg: INK,
      },
    ];

    for (const s of sizes) {
      const thumb = await sharp(s.file)
        .resize(s.w, s.h, { fit: 'inside' })
        .toBuffer();
      const plate = await sharp({
        create: {
          width: s.w + 8,
          height: s.h + 8,
          channels: 4,
          background: s.bg,
        },
      })
        .composite([{ input: thumb, left: 4, top: 4 }])
        .png()
        .toBuffer();
      composites.push({ input: plate, left: s.left, top: s.top });
    }

    labels.push(
      `<text x="${x0}" y="${y0 - 8}" font-family="${FONT}" font-size="13" font-weight="700" fill="${INK}">${escapeXml(org.name)}</text>`,
    );
  }

  const bg = Buffer.from(
    `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">
      <rect width="100%" height="100%" fill="${PAPER}"/>
      <text x="${pad}" y="28" font-family="${FONT}" font-size="16" font-weight="700" fill="${INK}">Epic #686 tenant logos — 32px / 64px marks + lockups (paper / ink)</text>
      ${labels.join('\n')}
    </svg>`,
  );

  const out = join(ROOT, 'docs/reviews/EPIC686-TENANT-LOGO-contact-sheet.png');
  mkdirSync(dirname(out), { recursive: true });
  await sharp(bg).composite(composites).png().toFile(out);
  return out;
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
    const tenantSheet = await buildTenantLogoContactSheet();
    console.log(`Tenant logo contact sheet: ${tenantSheet}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
