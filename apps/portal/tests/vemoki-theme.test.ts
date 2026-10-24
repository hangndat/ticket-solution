import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { VEMOKI_COLORS, vemokiTheme } from '../src/theme/vemoki';

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
