#!/usr/bin/env node
/**
 * One-shot codemod for #797 — spacing/radius/typography/hex → theme tokens.
 * Usage: node scripts/mobile-ui-token-codemod.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE_SRC = path.join(ROOT, 'apps/mobile/src');
const DRY = process.argv.includes('--dry-run');

const SKIP = new Set(['theme']);
const SPACING_PROPS =
  /(?<prop>\b(?:padding|margin|gap|rowGap|columnGap|borderRadius)[A-Za-z]*)\s*:\s*(?<val>\d+)/g;

const HEX_MAP = {
  '#edf5ef': 'colors.admitSurface',
  '#26734c': 'colors.admit',
  '#e1e6ed': 'colors.line',
  '#e8ecf1': 'colors.surfaceMuted',
  '#f0f4f8': 'colors.surfaceSubtle',
  '#ffffff': 'colors.onAccent',
  '#fff': 'colors.onAccent',
  '#B00020': 'colors.destructive',
  '#b00020': 'colors.destructive',
  '#000': 'colors.shadow',
  '#000000': 'colors.shadow',
  '#fb7391': 'colors.signalTint',
};

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP.has(ent.name) && dir === MOBILE_SRC) continue;
      walk(abs, out);
    } else if (ent.name.endsWith('.tsx') && !ent.name.includes('.test.')) {
      const rel = path.relative(MOBILE_SRC, abs);
      if (!rel.startsWith('theme' + path.sep) && !rel.startsWith('theme/')) {
        out.push(abs);
      }
    }
  }
  return out;
}

function mapSpacing(prop, n, relPath) {
  if (n === 0) return '0';
  const isRadius = prop.startsWith('borderRadius');
  if (isRadius) {
    if (n >= 100) return 'radius.pill';
    const rMap = {
      2: 'radius.sm',
      4: 'radius.sm',
      6: 'radius.sm',
      8: 'radius.sm',
      9: 'radius.sm',
      10: 'radius.md',
      11: 'radius.md',
      12: 'radius.md',
      14: 'radius.md',
      16: 'radius.lg',
      18: 'radius.lg',
      20: 'radius.xl',
      24: 'radius.xl',
    };
    return rMap[n] ?? `/* unmappable radius ${n} */`;
  }
  if (n === 5) return 'space.xs';
  if (n === 6) return 'space.sm';
  if (n === 9) return 'space.sm';
  if (n === 10) {
    if (relPath.includes('staff-gate-ops-sticky')) return 'space.sm';
    return 'space.md';
  }
  if (n === 11) return 'space.md';
  if (n === 14) return 'space.md';
  if (n === 15) return 'space.lg';
  if (n === 18) return 'space.lg';
  if (n === 22) return 'space.xl';
  const sMap = {
    2: 'space.xxs',
    4: 'space.xs',
    8: 'space.sm',
    12: 'space.md',
    16: 'space.lg',
    20: 'space.xl',
    24: 'space.xxl',
    32: 'space.xxxl',
    48: 'space.huge',
  };
  return sMap[n] ?? `/* unmappable space ${n} */`;
}

const TYPO_BY_SIZE = {
  30: 'typography.hero',
  22: 'typography.title',
  20: 'typography.sectionTitle',
  17: 'typography.body',
  16: 'typography.callout',
  15: 'typography.subhead',
  14: 'typography.footnote',
  13: 'typography.caption',
  12: 'typography.micro',
  11: 'typography.badge',
};

const WEIGHT_ROLE_SUFFIX = {
  11: { '600': 'badge', '700': 'badge' },
  12: { '400': 'micro' },
  13: { '400': 'caption' },
  14: { '400': 'footnote', '600': 'footnoteSemibold' },
  15: { '400': 'subhead', '600': 'subheadSemibold' },
  16: { '400': 'callout', '600': 'callout' },
  17: { '400': 'body', '600': 'bodySemibold' },
  20: { '600': 'sectionTitle', '700': 'sectionTitleBold' },
  22: { '600': 'title' },
  30: { '700': 'hero' },
};

function pickTypoRole(fontSize, fontWeight) {
  const w = fontWeight?.replace(/['"]/g, '');
  const byW = WEIGHT_ROLE_SUFFIX[fontSize]?.[w];
  if (byW) return `typography.${byW}`;
  return TYPO_BY_SIZE[fontSize] ?? null;
}

function ensureImports(src, needs) {
  let out = src;
  const add = (stmt, test) => {
    if (!needs.has(test)) return;
    if (out.includes(test)) return;
    const lines = out.split('\n');
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) lastImport = i;
    }
    lines.splice(lastImport + 1, 0, stmt);
    out = lines.join('\n');
  };
  add("import { space, radius } from '@/theme/tokens';", 'space');
  add("import { typography } from '@/theme/typography';", 'typography');
  add("import { colors, brand } from '@/theme/colors';", 'colors');
  if (needs.has('brand') && !out.includes('brand')) {
    add("import { brand } from '@/theme/tokens';", 'brandOnly');
  }
  return out;
}

function transformFile(absPath) {
  const rel = path.relative(MOBILE_SRC, absPath);
  let src = fs.readFileSync(absPath, 'utf8');
  const needs = new Set();
  let changed = false;

  src = src.replace(SPACING_PROPS, (match, prop, val) => {
    const n = parseInt(val, 10);
    const token = mapSpacing(prop, n, rel);
    if (token.startsWith('/*')) return match;
    if (token === val) return match;
    changed = true;
    needs.add('space');
    const prefix = token.startsWith('radius.') ? 'radius' : 'space';
    needs.add(prefix);
    return `${prop}: ${token}`;
  });

  for (const [hex, token] of Object.entries(HEX_MAP)) {
    const re = new RegExp(hex.replace('#', '#'), 'gi');
    if (re.test(src)) {
      changed = true;
      needs.add('colors');
      src = src.replace(new RegExp(`'${hex}'`, 'gi'), token);
      src = src.replace(new RegExp(`"${hex}"`, 'gi'), token);
    }
  }

  // fontSize + optional fontWeight → spread typography role
  src = src.replace(
    /\{\s*((?:color|flex|textAlign|lineHeight|letterSpacing|opacity|marginTop|marginBottom|flexShrink|numberOfLines)[^}]*?,?\s*)*fontSize:\s*(\d+)(?:\s*,\s*fontWeight:\s*('(?:400|500|600|700)'|"(?:400|500|600|700)"))?([^}]*)\}/g,
    (full, before, sizeStr, weight, after) => {
      const size = parseInt(sizeStr, 10);
      const role = pickTypoRole(size, weight);
      if (!role) return full;
      changed = true;
      needs.add('typography');
      let rest = (before || '') + (after || '');
      rest = rest.replace(/fontWeight:\s*['"]\d+['"],?\s*/g, '');
      rest = rest.replace(/fontSize:\s*\d+,?\s*/g, '');
      rest = rest.trim();
      if (rest.endsWith(',')) rest = rest.slice(0, -1);
      const spread = `...${role}`;
      if (!rest.trim()) return `{ ${spread} }`;
      return `{ ${spread}, ${rest.trim()} }`;
    },
  );

  // Standalone fontSize in StyleSheet blocks
  src = src.replace(/fontSize:\s*(\d+)/g, (m, sizeStr) => {
    const size = parseInt(sizeStr, 10);
    const role = TYPO_BY_SIZE[size];
    if (!role) return m;
    changed = true;
    needs.add('typography');
    return `...${role}`;
  });

  src = src.replace(/fontWeight:\s*'(\d+)'/g, (m, w) => {
    // Remove if already spread from typography (orphan weight)
    if (src.includes('...typography.')) return '';
    return m;
  });

  if (!changed) return false;

  src = ensureImports(src, needs);
  if (!DRY) fs.writeFileSync(absPath, src);
  return true;
}

const files = walk(MOBILE_SRC);
let n = 0;
for (const f of files) {
  if (transformFile(f)) {
    n++;
    console.log('updated', path.relative(ROOT, f));
  }
}
console.log(DRY ? `dry-run: would update ${n} files` : `updated ${n} files`);
