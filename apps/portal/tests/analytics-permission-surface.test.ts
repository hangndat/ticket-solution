import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { SURFACE_MESSAGE_KEYS } from '../src/prep/surface-copy';
import { t } from '../src/i18n/t';

const analyticsPagePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../app/t/[tenantId]/analytics/page.tsx',
);

test('analytics permission/rejected Result uses localized permission title (F-982-01)', () => {
  const source = readFileSync(analyticsPagePath, 'utf8');
  assert.match(
    source,
    /title=\{t\(SURFACE_MESSAGE_KEYS\.permissionTitle\)\}/,
    'expected localized permission title on analytics denied branch',
  );
  assert.doesNotMatch(
    source,
    /title="403"/,
    'literal 403 heading regresses SurfaceState permission copy',
  );
  const vi = t('vi', SURFACE_MESSAGE_KEYS.permissionTitle);
  const en = t('en', SURFACE_MESSAGE_KEYS.permissionTitle);
  assert.notEqual(vi, '403');
  assert.notEqual(en, '403');
  assert.ok(vi.length > 0 && en.length > 0);
});
