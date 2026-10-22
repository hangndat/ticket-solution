#!/usr/bin/env node
/**
 * Sum byte size of apps/web/.next/static/chunks/*.js and *.css (post-build).
 * Usage: node scripts/measure-web-chunk-bytes.mjs [--json]
 */
import { readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHUNKS = join(ROOT, 'apps/web/.next/static/chunks');
const jsonOut = process.argv.includes('--json');

function sumExt(ext) {
  let total = 0;
  let count = 0;
  for (const name of readdirSync(CHUNKS)) {
    if (!name.endsWith(ext)) continue;
    total += statSync(join(CHUNKS, name)).size;
    count += 1;
  }
  return { total, count };
}

const js = sumExt('.js');
const css = sumExt('.css');

if (jsonOut) {
  console.log(JSON.stringify({ jsBytes: js.total, cssBytes: css.total, jsFiles: js.count, cssFiles: css.count }));
} else {
  console.log(`js_bytes=${js.total} (${js.count} files)`);
  console.log(`css_bytes=${css.total} (${css.count} files)`);
}
