import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { vemokiTheme } from '../src/theme/vemoki';

const themeSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/portal-content-theme.tsx'),
  'utf8',
);

test('PortalContentTheme breaks ProLayout realDark token inheritance (P-F05)', () => {
  assert.match(themeSource, /inherit:\s*false/);
  assert.match(themeSource, /defaultAlgorithm/);
  assert.equal(vemokiTheme.token?.colorBgElevated, '#ffffff');
});
