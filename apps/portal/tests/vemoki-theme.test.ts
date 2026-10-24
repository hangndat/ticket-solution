import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { VEMOKI_COLORS, vemokiTheme } from '../src/theme/vemoki';
import { buildVemokiRootCssBlock } from '../src/theme/vemoki-root-vars';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const brandTokens = JSON.parse(
  readFileSync(join(repoRoot, 'brand/vemoki/tokens.json'), 'utf8'),
) as { colors: Record<string, string> };

test('portal theme maps Live Pulse brand tokens (VD-07 K-05)', () => {
  assert.equal(VEMOKI_COLORS.ink, brandTokens.colors.ink);
  assert.equal(VEMOKI_COLORS.paper, brandTokens.colors.paper);
  assert.equal(VEMOKI_COLORS.signal, brandTokens.colors.signal);
  assert.equal(VEMOKI_COLORS.focus, brandTokens.colors.focus);
  assert.equal(vemokiTheme.token?.colorPrimary, brandTokens.colors.signal);
  assert.equal(vemokiTheme.components?.Layout?.siderBg, VEMOKI_COLORS.siderBg);
});

test('portal root CSS vars are emitted from VEMOKI_COLORS (no duplicate hex in globals.css)', () => {
  const globals = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../app/globals.css'),
    'utf8',
  );
  const rootCss = buildVemokiRootCssBlock();
  for (const [key, value] of Object.entries({
    ink: brandTokens.colors.ink,
    paper: brandTokens.colors.paper,
    signal: brandTokens.colors.signal,
    focus: brandTokens.colors.focus,
    line: brandTokens.colors.line,
    muted: brandTokens.colors.muted,
  })) {
    assert.ok(
      rootCss.toLowerCase().includes(value.toLowerCase()),
      `root CSS must include brand ${key}`,
    );
    assert.equal(
      globals.toLowerCase().includes(value.toLowerCase()),
      false,
      `globals.css must not duplicate brand hex for ${key}`,
    );
  }
  assert.ok(rootCss.includes(`--vemoki-sider: ${VEMOKI_COLORS.siderBg}`));
});
