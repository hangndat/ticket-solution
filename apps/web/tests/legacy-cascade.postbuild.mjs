/**
 * D-1 / #794 — assert compiled cascade from .next/static CSS chunks (post-build only).
 * Invoked via `pnpm test:routes` after `next build`; not part of `pnpm test`.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadPostcss() {
  const tailwindPostcssPkg = realpathSync(
    join(WEB_ROOT, 'node_modules/@tailwindcss/postcss/package.json'),
  );
  const postcssPkg = join(dirname(tailwindPostcssPkg), '../postcss/package.json');
  return createRequire(postcssPkg)('postcss');
}

const postcss = loadPostcss();
const BUILD_STATIC = join(WEB_ROOT, '.next', 'static');

const LAYER_ORDER = ['theme', 'base', 'legacy', 'components', 'utilities'];

/** Representative legacy-bundle selectors (live-pulse / marketing / attendee uplift). */
const LEGACY_SELECTOR_MARKERS = [
  { id: 'live-pulse', needle: '.lp-container' },
  { id: 'marketing-uplift', needle: '.mkt-btn' },
  { id: 'attendee-uplift', needle: 'body.attendee-uplift' },
];

const UTILITIES_DISABLED_OPACITY =
  /\.disabled\\:opacity-50:disabled|\.disabled\\?\\:opacity-50:disabled/;

function walkCssFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkCssFiles(p, acc);
    else if (entry.name.endsWith('.css')) acc.push(p);
  }
  return acc;
}

function loadCompiledCss() {
  const files = walkCssFiles(BUILD_STATIC).sort();
  if (files.length === 0) {
    throw new Error(
      'No compiled CSS under .next/static — run `pnpm --filter @ticket/web build` before test:routes',
    );
  }
  const chunks = files.map((f) => readFileSync(f, 'utf8'));
  return { files, combined: chunks.join('\n'), chunks };
}

function layerNamesFromParams(params) {
  return params
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function firstLayerMarkerIndex(combined, layerName) {
  if (layerName === 'theme' || layerName === 'base') {
    const combo = combined.indexOf('@layer theme,base');
    if (combo >= 0) return combo;
    const solo = combined.indexOf(`@layer ${layerName}`);
    if (solo >= 0) return solo;
    const list = combined.indexOf(`@layer theme, base`);
    if (list >= 0) return list;
    return -1;
  }
  return combined.indexOf(`@layer ${layerName}`);
}

function assertLayerOrder(combined) {
  const positions = new Map(
    LAYER_ORDER.map((name) => [name, firstLayerMarkerIndex(combined, name)]),
  );
  for (const name of LAYER_ORDER) {
    assert.ok(
      positions.get(name) >= 0,
      `compiled CSS must declare @layer ${name} (missing from build output)`,
    );
  }
  for (let i = 1; i < LAYER_ORDER.length; i++) {
    const prev = LAYER_ORDER[i - 1];
    const curr = LAYER_ORDER[i];
    assert.ok(
      positions.get(prev) <= positions.get(curr),
      `@layer order: expected ${LAYER_ORDER.join(' → ')}, but ${curr} appears before ${prev} in bundle`,
    );
  }
}

function normalizeLayers(active) {
  return active.filter((l) => l !== 'properties');
}

function walkRulesWithLayers(root) {
  const hits = [];

  const visitWithStack = (node, stack) => {
    if (node.type === 'atrule' && node.name === 'layer' && node.nodes?.length) {
      const names = layerNamesFromParams(node.params);
      const blockName = names[names.length - 1] ?? names[0];
      const next = blockName ? [...stack, blockName] : stack;
      for (const child of node.nodes) visitWithStack(child, next);
      return;
    }
    if (node.type === 'rule') {
      hits.push({
        selector: node.selector,
        layers: normalizeLayers(stack),
      });
      return;
    }
    if (node.nodes) {
      for (const child of node.nodes) visitWithStack(child, stack);
    }
  };

  if (root.nodes) {
    for (const child of root.nodes) visitWithStack(child, []);
  }
  return hits;
}

function analyzeChunk(cssText, label) {
  const root = postcss.parse(cssText, { from: label });
  return { rules: walkRulesWithLayers(root) };
}

test('compiled CSS encodes D-1 layer cascade and legacy isolation', () => {
  const { files, combined, chunks } = loadCompiledCss();
  const allRules = [];

  for (let i = 0; i < chunks.length; i++) {
    const { rules } = analyzeChunk(chunks[i], files[i]);
    allRules.push(...rules);
  }

  const primaryChunk = chunks.find((c) => c.includes('@layer utilities'));
  assert.ok(
    primaryChunk,
    'expected a global CSS chunk with @layer utilities (main app bundle)',
  );
  assertLayerOrder(primaryChunk);

  for (const { id, needle } of LEGACY_SELECTOR_MARKERS) {
    const matching = allRules.filter((r) => r.selector.includes(needle));
    assert.ok(
      matching.length > 0,
      `expected compiled rule for ${id} (${needle}) — legacy CSS may be missing from build`,
    );
    for (const rule of matching) {
      assert.ok(
        rule.layers.includes('legacy'),
        `${needle} must live in @layer legacy, got layers [${rule.layers.join(', ')}] for selector: ${rule.selector}`,
      );
    }
  }

  const utilityHits = allRules.filter((r) => UTILITIES_DISABLED_OPACITY.test(r.selector));
  assert.ok(
    utilityHits.length > 0,
    'expected .disabled:opacity-50 utility in compiled CSS',
  );
  for (const rule of utilityHits) {
    assert.ok(
      rule.layers.includes('utilities'),
      `disabled:opacity-50 must be in @layer utilities, got [${rule.layers.join(', ')}]`,
    );
  }
});
