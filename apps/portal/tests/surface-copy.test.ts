import assert from 'node:assert/strict';
import test from 'node:test';
import { isMessageKey } from '../src/i18n';
import {
  SURFACE_MESSAGE_KEYS,
  surfaceMessageKeys,
} from '../src/prep/surface-copy';
import { t } from '../src/i18n/t';

test('surface message keys are registered MessageKey values', () => {
  for (const key of surfaceMessageKeys()) {
    assert.equal(isMessageKey(key), true, `missing MessageKey: ${key}`);
  }
});

test('surface defaults resolve in vi and en', () => {
  for (const key of surfaceMessageKeys()) {
    const vi = t(key, 'vi');
    const en = t(key, 'en');
    assert.ok(vi.length > 0, `${key} vi empty`);
    assert.ok(en.length > 0, `${key} en empty`);
  }
  assert.equal(SURFACE_MESSAGE_KEYS.loading, 'surface.loading');
});
