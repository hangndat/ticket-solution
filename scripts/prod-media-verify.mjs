#!/usr/bin/env node
/**
 * Verify brand/prod assets against manifest + ASSET_LIMITS.
 *
 *   node scripts/prod-media-verify.mjs
 *   node scripts/prod-media-verify.mjs --json
 */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), '../packages/backend/package.json'),
);
const sharp = require('sharp');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST = join(ROOT, 'brand/prod/manifest.json');

const LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxWidthPx: 4096,
  maxHeightPx: 4096,
  maxPixels: 16_000_000,
  allowedMime: new Set(['image/png', 'image/jpeg', 'image/webp']),
};

/** @typedef {{ ok: boolean, path: string, errors: string[], meta?: object }} Row */

function collectAssets(manifest) {
  /** @type {{ source: string, contentType: string, widthPx?: number, heightPx?: number, role: string }[]} */
  const items = [];
  for (const tenant of manifest.tenants) {
    if (tenant.tenantBrand?.logo) {
      const l = tenant.tenantBrand.logo;
      items.push({
        source: l.source,
        contentType: l.contentType,
        widthPx: l.widthPx,
        heightPx: l.heightPx,
        role: `${tenant.slug}/tenant-logo`,
      });
    }
    for (const ev of tenant.events || []) {
      for (const a of ev.assets || []) {
        items.push({
          source: a.source,
          contentType: a.contentType,
          widthPx: a.widthPx,
          heightPx: a.heightPx,
          role: `${tenant.slug}/${ev.slug}/${a.role}`,
        });
      }
    }
  }
  return items;
}

async function verifyOne(item) {
  /** @type {string[]} */
  const errors = [];
  const abs = join(ROOT, item.source);
  if (!existsSync(abs)) {
    return { ok: false, path: item.source, errors: ['missing file'] };
  }
  const stat = readFileSync(abs);
  if (stat.length > LIMITS.maxBytes) {
    errors.push(`bytes ${stat.length} > maxBytes`);
  }
  if (!LIMITS.allowedMime.has(item.contentType)) {
    errors.push(`mime ${item.contentType} not allowed`);
  }
  const meta = await sharp(abs).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const pixels = w * h;
  if (w > LIMITS.maxWidthPx || h > LIMITS.maxHeightPx) {
    errors.push(`dimensions ${w}x${h} exceed max edge`);
  }
  if (pixels > LIMITS.maxPixels) {
    errors.push(`pixels ${pixels} > maxPixels`);
  }
  if (item.widthPx && w !== item.widthPx) {
    errors.push(`width ${w} !== manifest ${item.widthPx}`);
  }
  if (item.heightPx && h !== item.heightPx) {
    errors.push(`height ${h} !== manifest ${item.heightPx}`);
  }
  const fmt = meta.format;
  const expected =
    item.contentType === 'image/png'
      ? 'png'
      : item.contentType === 'image/webp'
        ? 'webp'
        : 'jpeg';
  if (fmt !== expected) {
    errors.push(`sharp format ${fmt} !== expected ${expected}`);
  }
  return {
    ok: errors.length === 0,
    path: item.source,
    errors,
    meta: { width: w, height: h, bytes: stat.length, format: fmt },
  };
}

async function main() {
  const asJson = process.argv.includes('--json');
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const items = collectAssets(manifest);
  const rows = [];
  for (const item of items) {
    rows.push(await verifyOne(item));
  }
  const ok = rows.every((r) => r.ok);
  const report = {
    manifest: 'brand/prod/manifest.json',
    fileCount: rows.length,
    verdict: ok ? 'PASS' : 'FAIL',
    rows,
  };
  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    console.log(`prod-media-verify ${report.verdict} (${report.fileCount} files)`);
    for (const r of rows) {
      const tag = r.ok ? 'PASS' : 'FAIL';
      console.log(`  ${tag}  ${r.path}`);
      for (const e of r.errors) console.log(`        ${e}`);
    }
  }
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
