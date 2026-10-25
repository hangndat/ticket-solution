import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  buildTokensModule,
  loadBrandJson,
} from '../../scripts/sync-tokens.mjs';
import { brand, elevation, radius, space } from './tokens.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const generatedPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'tokens.generated.ts',
);

test('tokens.generated.ts matches in-memory sync from brand/vemoki/tokens.json', () => {
  const expected = buildTokensModule(loadBrandJson(repoRoot));
  const onDisk = readFileSync(generatedPath, 'utf8');
  assert.equal(onDisk, expected);
});

test('brand tokens match Live Pulse brand/vemoki/tokens.json', () => {
  const raw = loadBrandJson(repoRoot);
  assert.equal(raw.version, '2');
  assert.equal(raw.artDirection, 'Live Pulse');
  assert.equal(brand.ink, raw.colors.ink);
  assert.equal(brand.paper, raw.colors.paper);
  assert.equal(brand.signal, raw.colors.signal);
  assert.equal(brand.focus, raw.colors.focus);
  assert.equal(brand.line, raw.colors.line);
  assert.equal(brand.muted, raw.colors.muted);
  assert.equal(brand.destructive, raw.colors.destructive);
  assert.equal(brand.admit, raw.colors.admit);
  assert.equal(brand.unknown, raw.colors.unknown);
  assert.equal(raw.typography.display, 'Sora');
  assert.equal(raw.typography.body, 'Be Vietnam Pro');
  assert.equal(brand.wordmark, 'Vemoki');
  assert.equal(brand.signalMark, '');
  assert.equal(raw.signal, '');
});

test('space scale matches brand JSON (mobile key aliases)', () => {
  const raw = loadBrandJson(repoRoot);
  assert.deepEqual(space, {
    xxs: raw.space.xxs,
    xs: raw.space.xs,
    sm: raw.space.sm,
    md: raw.space.md,
    lg: raw.space.lg,
    xl: raw.space.xl,
    xxl: raw.space['2xl'],
    xxxl: raw.space['3xl'],
    huge: raw.space['4xl'],
  });
});

test('radius scale is centralized from brand JSON', () => {
  assert.deepEqual(radius, {
    sm: 8,
    md: 12,
    lg: 18,
    xl: 24,
    pill: 999,
  });
});

test('elevation presets map shadow.soft/frame per TOKENS.md', () => {
  assert.equal(elevation.none.elevation, 0);
  assert.equal(elevation.card.elevation, 2);
  assert.equal(elevation.sheet.elevation, 4);
  assert.ok(elevation.card.shadowRadius);
  assert.ok(elevation.sheet.shadowRadius);
});

test('brand supersedes v1 terracotta / warm paper palette', () => {
  assert.notEqual(brand.ink.toLowerCase(), '#22241f');
  assert.notEqual(brand.paper.toLowerCase(), '#f7f6f1');
  assert.notEqual(brand.signal.toLowerCase(), '#9b3a18');
  assert.notEqual(brand.focus.toLowerCase(), '#235fd0');
});
