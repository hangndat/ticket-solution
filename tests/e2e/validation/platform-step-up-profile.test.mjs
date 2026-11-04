import assert from 'node:assert/strict';
import test from 'node:test';
import { isIsolatedPlatformStepUp } from '../harness/runtime.mjs';

test('long platform token profile is confined to an isolated PLAT-01 run', () => {
  assert.equal(isIsolatedPlatformStepUp(['PLAT-01']), true);
  assert.equal(isIsolatedPlatformStepUp(['PLAT-01', 'PLAT-02']), false);
  assert.equal(isIsolatedPlatformStepUp(['PLAT-02', 'PLAT-01']), false);
  assert.equal(isIsolatedPlatformStepUp(['PLAT-02']), false);
  assert.equal(isIsolatedPlatformStepUp([]), false);
});
