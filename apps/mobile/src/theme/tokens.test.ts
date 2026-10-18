import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { brand } from './tokens.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

test('brand tokens match Live Pulse brand/vemoki/tokens.json', () => {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, 'brand/vemoki/tokens.json'), 'utf8'),
  ) as {
    version: string;
    artDirection: string;
    colors: { ink: string; paper: string; signal: string; focus: string };
    typography: { display: string; body: string };
  };
  assert.equal(raw.version, '2');
  assert.equal(raw.artDirection, 'Live Pulse');
  assert.equal(brand.ink, raw.colors.ink);
  assert.equal(brand.paper, raw.colors.paper);
  assert.equal(brand.signal, raw.colors.signal);
  assert.equal(brand.focus, raw.colors.focus);
  assert.equal(raw.typography.display, 'Sora');
  assert.equal(raw.typography.body, 'Be Vietnam Pro');
});

test('brand supersedes v1 terracotta / warm paper palette', () => {
  assert.notEqual(brand.ink.toLowerCase(), '#22241f');
  assert.notEqual(brand.paper.toLowerCase(), '#f7f6f1');
  assert.notEqual(brand.signal.toLowerCase(), '#9b3a18');
  assert.notEqual(brand.focus.toLowerCase(), '#235fd0');
});
