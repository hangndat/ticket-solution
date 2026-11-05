import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  buildTokensModule,
  loadBrandJson,
} from '../../scripts/sync-tokens.mjs';
import { colors } from './colors.ts';
import { brand, elevation, radius, space } from './tokens.ts';

test('Gate D12 severity: deny red, warning amber, unknown info-blue are distinct', () => {
  const raw = loadBrandJson(repoRoot);
  assert.equal(raw.colors.info.toLowerCase(), '#2459ba');
  assert.equal(brand.info.toLowerCase(), '#2459ba');
  assert.equal(colors.deny, brand.destructive);
  assert.equal(colors.warning, brand.unknown);
  assert.equal(colors.unknown, brand.info);
  assert.notEqual(colors.warning, colors.deny);
  assert.notEqual(colors.unknown, colors.warning);
  assert.notEqual(colors.unknownSurface, colors.warningSurface);
});

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

test('brand tokens match Electric Violet brand/vemoki/tokens.json', () => {
  const raw = loadBrandJson(repoRoot);
  assert.equal(raw.version, '5');
  assert.equal(raw.artDirection, 'Electric Violet');
  assert.equal(brand.ink, raw.colors.ink);
  assert.equal(brand.paper, raw.colors.paper);
  assert.equal(brand.signal, raw.colors.signal);
  assert.equal(brand.focus, raw.colors.focus);
  assert.equal(brand.line, raw.colors.line);
  assert.equal(brand.muted, raw.colors.muted);
  assert.equal(brand.destructive, raw.colors.destructive);
  assert.equal(brand.admit, raw.colors.admit);
  assert.equal(brand.unknown, raw.colors.unknown);
  assert.equal(raw.typography.display, 'Be Vietnam Pro');
  assert.equal(raw.typography.body, 'Be Vietnam Pro');
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

test('brand uses the approved Electric Violet palette', () => {
  assert.notEqual(brand.ink.toLowerCase(), '#22241f');
  assert.notEqual(brand.paper.toLowerCase(), '#f7f6f1');
  assert.notEqual(brand.signal.toLowerCase(), '#9b3a18');
  assert.notEqual(brand.focus.toLowerCase(), '#235fd0');
  assert.equal(brand.ink.toLowerCase(), '#17151f');
  assert.equal(brand.paper.toLowerCase(), '#ffffff');
  assert.equal(brand.signal.toLowerCase(), '#7038ff');
  assert.equal(brand.primary.toLowerCase(), '#7038ff');
  assert.equal(brand.focus.toLowerCase(), '#7038ff');
  assert.equal(brand.line.toLowerCase(), '#dedce6');
  assert.equal(brand.muted.toLowerCase(), '#625e70');
  assert.equal(brand.destructive.toLowerCase(), '#be263b');
  assert.equal(brand.admit.toLowerCase(), '#137a4b');
  assert.equal(brand.unknown.toLowerCase(), '#8a5700');
});
