#!/usr/bin/env node
/**
 * UI budget ratchet (Epic #786, audit docs/reviews/FE-UI-FRAMEWORK-AUDIT-2026-10-22.md WP-1).
 * Fails when any metric grows above scripts/ui-budget.baseline.json. Lowering is always allowed;
 * run with --update in the same PR to record the new (lower) baseline.
 *
 * Usage: node scripts/ui-budget.mjs [--scope web|mobile|all] [--update] [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'scripts/ui-budget.baseline.json');
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.turbo', 'ios', 'android', '.expo']);

const args = process.argv.slice(2);
const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'all';
const update = args.includes('--update');
const asJson = args.includes('--json');
if (!['web', 'mobile', 'all'].includes(scope)) {
  console.error(`ui-budget: unknown --scope ${scope} (web|mobile|all)`);
  process.exit(2);
}

function walk(dir, match) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(rel, match));
    else if (match(rel)) out.push(rel);
  }
  return out;
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const count = (files, re) => files.reduce((n, f) => n + (read(f).match(re)?.length ?? 0), 0);
const isTest = (f) => /\.test\.[cm]?[jt]sx?$/.test(f);

const HEX = /#[0-9a-fA-F]{3,8}\b/g;

const metrics = {
  web: () => {
    const css = [...walk('apps/web/app', (f) => f.endsWith('.css')), ...walk('apps/web/src', (f) => f.endsWith('.css'))].filter(
      (f) => f !== path.join('apps/web/app/globals.css'),
    );
    const tsx = [
      ...walk('apps/web/app', (f) => f.endsWith('.tsx')),
      ...walk('apps/web/src', (f) => f.endsWith('.tsx')),
      ...walk('packages/ui/src', (f) => f.endsWith('.tsx')),
    ].filter((f) => !isTest(f));
    const tsLike = [
      ...walk('apps/web/app', (f) => /\.tsx?$/.test(f)),
      ...walk('apps/web/src', (f) => /\.tsx?$/.test(f)),
      ...walk('packages/ui/src', (f) => /\.tsx?$/.test(f)),
    ].filter((f) => !isTest(f));
    return {
      'web.css_lines': css.reduce((n, f) => n + read(f).split('\n').length, 0),
      'web.module_css_files': css.filter((f) => f.endsWith('.module.css')).length,
      'web.tsx_hex_literals': count(tsx, HEX),
      'web.css_media_px': count(css, /@media[^{]*\d+px/g),
      'web.css_important': count(css, /!important/g),
      'web.ui_prefix_literals': count(tsLike, /\bui:[a-z]/g),
    };
  },
  mobile: () => {
    const tsx = walk('apps/mobile/src', (f) => f.endsWith('.tsx')).filter((f) => !isTest(f));
    const outsideTheme = tsx.filter((f) => !f.startsWith(path.join('apps/mobile/src/theme')));
    const outsideUi = tsx.filter((f) => !f.startsWith(path.join('apps/mobile/src/components/ui')));
    return {
      'mobile.spacing_literals': count(outsideTheme, /\b(?:padding|margin|gap|rowGap|columnGap|borderRadius)[A-Za-z]*:\s*\d+/g),
      'mobile.font_literals': count(outsideTheme, /\bfontSize:\s*\d+|\bfontWeight:\s*'\d+'/g),
      'mobile.tsx_hex_literals': count(outsideTheme, HEX),
      'mobile.pressable_outside_ui': count(outsideUi, /<Pressable\b/g),
      'mobile.rn_modal': count(tsx, /<Modal\b/g),
    };
  },
};

const current = {};
for (const s of scope === 'all' ? ['web', 'mobile'] : [scope]) Object.assign(current, metrics[s]());

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};

if (update) {
  const next = { ...baseline };
  for (const [k, v] of Object.entries(current)) {
    if (k in next && v > next[k]) {
      console.error(`ui-budget: refuse --update, ${k} grew ${next[k]} → ${v}`);
      process.exit(1);
    }
    next[k] = v;
  }
  const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(BASELINE, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`ui-budget: baseline updated (${Object.keys(current).length} metrics)`);
  process.exit(0);
}

const rows = Object.entries(current).map(([k, v]) => {
  const base = baseline[k];
  const status = base === undefined ? 'new' : v > base ? 'FAIL' : v < base ? 'lower' : 'ok';
  return { metric: k, baseline: base ?? null, current: v, status };
});

if (asJson) console.log(JSON.stringify(rows, null, 2));
else {
  for (const r of rows) console.log(`${r.status.padEnd(5)} ${r.metric.padEnd(32)} ${String(r.baseline ?? '-').padStart(6)} → ${r.current}`);
}

const failed = rows.filter((r) => r.status === 'FAIL' || r.status === 'new');
const lowered = rows.filter((r) => r.status === 'lower');
if (lowered.length && !asJson) console.log('ui-budget: chỉ số đã giảm — chạy `node scripts/ui-budget.mjs --update` trong cùng PR để khóa baseline mới.');
if (failed.length) {
  console.error(
    `ui-budget: FAIL — ${failed.map((r) => r.metric).join(', ')} vượt baseline (hoặc chưa có baseline). Không thêm CSS tay / literal; xem audit mục 5.`,
  );
  process.exit(1);
}
